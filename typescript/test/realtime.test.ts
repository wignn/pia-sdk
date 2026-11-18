import { describe, expect, it } from "bun:test";
import { resolveConfig } from "../src/config";
import { RealtimeClient } from "../src/realtime/socket";

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public readyState = 1; // OPEN
  public sentMessages: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((e: { data: string }) => void) | null = null;
  public onerror: ((e: any) => void) | null = null;
  public onclose: ((e: any) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 5);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason, wasClean: true });
  }

  simulateMessage(obj: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(obj) });
    }
  }
}

describe("RealtimeClient - In-Band Message Auth & Streaming", () => {
  it("automatically sends In-Band Auth frame upon TCP open", async () => {
    MockWebSocket.instances = [];

    const config = resolveConfig({
      apiKey: "wi_live_secretkey123",
      WebSocket: MockWebSocket as any,
    });

    const client = new RealtimeClient(config);

    let connectFired = false;
    client.on("connect", () => {
      connectFired = true;
    });

    client.connect();

    // Wait for mock onopen
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(connectFired).toBe(true);
    const mockWs = MockWebSocket.instances[0];
    expect(mockWs).toBeDefined();

    // Verify first sent frame was In-Band Auth
    expect(mockWs.sentMessages.length).toBeGreaterThanOrEqual(1);
    const authFrame = JSON.parse(mockWs.sentMessages[0]);
    expect(authFrame.action).toBe("auth");
    expect(authFrame.api_key).toBe("wi_live_secretkey123");

    client.disconnect();
  });

  it("emits authenticated event and sends subscriptions once authorized", async () => {
    MockWebSocket.instances = [];

    const config = resolveConfig({
      apiKey: "test_key",
      WebSocket: MockWebSocket as any,
    });

    const client = new RealtimeClient(config);
    client.subscribe(["XAUUSD", "BTCUSDT"]);

    let authPayload: any = null;
    client.on("authenticated", (data) => {
      authPayload = data;
    });

    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const mockWs = MockWebSocket.instances[0];

    // Simulate backend sending auth confirmation
    mockWs.simulateMessage({
      event: "authenticated",
      data: { plan: "starter", ws_connections_max: 3 },
    });

    expect(authPayload).toBeDefined();
    expect(authPayload.plan).toBe("starter");

    // Check that subscriptions were flushed
    const subMessage = mockWs.sentMessages.find((m) => m.includes('"action":"subscribe"'));
    expect(subMessage).toBeDefined();
    const parsedSub = JSON.parse(subMessage!);
    expect(parsedSub.symbols).toContain("XAUUSD");
    expect(parsedSub.symbols).toContain("BTCUSDT");

    client.disconnect();
  });

  it("authTimeoutClosesSocket", async () => {
    const config = resolveConfig({ apiKey: "test_key", timeoutMs: 100, WebSocket: MockWebSocket as any });
    const client = new RealtimeClient(config);
    try {
      MockWebSocket.instances = [];
      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const socket = MockWebSocket.instances.at(-1)!;
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(socket.readyState).toBe(3);
    } finally {
      client.disconnect();
    }
  });

  it("marketTickTypeRetainsReceiptAndProviderProvenance", () => {
    const tick: import("../src/types").MarketPrice = {
      symbol: "XAUUSD",
      price: 2500,
      bid: 2499,
      ask: 2501,
      received_at: "2026-11-18T00:00:00Z",
      provider_source: "ctrader_fix",
    };
    expect(tick.received_at).toBe("2026-11-18T00:00:00Z");
    expect(tick.provider_source).toBe("ctrader_fix");
  });

  it("pongWithoutMarketTickDoesNotAdvanceMarketFreshness", async () => {
    const config = resolveConfig({ apiKey: "test_key", WebSocket: MockWebSocket as any });
    const client = new RealtimeClient(config);
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const socket = MockWebSocket.instances.at(-1)!;
    socket.simulateMessage({ event: "authenticated" });
    const marketAt = client.getLastMarketEventTime();
    socket.simulateMessage({ event: "pong" });
    expect(client.getLastPongTime()).toBeGreaterThan(0);
    expect(client.getLastMarketEventTime()).toBe(marketAt);
    client.disconnect();
  });

  it("reconnectResubscribesAfterAuth", async () => {
    const config = resolveConfig({ apiKey: "test_key", WebSocket: MockWebSocket as any });
    const client = new RealtimeClient(config);
    client.subscribe("XAUUSD");
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const previous = MockWebSocket.instances.at(-1)!;
    previous.simulateMessage({ event: "authenticated" });
    previous.close(1006, "network lost");
    await new Promise((resolve) => setTimeout(resolve, 1300));
    const next = MockWebSocket.instances.at(-1)!;
    next.simulateMessage({ event: "authenticated" });
    expect(next.sentMessages.some((m) => m.includes('"action":"subscribe"'))).toBe(true);
    client.disconnect();
  });

  it("oldSocketEventsIgnored", async () => {
    const config = resolveConfig({ apiKey: "test_key", WebSocket: MockWebSocket as any });
    const client = new RealtimeClient(config);
    const ticks: unknown[] = [];
    client.on("tick", (tick) => ticks.push(tick));
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const old = MockWebSocket.instances.at(-1)!;
    old.close(1006, "reconnect");
    await new Promise((resolve) => setTimeout(resolve, 1300));
    const current = MockWebSocket.instances.at(-1)!;
    current.simulateMessage({ event: "authenticated" });
    old.simulateMessage({ event: "market.tick", data: { symbol: "STALE" } });
    expect(ticks).toHaveLength(0);
    client.disconnect();
  });

  it("explicitDisconnectDoesNotReconnect", async () => {
    const before = MockWebSocket.instances.length;
    const client = new RealtimeClient(resolveConfig({ apiKey: "test_key", WebSocket: MockWebSocket as any }));
    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    client.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(MockWebSocket.instances.length).toBe(before + 1);
  });

  it("dispatches live tick events to listeners", async () => {
    MockWebSocket.instances = [];

    const config = resolveConfig({
      apiKey: "test_key",
      WebSocket: MockWebSocket as any,
    });

    const client = new RealtimeClient(config);
    client.on("authenticated", () => {});
    let capturedTick: any = null;

    client.on("tick", (tick) => {
      capturedTick = tick;
    });

    client.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const mockWs = MockWebSocket.instances[0];
    mockWs.simulateMessage({ event: "authenticated" });
    mockWs.simulateMessage({
      event: "market.trade",
      data: {
        tick: {
          symbol: "XAUUSD",
          price: 2510.25,
          bid: 2510.2,
          ask: 2510.3,
        },
      },
    });

    expect(capturedTick).toBeDefined();
    expect(capturedTick.symbol).toBe("XAUUSD");
    expect(capturedTick.price).toBe(2510.25);

    client.disconnect();
  });
});
