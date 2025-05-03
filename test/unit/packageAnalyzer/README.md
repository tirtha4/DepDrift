# Package Analyzer Test Suite

Tests for the package dependency analysis functionality in DepDrift.

## Overview

These tests validate the core functionality of the packageAnalyzer module, which is responsible for analyzing dependencies in package.json files, calculating drift levels, and determining how far packages are from their latest versions.

## Test Structure

The test suite is organized into:

1. **basic.test.js** - Tests for core functionality:
   - Version range parsing and resolution
   - Pre-release version detection
   - Package dependency analysis
   - Drift level calculation
   - Version comparison

2. **edge.test.js** - Tests for edge cases and error handling:
   - Invalid or unusual inputs
   - Network errors
   - Empty or malformed responses
   - Boundary conditions
   - Performance considerations

## Functions Tested

The following functions from the packageAnalyzer module are tested:

- `parseVersionRange` - Resolves version ranges to specific versions
- `isPreRelease` - Detects pre-release versions
- `satisfiesRange` - Checks if a version satisfies a range specification
- `analyzeDependency` - Analyzes a single dependency for drift from latest version
- `analyzePackage` - Analyzes an entire package.json for dependency drift
- `fetchNpmPackageInfo` - Fetches package information from the npm registry
- `calculateDriftLevel` - Determines the drift level based on version and time

## Test Approach

The tests follow these practices:

1. **Isolation**: All external dependencies (registry access, file system, etc.) are mocked
2. **Comprehensive Mocking**: The npm registry, cache system, and date functionality are all mocked
3. **Console Output Suppression**: Console methods are mocked to prevent output during tests
4. **Proper Cleanup**: All mocks are properly restored after tests
5. **Error Handling Focus**: Extensive testing of how the module handles errors and edge cases

## Edge Cases Covered

- Null/undefined inputs
- Empty strings and invalid version formats
- Network timeouts and HTTP errors
- Registry service unavailability
- Malformed package data
- Extremely long dependency names and version lists
- Handling of circular dependencies
- Pre-release version handling
- Complex version range specifications
- Performance with large dependency sets

## Integration Points

The packageAnalyzer module interacts with several other systems that are mocked in these tests:

- **npm Registry**: Mocked to provide consistent package information
- **Cache System**: Mocked to isolate tests from filesystem operations
- **Drift Utilities**: Tested for integration with the core drift level calculations

## Useful Information for Test Maintenance

1. The `mockPackageInfo` object provides a consistent structure for testing
2. The tests mock the global `Date` object where necessary for consistent time-based tests
3. When extending these tests, be careful to properly restore any global mocks
4. All asynchronous code uses proper async/await patterns 

## Future Work (TBD)

To improve test coverage and quality, the following work is planned:

1. **Expand Function Coverage**:
   - Add tests for `analyzeDependency` for comprehensive package analysis
   - Add tests for `analyzePackage` to validate full package.json processing
   - Create tests for `getPackageVersions` and `determineDriftLevel` functions
   - Implement proper tests for `daysBetween` utility with various date formats

2. **Improve ES Module Mocking**:
   - Develop a more robust approach to mocking ES modules
   - Create a reusable mocking pattern for registry and cache modules
   - Implement proper dependency injection to reduce the need for module mocking

3. **Integration Tests**:
   - Add tests that verify how multiple functions work together
   - Validate end-to-end workflows from package parsing to report generation
   - Test actual npm registry responses with controlled test packages

4. **Performance Testing**:
   - Add benchmarks for large package.json files
   - Test caching mechanisms for effectiveness
   - Validate performance with hundreds of dependencies

5. **Branch Coverage Improvements**:
   - Target specific conditional branches that are currently untested
   - Add test cases for rare but important error conditions
   - Implement tests for all configuration options

6. **Testing Tools Enhancement**:
   - Set up proper code coverage reporting in CI/CD
   - Add visual coverage reports for easier identification of gaps
   - Implement snapshot testing for complex response objects 