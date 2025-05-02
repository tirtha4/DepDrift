/**
 * Jest configuration
 * 
 * This configuration is designed to work with ES Modules.
 */

export default {
  // Test environment
  testEnvironment: 'node',
  
  // Display individual test results
  verbose: true,
  
  // Support ES Modules - .js is inferred from package.json type
  transform: {},
  
  // Test matching pattern
  testMatch: ['**/test/**/*.test.js'],
  
  // Collect coverage information
  collectCoverage: false,
  
  // Setup file to run before tests
  setupFilesAfterEnv: ['./jest.setup.js'],
  
  // Global variables available in tests
  globals: {
    '__DEV__': true
  }
}; 