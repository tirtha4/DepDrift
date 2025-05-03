# DepDrift Testing

This directory contains tests for the DepDrift project. For detailed testing guidelines, see [docs/TESTING.md](../docs/TESTING.md).

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
npm test -- test/unit/graphBuilder.basic.test.js
```

To run tests with coverage:

```bash
npm test -- --coverage
```

## Test Directory Structure

```
test/
├── unit/                  # Unit tests
│   ├── graphBuilder/      # GraphBuilder specific tests
│   │   ├── basic.test.js  # Basic functionality tests
│   │   ├── cache.test.js  # Cache-related tests
│   │   └── edge.test.js   # Edge case tests
│   └── ...
├── integration/           # Integration tests
└── utils/                 # Test utilities
```

## Writing New Tests

When adding new tests:

1. Start with basic functionality tests
2. Add tests one by one, running each to confirm it passes
3. Group related tests in appropriate files
4. Keep tests isolated from each other
5. Follow the Arrange-Act-Assert (AAA) pattern

## Mocks

Mocks are defined in:

- `__mocks__/` for external modules
- `src/__mocks__/` for internal modules

Reset your mocks before each test:

```javascript
// In your test file
beforeEach(() => {
  jest.clearAllMocks();
  fs.__resetAllMocks();
  arborist.__resetConfig();
});
```

## Debugging Tests

To debug tests:

1. Enable console logging by commenting out the console mocks in `jest.setup.js`
2. Use the `debug()` global function to add debug output
3. Run tests with the `--verbose` flag

```javascript
// Enable debugging for a specific test
test('my test', () => {
  global.DEBUG = true;
  debug('Some debug info', { data: 'value' });
  // Your test code...
  global.DEBUG = false;
});
``` 