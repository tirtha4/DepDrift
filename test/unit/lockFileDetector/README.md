# LockFileDetector Module Tests

This directory contains tests for the LockFileDetector module, which is responsible for identifying lock files in a project and determining the primary package manager.

## Test Files

- **basic.test.js**: Tests the core functionality of the module, including detection of lock files and determination of the primary package manager.
- **edge.test.js**: Tests the module's behavior in edge cases and error conditions.

## Test Coverage

The tests provide good coverage of the LockFileDetector module:
- Statement coverage: 83.33%
- Branch coverage: 100%
- Function coverage: 100%

The uncovered lines are primarily related to debugging code.

## Key Features Tested

- Detection of npm lock file (package-lock.json)
- Detection of yarn lock file (yarn.lock)
- Detection of pnpm lock file (pnpm-lock.yaml)
- Determination of primary package manager based on available lock files
- Error handling for various file system issues
- Handling of invalid or unusual project paths

## Mock Implementation

The tests use Jest's `spyOn` to mock the `fs.existsSync` function, allowing for controlled testing of various scenarios without requiring actual files on disk. This approach ensures tests are reliable and not dependent on the local file system.

Examples:
```javascript
jest.spyOn(fs, 'existsSync').mockImplementation((filepath) => {
  if (filepath.endsWith('package-lock.json')) return true;
  return false;
});
```

## Test Isolation

The tests are designed with proper isolation to prevent test interference:

1. Each test properly restores mocks using `afterEach` and `afterAll` hooks
2. Original function implementations are stored and restored
3. Mocks are created with specific scope to avoid affecting other tests
4. Tests reset the mock state before each new test case

This isolation ensures that these tests don't interfere with other module tests, particularly the GraphBuilder module tests.

## Error Handling

The tests ensure the module handles various error conditions gracefully:
- Missing or inaccessible files
- Permission errors
- Invalid project paths (empty, null, undefined)
- Paths with unusual characters

## Future Improvements

Potential areas for further testing:
- Integration with other modules
- Performance testing with large repositories
- Additional edge cases for unusual project structures
- Testing with real-world package manager configurations 