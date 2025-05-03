export default {
  // Use --experimental-vm-modules with Node for ESM support
  testEnvironment: "node",
  transform: {},
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Root directories for module resolution
  roots: ['<rootDir>'],
  
  // Mock setup files - use CJS version for compatibility
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  
  // Handle module name mapping directly
  moduleNameMapper: {
    // Map src modules to their mock implementations
    "^src/core/(.*)": "<rootDir>/src/core/$1",
    "^src/utils/(.*)": "<rootDir>/src/utils/$1",
    "^src/formatters/(.*)": "<rootDir>/src/formatters/$1"
  },
  
  // Set up coverage collection
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/node_modules/**"
  ],
  coverageReporters: ["text", "lcov"],
  
  // Temporarily disable coverage thresholds for development
  coverageThreshold: null,
  
  // Test timeout
  testTimeout: 10000
}; 