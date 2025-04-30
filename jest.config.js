/**
 * Jest configuration file for DepDrift
 */
export default {
  // The root directory containing tests
  roots: ['<rootDir>/test/'],
  
  // The test environment
  testEnvironment: 'node',
  
  // The file extensions to look for
  moduleFileExtensions: ['js', 'json'],
  
  // The pattern to find test files
  testMatch: ["**/test/**/*.test.js"],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/test/fixtures/'
  ],
  
  // Collect coverage information
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**'
  ],
  
  // Coverage output format
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Set coverage thresholds to start with reasonable goals
  coverageThreshold: {
    global: {
      branches: 2,
      functions: 2,
      lines: 5,
      statements: 5
    }
  },
  
  // Add test environment setup file
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // Verbose test output
  verbose: true,
  
  // Clear the console before each test run
  clearMocks: true,
  
  // The directory to store coverage reports
  coverageDirectory: 'coverage',
  
  // Configure to work with ES Modules
  transform: {},
  extensionsToTreatAsEsm: ['.js']
}; 