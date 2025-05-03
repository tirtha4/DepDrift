/**
 * Basic tests for the graphBuilder module
 * 
 * These tests verify the fundamental functionality of the graphBuilder
 * module, focusing on the happy path and basic error cases.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { buildGraphs } from '../../../src/core/graphBuilder.js';

// Create mock file system state
const mockFs = {
  fileExists: {
    '/path/to/test-project/package.json': true,
    '/path/to/test-project/node_modules': true
  },
  fileContents: {
    '/path/to/test-project/package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { 'dependency-1': '1.0.0' }
    })
  },
  directories: {
    '/path/to/test-project/node_modules': ['dependency-1', 'dependency-2']
  }
};

// Mock modules at the top level
jest.mock('fs', () => {
  const existsSyncMock = jest.fn(path => {
    // Default behavior - check our mock filesystem state
    return mockFs.fileExists[path] || false;
  });
  
  const readFileSyncMock = jest.fn(path => {
    if (mockFs.fileContents[path]) {
      return mockFs.fileContents[path];
    }
    throw new Error(`Mock file not found: ${path}`);
  });
  
  const readdirSyncMock = jest.fn(path => {
    if (mockFs.directories[path]) {
      return mockFs.directories[path];
    }
    throw new Error(`Mock directory not found: ${path}`);
  });
  
  const statSyncMock = jest.fn(() => ({
    isDirectory: () => true,
    isFile: () => true,
    mtime: { getTime: () => Date.now() }
  }));
  
  return {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
    readdirSync: readdirSyncMock,
    statSync: statSyncMock
  };
});

// Mock the @npmcli/arborist module
jest.mock('@npmcli/arborist', () => {
  return {
    Arborist: jest.fn().mockImplementation(() => {
      return {
        loadVirtual: jest.fn().mockResolvedValue({
          name: 'test',
          version: '1.0.0',
          edgesOut: {}
        })
      };
    })
  };
});

// Import fs after mocking it
import fs from 'fs';

describe('GraphBuilder Module - Basic Functionality', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Reset the mock filesystem to defaults
    mockFs.fileExists = {
      '/path/to/test-project/package.json': true,
      '/path/to/test-project/node_modules': true
    };
    
    mockFs.fileContents = {
      '/path/to/test-project/package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: { 'dependency-1': '1.0.0' }
      })
    };
    
    mockFs.directories = {
      '/path/to/test-project/node_modules': ['dependency-1', 'dependency-2']
    };
  });
  
  test('should throw when package.json is missing', async () => {
    // Set up the test case to throw an error for a missing project path
    const missingProjectRoot = '/missing-project';
    
    // Expect the function to throw an error
    await expect(buildGraphs(missingProjectRoot)).rejects.toThrow(/package\.json/);
  });
  
  test('should create dependency graph with only dependencies', async () => {
    // Set up mock to return package.json with only dependencies
    mockFs.fileContents['/path/to/test-project/package.json'] = JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { 'dependency-1': '1.0.0' }
    });
    
    const result = await buildGraphs('/path/to/test-project');
    
    // Verify the result has the expected structure
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.actualTree).toBeDefined();
    expect(result.projectRoot).toBe('/path/to/test-project');
  });
  
  test('should handle multiple dependency types correctly', async () => {
    // Set up mock to return package.json with multiple dependency types
    mockFs.fileContents['/path/to/test-project/package.json'] = JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { 'dependency-1': '1.0.0' },
      devDependencies: { 'dev-dependency-1': '2.0.0' },
      peerDependencies: { 'peer-dependency-1': '3.0.0' },
      optionalDependencies: { 'optional-dependency-1': '4.0.0' }
    });
    
    const result = await buildGraphs('/path/to/test-project');
    
    // Verify the result has the expected structure
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.actualTree).toBeDefined();
  });
  
  test('should handle package.json with no dependencies', async () => {
    // Set up mock to return package.json with no dependencies
    mockFs.fileContents['/path/to/test-project/package.json'] = JSON.stringify({
      name: 'test-project',
      version: '1.0.0'
    });
    
    const result = await buildGraphs('/path/to/test-project');
    
    // Verify the result has the expected structure
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.actualTree).toBeDefined();
  });
  
  test('should handle package.json with empty dependencies object', async () => {
    // Set up mock to return package.json with empty dependencies
    mockFs.fileContents['/path/to/test-project/package.json'] = JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });
    
    const result = await buildGraphs('/path/to/test-project');
    
    // Verify the result has the expected structure
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.actualTree).toBeDefined();
  });
  
  test('should handle missing name or version in package.json', async () => {
    // Set up mock to return package.json with missing name and version
    mockFs.fileContents['/path/to/test-project/package.json'] = JSON.stringify({
      dependencies: { 'dependency-1': '1.0.0' }
    });
    
    const result = await buildGraphs('/path/to/test-project');
    
    // Verify the result has the expected structure with defaults
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.actualTree).toBeDefined();
  });
}); 