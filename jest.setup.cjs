/**
 * Jest setup file for the DepDrift project
 * 
 * This file is executed before each test file runs. It's used to set up
 * global configuration for all tests.
 */

// Set up the test environment
process.env.NODE_ENV = 'test';

// Set a longer timeout for the tests
jest.setTimeout(30000);

// Silence console.log during tests to keep output clean
// Comment this out if you need to debug with console.log
global.console.log = jest.fn();

// Enable debug logging only when needed
global.DEBUG = false;

// Add a global debug function
global.debug = (msg, ...args) => {
  console.log(`[DEBUG] ${msg}`, ...args);
};

// Reset all manual mocks before each test
beforeEach(() => {
  // Reset all mocks
  jest.resetModules();
  
  // Reset our manual mocks if they exist
  try {
    const fs = require('fs');
    if (fs.__resetMockData) fs.__resetMockData();
  } catch (err) {
    // Ignore if mock doesn't exist
  }
  
  try {
    const arborist = require('@npmcli/arborist');
    if (arborist.__resetConfig) arborist.__resetConfig();
  } catch (err) {
    // Ignore if mock doesn't exist
  }
  
  try {
    const lockFileDetector = require('../src/core/lockFileDetector.js');
    if (lockFileDetector.__resetMock) lockFileDetector.__resetMock();
  } catch (err) {
    // Ignore if mock doesn't exist
  }
});

// Silence console logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Restore console logs after tests
afterAll(() => {
  jest.restoreAllMocks();
}); 