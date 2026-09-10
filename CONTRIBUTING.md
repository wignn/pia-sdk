# Contributing to PIA SDK

Thank you for your interest in contributing to the official PIA SDKs!

This polyglot repository houses both the **TypeScript SDK (`@piaa/sdk`)** and the **Python SDK (`piaa-sdk`)**.

---

## Repository Structure

```text
pia-sdk/
├── typescript/        # TypeScript SDK (@piaa/sdk)
│   ├── src/           # Source code
│   ├── test/          # Bun test suite
│   └── examples/      # Usage examples
├── python/            # Python SDK (piaa-sdk)
│   ├── pia/           # Core library
│   ├── tests/         # Unittest suite
│   └── examples/      # Usage examples
└── .github/           # CI/CD Workflows
```

---

## Local Development Setup

### TypeScript SDK

Prerequisites: [Bun 1.1+](https://bun.sh)

```bash
cd typescript
bun test
bun run build
```

### Python SDK

Prerequisites: Python 3.8+

```bash
cd python
pip install -e ".[realtime]"
python -m unittest discover -s tests -p "test_*.py"
```

---

## Pull Request Guidelines

1. Fork the repo and create your branch from `main`.
2. Add unit tests for any new features or bug fixes.
3. Ensure all tests pass across both TypeScript and Python.
4. Keep commits concise and follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(ts): ...`
   - `feat(py): ...`
   - `fix(ts): ...`
   - `fix(py): ...`
   - `docs: ...`
