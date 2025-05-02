/**
 * Jest setup file
 * 
 * This file runs before each test to set up the test environment.
 */

import { jest } from '@jest/globals';

// Set environment to test
process.env.NODE_ENV = 'test';

// Configure the test timeout
jest.setTimeout(30000);

// Enable debug only when needed
global.DEBUG = false;

// Add a debug helper function
global.debug = (message, ...args) => {
  if (global.DEBUG) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

// Silence console output during tests (comment out for debugging)
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
// Keep errors visible: 
// jest.spyOn(console, 'error').mockImplementation(() => {});

// Clean up after all tests are done
afterAll(() => {
  jest.restoreAllMocks();
}); 