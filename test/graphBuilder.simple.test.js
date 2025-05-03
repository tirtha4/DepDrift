/**
 * Functional tests for the graphBuilder module
 * These tests focus on the core functionality without complex mocking
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Create a mock function we can control
const mockDetectLockFiles = jest.fn().mockReturnValue({
  npm: false,
  yarn: false,
  pnpm: false
});
const mockGetPrimaryPackageManager = jest.fn().mockReturnValue('npm');

// Mock the lockFileDetector module
jest.mock('../src/core/lockFileDetector.js', () => ({
  detectLockFiles: () => mockDetectLockFiles(),
  getPrimaryPackageManager: () => mockGetPrimaryPackageManager()
}), { virtual: true });

import { buildGraphs } from '../src/core/graphBuilder.js';

// Helper for safe logging
const safeLog = (msg) => process.stdout.write(`${msg}\n`);

describe('GraphBuilder Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the lockFileDetector mocks
    mockDetectLockFiles.mockClear();
    mockDetectLockFiles.mockReturnValue({
      npm: false,
      yarn: false,
      pnpm: false
    });
    mockGetPrimaryPackageManager.mockClear();
    mockGetPrimaryPackageManager.mockReturnValue('npm');
    
    // Setup console mocks
    jest.spyOn(console, 'log').mockImplementation(safeLog);
    jest.spyOn(console, 'debug').mockImplementation((msg) => safeLog(`[DEBUG] ${msg}`));
    jest.spyOn(console, 'error').mockImplementation((msg) => safeLog(`[ERROR] ${msg}`));
    jest.spyOn(console, 'warn').mockImplementation((msg) => safeLog(`[WARN] ${msg}`));
    
    // Mock fs methods
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      safeLog(`[MOCK] existsSync called with: ${path}`);
      // By default, most paths exist except for package.json when we want to test the error path
      if (path === '/missing-project/package.json') {
        return false;
      }
      return true;
    });
    
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, options) => {
      safeLog(`[MOCK] readFileSync called with: ${path}`);
      // Return a mock package.json
      return JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'dependency-1': '^1.0.0'
        }
      });
    });
    
    jest.spyOn(fs, 'readdirSync').mockImplementation((path) => {
      safeLog(`[MOCK] readdirSync called with: ${path}`);
      return ['dependency-1'];
    });
    
    jest.spyOn(fs, 'statSync').mockImplementation((path) => {
      safeLog(`[MOCK] statSync called with: ${path}`);
      return {
        isDirectory: () => path.includes('node_modules'),
        isFile: () => path.includes('package.json'),
        mtime: { getTime: () => Date.now() }
      };
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should throw when package.json is missing', async () => {
    // Verify it throws as expected
    await expect(buildGraphs('/missing-project')).rejects.toThrow(/package\.json/);
  });
  
  it('should create dependency graph from package.json', async () => {
    // Run buildGraphs function - it will use package.json parsing
    // since the real Arborist will fail in the test environment
    const result = await buildGraphs('/test-project');
    
    // Verify the structure of the result
    expect(result).toBeDefined();
    expect(result.projectRoot).toBe('/test-project');
    expect(result.source).toBe('package.json');
    
    // Check that we have trees with the expected structure
    expect(result.idealTree).toBeDefined();
    expect(result.idealTree.name).toBe('test-project');
    expect(result.idealTree.version).toBe('1.0.0');
    expect(result.idealTree.edgesOut).toBeDefined();
    expect(result.idealTree.edgesOut['dependency-1']).toBeDefined();
    
    expect(result.actualTree).toBeDefined();
    expect(result.actualTree.name).toBe('test-project');
    expect(result.actualTree.version).toBe('1.0.0');
  });
  
  it('should cache and reuse tree results when useCache is enabled', async () => {
    // Mock fs.writeFileSync to track cache writes
    const writeFileSyncMock = jest.spyOn(fs, 'writeFileSync').mockImplementation((path, data) => {
      safeLog(`[MOCK] writeFileSync called with: ${path}`);
    });
    
    // First call should generate and save the cache
    const result1 = await buildGraphs('/test-project', { useCache: true });
    expect(result1.source).toBe('package.json');
    
    // For the second call, prepare a valid cache with a more recent timestamp
    // and proper structure to pass validation
    const cacheTime = Date.now() + 10000; // Future time to ensure it's newer than any file
    
    // Mock file timestamps to be older than cache
    jest.spyOn(fs, 'statSync').mockImplementation((path) => {
      safeLog(`[MOCK] statSync called with: ${path}`);
      return {
        isDirectory: () => path.includes('node_modules'),
        isFile: () => true,
        mtime: { getTime: () => cacheTime - 20000 } // Older than cache
      };
    });
    
    // Mock cache file content with valid structure
    jest.spyOn(fs, 'readFileSync').mockImplementation((path, options) => {
      safeLog(`[MOCK] readFileSync called with: ${path}`);
      if (path.endsWith('.depdrift-cache.json')) {
        return JSON.stringify({
          timestamp: cacheTime,
          idealTree: { name: 'cached-project', version: '1.0.0', edgesOut: {} },
          actualTree: { name: 'cached-project', version: '1.0.0', edgesOut: {} },
          lockFiles: {
            npm: false,
            yarn: false,
            pnpm: false
          }
        });
      }
      return JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: { 'dependency-1': '^1.0.0' }
      });
    });
    
    // Second call should use the cache
    const result2 = await buildGraphs('/test-project', { useCache: true });
    expect(result2.source).toBe('cache');
    expect(result2.idealTree.name).toBe('cached-project');
  });
}); 