/**
 * Jest setup file
 * 
 * This file runs before each test to set up the test environment.
 */

// Set environment to test
process.env.NODE_ENV = 'test';

// Enable debug only when needed
global.DEBUG = false;

// Add a debug helper function
global.debug = (message, ...args) => {
  if (global.DEBUG) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

// Configure Jest if used in CommonJS context
if (typeof jest !== 'undefined') {
  // Configure the test timeout
  jest.setTimeout(30000);

  // Silence console output during tests (comment out for debugging)
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // Keep errors visible: 
  // jest.spyOn(console, 'error').mockImplementation(() => {});
}

module.exports = {}; 