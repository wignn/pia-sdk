"""Official PIA SDK - Resilient HTTP Transports (Sync & Async) with Exponential Backoff."""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Optional, Set

import httpx

from .config import PiaConfig
from .errors import (
    ApiError,
    AuthenticationError,
    NetworkError,
    ParseError,
    PermissionError,
    RateLimitError,
    TimeoutError,
)
from .logger import setup_logger
from .types import RateLimitInfo

SDK_VERSION = "1.3.13"
RETRYABLE_STATUS_CODES: Set[int] = {408, 429, 500, 502, 503, 504}


def _is_retry_safe(method: str) -> bool:
    return method.upper() in {"GET", "HEAD"}


def _parse_telemetry(headers: httpx.Headers) -> RateLimitInfo:
    def _get_int(key: str) -> Optional[int]:
        val = headers.get(key)
        if val is not None:
            try:
                return int(val)
            except ValueError:
                return None
        return None

    return RateLimitInfo(
        limit=_get_int("x-ratelimit-limit"),
        remaining=_get_int("x-ratelimit-remaining"),
        reset_seconds=_get_int("x-ratelimit-reset"),
        daily_limit=_get_int("x-dailyquota-limit"),
        daily_remaining=_get_int("x-dailyquota-remaining"),
    )


def _calc_backoff(attempt: int, retry_after: Optional[str], config: PiaConfig) -> float:
    if retry_after:
        value = retry_after.strip()
        if re.fullmatch(r"[0-9]+", value):
            try:
                return min(float(value), config.max_retry_delay)
            except OverflowError:
                return config.max_retry_delay
        is_http_date = (
            re.fullmatch(
                r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} "
                r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} "
                r"\d{2}:\d{2}:\d{2} GMT",
                value,
            )
            or re.fullmatch(
                r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-"
                r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2} "
                r"\d{2}:\d{2}:\d{2} GMT",
                value,
            )
            or re.fullmatch(
                r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) "
                r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}\d{1,2} "
                r"\d{2}:\d{2}:\d{2} \d{4}",
                value,
            )
        )
        if is_http_date:
            try:
                retry_at = parsedate_to_datetime(value)
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                remaining = max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
                return min(remaining, config.max_retry_delay)
            except (TypeError, ValueError, OverflowError):
                pass

    base = config.retry_delay * (2 ** (attempt - 1))
    capped = min(base, config.max_retry_delay)
    jitter = 0.5 + random.random() * 0.5
    return capped * jitter


def _handle_error_response(
    response: httpx.Response,
    endpoint: str,
    method: str,
    telemetry: RateLimitInfo,
) -> None:
    status = response.status_code
    req_id = response.headers.get("x-request-id") or response.headers.get("cf-ray")

    body_json: Any = None
    try:
        body_json = response.json()
    except Exception:
        pass

    error_msg = ""
    if isinstance(body_json, dict):
        error_msg = body_json.get("message") or body_json.get("error") or ""
    if not error_msg:
        error_msg = response.text[:200] if response.text else f"HTTP {status}"

    details = {
        "status_code": status,
        "endpoint": endpoint,
        "method": method,
        "request_id": req_id,
        "raw_response": body_json or response.text,
    }

    if status == 401:
        raise AuthenticationError(error_msg, **details)
    if status == 403:
        raise PermissionError(error_msg, **details)
    if status == 429:
        retry_val: Optional[int] = None
        raw_retry = response.headers.get("retry-after")
        if raw_retry:
            try:
                retry_val = int(raw_retry)
            except ValueError:
                pass
        raise RateLimitError(
            error_msg,
            retry_after_seconds=retry_val,
            daily_limit=telemetry.daily_limit,
            daily_remaining=telemetry.daily_remaining,
            minute_limit=telemetry.limit,
            minute_remaining=telemetry.remaining,
            **details,
        )

    raise ApiError(error_msg, **details)


class SyncTransport:
    """Synchronous resilient HTTP transport with exponential backoff and telemetry tracking."""

    def __init__(
        self,
        config: PiaConfig,
        client: Optional[httpx.Client] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.config = config
        self.logger = logger or setup_logger(config.debug)
        self._last_telemetry = RateLimitInfo()
        self.client = client or httpx.Client(
            base_url=config.base_url,
            timeout=config.timeout,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "x-api-key": config.api_key,
                "Accept": "application/json",
                "User-Agent": f"pia-sdk-py/{SDK_VERSION}",
                **config.headers,
            },
        )
        self._owns_client = client is None

    def get_rate_limit_info(self) -> RateLimitInfo:
        return self._last_telemetry

    def close(self) -> None:
        if self._owns_client:
            self.client.close()

    def request(
        self,
        endpoint: str,
        method: str = "GET",
        json_data: Any = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Any:
        attempt = 0
        max_retries = self.config.max_retries

        url = f"{self.config.base_url}{endpoint if endpoint.startswith('/') else '/' + endpoint}"
        req_headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "x-api-key": self.config.api_key,
            "Accept": "application/json",
            "User-Agent": f"pia-sdk-py/{SDK_VERSION}",
            **self.config.headers,
            **(headers or {}),
        }

        while True:
            attempt += 1
            self.logger.debug("HTTP %s %s (Attempt %d/%d)", method, endpoint, attempt, max_retries + 1)

            try:
                response = self.client.request(
                    method=method,
                    url=url,
                    json=json_data,
                    params=params,
                    headers=req_headers,
                    timeout=timeout or self.config.timeout,
                )

                self._last_telemetry = _parse_telemetry(response.headers)

                if response.is_success:
                    if not response.text or not response.text.strip():
                        return {}
                    try:
                        return response.json()
                    except json.JSONDecodeError as err:
                        raise ParseError(
                            f"Failed to parse JSON response: {err}",
                            raw_text=response.text[:500],
                            status_code=response.status_code,
                            endpoint=endpoint,
                            method=method,
                        ) from err

                is_retryable = (
                    response.status_code in RETRYABLE_STATUS_CODES
                    and attempt <= max_retries
                    and _is_retry_safe(method)
                )
                if is_retryable:
                    delay = _calc_backoff(attempt, response.headers.get("retry-after"), self.config)
                    self.logger.warning(
                        "Request to %s failed with HTTP %d. Retrying in %.2fs...",
                        endpoint,
                        response.status_code,
                        delay,
                    )
                    time.sleep(delay)
                    continue

                _handle_error_response(response, endpoint, method, self._last_telemetry)

            except httpx.TimeoutException as err:
                if attempt <= max_retries and _is_retry_safe(method):
                    delay = _calc_backoff(attempt, None, self.config)
                    self.logger.warning("Request timed out on %s. Retrying in %.2fs...", endpoint, delay)
                    time.sleep(delay)
                    continue
                raise TimeoutError(
                    f"Request to {endpoint} timed out after {timeout or self.config.timeout}s.",
                    timeout_seconds=timeout or self.config.timeout,
                    endpoint=endpoint,
                    method=method,
                ) from err

            except httpx.NetworkError as err:
                if attempt <= max_retries and _is_retry_safe(method):
                    delay = _calc_backoff(attempt, None, self.config)
                    self.logger.warning("Network error on %s: %s. Retrying in %.2fs...", endpoint, err, delay)
                    time.sleep(delay)
                    continue
                raise NetworkError(
                    f"Network error connecting to {endpoint}: {err}",
                    cause=err,
                    endpoint=endpoint,
                    method=method,
                ) from err


class AsyncTransport:
    """Asynchronous resilient HTTP transport for asyncio applications."""

    def __init__(
        self,
        config: PiaConfig,
        client: Optional[httpx.AsyncClient] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.config = config
        self.logger = logger or setup_logger(config.debug)
        self._last_telemetry = RateLimitInfo()
        self.client = client or httpx.AsyncClient(
            base_url=config.base_url,
            timeout=config.timeout,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "x-api-key": config.api_key,
                "Accept": "application/json",
                "User-Agent": f"pia-sdk-py/{SDK_VERSION}",
                **config.headers,
            },
        )
        self._owns_client = client is None

    def get_rate_limit_info(self) -> RateLimitInfo:
        return self._last_telemetry

    async def aclose(self) -> None:
        if self._owns_client:
            await self.client.aclose()

    async def request(
        self,
        endpoint: str,
        method: str = "GET",
        json_data: Any = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Any:
        attempt = 0
        max_retries = self.config.max_retries

        url = f"{self.config.base_url}{endpoint if endpoint.startswith('/') else '/' + endpoint}"
        req_headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "x-api-key": self.config.api_key,
            "Accept": "application/json",
            "User-Agent": f"pia-sdk-py/{SDK_VERSION}",
            **self.config.headers,
            **(headers or {}),
        }

        while True:
            attempt += 1
            self.logger.debug("Async HTTP %s %s (Attempt %d/%d)", method, endpoint, attempt, max_retries + 1)

            try:
                response = await self.client.request(
                    method=method,
                    url=url,
                    json=json_data,
                    params=params,
                    headers=req_headers,
                    timeout=timeout or self.config.timeout,
                )

                self._last_telemetry = _parse_telemetry(response.headers)

                if response.is_success:
                    if not response.text or not response.text.strip():
                        return {}
                    try:
                        return response.json()
                    except json.JSONDecodeError as err:
                        raise ParseError(
                            f"Failed to parse JSON response: {err}",
                            raw_text=response.text[:500],
                            status_code=response.status_code,
                            endpoint=endpoint,
                            method=method,
                        ) from err

                is_retryable = (
                    response.status_code in RETRYABLE_STATUS_CODES
                    and attempt <= max_retries
                    and _is_retry_safe(method)
                )
                if is_retryable:
                    delay = _calc_backoff(attempt, response.headers.get("retry-after"), self.config)
                    self.logger.warning(
                        "Request to %s failed with HTTP %d. Retrying in %.2fs...",
                        endpoint,
                        response.status_code,
                        delay,
                    )
                    try:
                        await asyncio.sleep(delay)
                    except asyncio.CancelledError:
                        raise
                    continue

                _handle_error_response(response, endpoint, method, self._last_telemetry)

            except httpx.TimeoutException as err:
                if attempt <= max_retries and _is_retry_safe(method):
                    delay = _calc_backoff(attempt, None, self.config)
                    self.logger.warning("Request timed out on %s. Retrying in %.2fs...", endpoint, delay)
                    try:
                        await asyncio.sleep(delay)
                    except asyncio.CancelledError:
                        raise
                    continue
                raise TimeoutError(
                    f"Request to {endpoint} timed out after {timeout or self.config.timeout}s.",
                    timeout_seconds=timeout or self.config.timeout,
                    endpoint=endpoint,
                    method=method,
                ) from err

            except httpx.NetworkError as err:
                if attempt <= max_retries and _is_retry_safe(method):
                    delay = _calc_backoff(attempt, None, self.config)
                    self.logger.warning("Network error on %s: %s. Retrying in %.2fs...", endpoint, err, delay)
                    try:
                        await asyncio.sleep(delay)
                    except asyncio.CancelledError:
                        raise
                    continue
                raise NetworkError(
                    f"Network error connecting to {endpoint}: {err}",
                    cause=err,
                    endpoint=endpoint,
                    method=method,
                ) from err
