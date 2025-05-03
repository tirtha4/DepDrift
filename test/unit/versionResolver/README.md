# Version Resolver Test Suite

Tests for the semantic versioning functions used throughout DepDrift.

## Overview

These tests validate the functionality of version-related utilities scattered across various modules in the project. While there's no single "versionResolver" module, these functions together form the project's version resolution capabilities.

## Test Structure

The test suite is organized into:

1. **basic.test.js** - Tests for core functionality:
   - Version range parsing
   - Pre-release detection
   - Version satisfaction checking
   - Range resolution

2. **edge.test.js** - Tests for edge cases and error handling:
   - Invalid version strings
   - Malformed ranges
   - Semver parsing errors
   - Unusual format handling

## Functions Tested

Functions from different modules are tested:

### From driftUtils.js:
- `parseVersionRange` - Parses version ranges into component parts
- `isPreRelease` - Checks if a version is a pre-release version
- `satisfiesRange` - Checks if a version satisfies a range

### From packageAnalyzer.js:
- `parseVersionRange` - Selects specific versions from ranges
- `satisfiesRange` - Alternative implementation for range satisfaction

## Test Approach

These tests follow the project's standard testing practices:

1. **Proper Mock Isolation**: Console methods are mocked to prevent output during tests
2. **Error Handling Focus**: Extensive testing of edge cases and error conditions
3. **Semver Compatibility**: Tests for various semver range formats
4. **Mock Restoration**: All mocks are properly restored after testing

## Edge Cases Covered

- Null/undefined inputs
- Empty strings
- Invalid semver strings
- Pre-release and build metadata formats
- Zero version components (0.x.y)
- Extremely long version strings
- Complex ranges with multiple conditions
- Semver parsing and satisfaction errors 