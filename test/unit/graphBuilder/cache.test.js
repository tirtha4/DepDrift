/**
 * Cache functionality tests for the GraphBuilder module
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Mock modules before importing graphBuilder
jest.mock('@npmcli/arborist', () => {
  return {
    Arborist: jest.fn().mockImplementation(function() {
      return {
        loadVirtual: jest.fn(),
        loadActual: jest.fn()
      };
    })
  };
});

// Import after mocks are in place
import * as graphBuilder from '../../../src/core/graphBuilder.js';

// Constants for testing
const TEST_PROJECT_ROOT = '/test-project';
const CACHE_FILE_PATH = path.join(TEST_PROJECT_ROOT, '.depdrift-cache.json');

describe('GraphBuilder Module - Cache Functionality', () => {
  beforeEach(() => {
    // Clear and reset mocks before each test
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Mock console methods to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock filesystem methods with spies
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
    jest.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => true,
      isFile: () => true,
      mtime: { getTime: () => Date.now() }
    });
    
    // Mock Date.now to return a consistent timestamp for tests
    jest.spyOn(global.Date, 'now').mockImplementation(() => 1234567890);
  });
  
  afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });
  
  it('should use cache when useCache is true', async () => {
    // Set up package.json mock
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.includes('package.json')) {
        return JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'test-dep': '^1.0.0'
          }
        });
      }
      return '{}';
    });
    
    // Run buildGraphs with cache enabled
    await graphBuilder.buildGraphs(TEST_PROJECT_ROOT, { 
      useCache: true, 
      _testMode: true 
    });
    
    // Verify result - should try to save to cache
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
}); 