# GraphComparator Test Suite

This directory contains comprehensive tests for the `graphComparator` module, which is responsible for comparing dependency graphs between projects or different versions of the same project.

## Test Files

The test suite is organized into the following files:

- **basic.test.js**: Tests the core functionality of the module, including:
  - Graph comparison basics
  - Dependency tree traversal and matching
  - Identifying differences between graphs
  - Handling of matching dependencies

- **edge.test.js**: Tests edge cases and error handling, including:
  - Invalid inputs (null, undefined, empty graphs)
  - Complex dependency structures
  - Error recovery and graceful degradation
  - Boundary conditions
  - Handling of circular dependencies

## Key Features Tested

### Basic Graph Comparison
- Direct dependency comparison
- Version alignment
- Graph structure differences
- Dependency availability matching

### Tree Comparison
- Node matching algorithms
- Tree traversal and merging
- Structural differences detection
- Handling of missing or extra nodes

### Result Generation
- Comprehensive comparison results
- Summary statistics
- Detail level options
- Output formats

## Mocking Strategy

The tests use a consistent mocking approach:

1. **Graph Structure Mocking**: Create mock dependency graphs with different structures to test comparison functionality.

2. **Dependency Node Mocking**: Generate mock dependency nodes that mimic the structure from graphBuilder but simplified for testing.

3. **Console Mocking**: Mock `console.warn` and `console.debug` to:
   - Prevent output clutter during test runs
   - Verify warning messages are generated when expected
   - Restore original implementations after tests

## Test Isolation

To ensure proper test isolation and prevent test interference:

1. **Mock Restoration**: All mocks are properly restored after each test using:
   - `beforeEach()` hooks to reset mocks
   - `afterAll()` hooks to restore original implementations
   - Storage of original function references

2. **Clean State**: Each test operates with a clean state by:
   - Creating fresh graph objects for each test
   - Avoiding shared state between tests
   - Using `jest.clearAllMocks()` and `jest.resetAllMocks()`

## Coverage Goals

The test suite aims to achieve high coverage metrics:

- **Statement Coverage**: >90%
- **Branch Coverage**: >90%
- **Function Coverage**: 100%
- **Line Coverage**: >90%

## Future Improvements

Potential areas for test enhancement:

1. **Performance Testing**: Add tests specifically for performance characteristics when comparing very large dependency graphs.

2. **Integration with DriftAnalyzer**: Add tests that verify the integration between the graphComparator and driftAnalyzer modules.

3. **Real-world Graph Testing**: Add tests using more complex, real-world dependency tree structures. 