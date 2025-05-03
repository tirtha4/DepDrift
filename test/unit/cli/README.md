# CLI Module Test Suite

Tests for the Command Line Interface functionality in DepDrift.

## Overview

These tests validate the core functionality of the CLI module, which is responsible for parsing command-line arguments, displaying results, and executing the appropriate analysis functions based on user input.

## Test Structure

The test suite is organized into:

1. **basic.test.js** - Tests for core functionality:
   - Command-line argument parsing
   - Config file loading and merging
   - Output formatting
   - Error handling for standard inputs

2. **edge.test.js** - Tests for edge cases and error handling:
   - Invalid arguments
   - Missing package.json
   - Permission issues
   - Unexpected formats
   - Complex flag combinations

## Functions Tested

The following functions from the CLI module are tested:

- `findPackageJson` - Locates package.json in directory hierarchy
- `parseExcludeTypes` - Parses exclusion arguments
- `parseSecuritySources` - Parses security source arguments
- `formatDriftLevel` - Formats drift level with colors
- `formatSecuritySeverity` - Formats security severity with colors
- `formatTimeAgo` - Formats time ago strings
- `processResults` - Processes and displays analysis results
- Core command handlers for commands like `analyze`, `compare`, etc.

## Test Approach

The tests follow these practices:

1. **Isolation**: All external dependencies (file system, process, etc.) are mocked
2. **Comprehensive Mocking**: The file system, stdout/stderr, and subprocess execution are all mocked
3. **Console Output Capture**: Console methods are mocked to capture and verify output
4. **Proper Cleanup**: All mocks are properly restored after tests
5. **Command Execution**: Tests for full command execution as well as individual function units

## Edge Cases Covered

- Missing or inaccessible configuration files
- Invalid command line arguments
- Conflicting option combinations
- Permission issues when writing output files
- Non-standard project structures
- Extremely long dependency names and paths
- Unicode characters in output
- Terminal width/height considerations
- Color support detection
- Process signal handling

## Integration Points

The CLI module interacts with several other systems that are mocked in these tests:

- **File System**: Mocked to simulate file operations
- **Process**: Mocked for environment variables and exit code handling
- **Core Analyzers**: Mocked to provide consistent analysis results
- **Formatters**: Tested for correct output generation in various formats

## Useful Information for Test Maintenance

1. The CLI tests use mock implementations for file system operations to avoid actual file changes
2. Tests use spy functions to verify that the correct functions are called with expected arguments
3. Terminal output is captured and analyzed using string matchers
4. Command execution is tested by direct function calls rather than spawning processes
5. Some tests may need to mock the terminal dimensions for consistent table formatting 