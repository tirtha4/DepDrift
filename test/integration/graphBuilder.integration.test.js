/**
 * Integration tests for the GraphBuilder module
 * 
 * These tests verify that GraphBuilder integrates correctly with:
 * - Package.json parsing
 * - Dependency graph structure
 * - Caching system
 * 
 * This uses a mocked filesystem approach for reliability and isolation
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { buildGraphs } from '../../src/core/graphBuilder.js';

// Store original implementations for restoration after tests
let originalExistsSync;
let originalReadFileSync;
let originalWriteFileSync;
let originalStatSync;
let originalMkdirSync;

// Test project path
const TEST_PROJECT = '/test-project';
const NODE_MODULES = path.join(TEST_PROJECT, 'node_modules');
const PACKAGE_JSON_PATH = path.join(TEST_PROJECT, 'package.json');
const CACHE_FILE_PATH = path.join(TEST_PROJECT, '.depdrift-cache.json');

// Test package.json content
const TEST_PACKAGE_JSON = {
  name: 'test-project',
  version: '1.0.0',
  dependencies: {
    'lodash': '^4.17.21',
    'chalk': '^4.1.2',
    'jest': '^29.0.0'
  }
};

// Mock filesystem state
const mockFiles = {};

// Mock fs functions
function mockFileSystem() {
  // Initialize with test package.json
  mockFiles[PACKAGE_JSON_PATH] = JSON.stringify(TEST_PACKAGE_JSON, null, 2);
  
  // Create virtual structure for node_modules
  const deps = {
    'lodash': '4.17.21',
    'chalk': '4.1.2',
    'jest': '29.0.0'
  };
  
  // Create mock package.json files for dependencies
  for (const [name, version] of Object.entries(deps)) {
    const depPackagePath = path.join(NODE_MODULES, name, 'package.json');
    const depPackage = {
      name,
      version,
      dependencies: {}
    };
    
    // Add nested dependencies for chalk
    if (name === 'chalk') {
      depPackage.dependencies = {
        'ansi-styles': '^4.3.0',
        'supports-color': '^7.2.0'
      };
      
      // Add nested deps package.json files
      mockFiles[path.join(NODE_MODULES, name, 'node_modules', 'ansi-styles', 'package.json')] = 
        JSON.stringify({ name: 'ansi-styles', version: '4.3.0' }, null, 2);
      
      mockFiles[path.join(NODE_MODULES, name, 'node_modules', 'supports-color', 'package.json')] = 
        JSON.stringify({ name: 'supports-color', version: '7.2.0' }, null, 2);
    }
    
    mockFiles[depPackagePath] = JSON.stringify(depPackage, null, 2);
  }
  
  // Mock existsSync to check against our virtual filesystem
  jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
    // When checking for the package.json file, always return true
    // This ensures the code won't skip to the built-in test mode package.json
    if (filepath === PACKAGE_JSON_PATH) {
      return true;
    }
    
    return filepath in mockFiles || 
      // Also return true for directories
      Object.keys(mockFiles).some(file => file.startsWith(filepath + '/'));
  });
  
  // Mock readFileSync to return content from our virtual filesystem
  jest.spyOn(fs, 'readFileSync').mockImplementation((filepath, encoding) => {
    // When reading the package.json file, always return our test content
    // This bypasses the built-in test mode package.json
    if (filepath === PACKAGE_JSON_PATH) {
      return JSON.stringify(TEST_PACKAGE_JSON);
    }
    
    if (!(filepath in mockFiles)) {
      throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
    }
    return mockFiles[filepath];
  });
  
  // Mock writeFileSync to update our virtual filesystem
  jest.spyOn(fs, 'writeFileSync').mockImplementation((filepath, content) => {
    mockFiles[filepath] = content;
    return undefined;
  });
  
  // Mock readdirSync to return directory contents from our virtual filesystem
  jest.spyOn(fs, 'readdirSync').mockImplementation(dirPath => {
    // Normalize the directory path to ensure consistent comparison
    const normalizedDirPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    
    // Get all files that are in this directory
    const filesInDir = Object.keys(mockFiles)
      .filter(file => file.startsWith(normalizedDirPath))
      .map(file => {
        // Extract the immediate child name
        const relativePath = file.substring(normalizedDirPath.length);
        const firstSegment = relativePath.split('/')[0];
        return firstSegment;
      })
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    return filesInDir;
  });
  
  // Mock statSync to determine if a path is a directory
  jest.spyOn(fs, 'statSync').mockImplementation(filepath => {
    // For the node_modules directory, always return true for isDirectory
    if (filepath === NODE_MODULES) {
      return {
        isDirectory: () => true,
        mtime: new Date()
      };
    }
    
    const isDirectory = !mockFiles[filepath] && 
      Object.keys(mockFiles).some(file => file.startsWith(filepath + '/'));
    
    return {
      isDirectory: () => isDirectory,
      mtime: new Date()
    };
  });
  
  // Mock lstatSync similar to statSync
  jest.spyOn(fs, 'lstatSync').mockImplementation(filepath => {
    return fs.statSync(filepath);
  });
  
  // Mock unlink to remove from our virtual filesystem
  jest.spyOn(fs, 'unlinkSync').mockImplementation(filepath => {
    if (filepath in mockFiles) {
      delete mockFiles[filepath];
    }
    return undefined;
  });
  
  // Mock rmdir to remove directory and its contents
  jest.spyOn(fs, 'rmdirSync').mockImplementation((dirpath, options) => {
    // If recursive option is true, remove all files in the directory
    if (options && options.recursive) {
      Object.keys(mockFiles).forEach(filepath => {
        if (filepath.startsWith(dirpath + '/')) {
          delete mockFiles[filepath];
        }
      });
    }
    return undefined;
  });
  
  // Mock JSON.parse to handle our invalid JSON test case
  const originalJsonParse = JSON.parse;
  jest.spyOn(JSON, 'parse').mockImplementation((content) => {
    if (content === 'This is not valid JSON { broken') {
      throw new SyntaxError('Unexpected token T in JSON at position 0');
    }
    return originalJsonParse(content);
  });
}

// Helper function for asserting that graph result has basic properties
function validateGraphResult(result) {
  expect(result).toBeDefined();
  expect(result.idealTree).toBeDefined();
  expect(result.actualTree).toBeDefined();
  expect(result.projectRoot).toBe(TEST_PROJECT);
}

describe('GraphBuilder Module - Integration Tests', () => {
  // Store original implementations and set up mocks before all tests
  beforeAll(() => {
    // Store original function references
    originalExistsSync = fs.existsSync;
    originalReadFileSync = fs.readFileSync;
    originalWriteFileSync = fs.writeFileSync;
    originalStatSync = fs.statSync;
    originalMkdirSync = fs.mkdirSync;
    
    // Set up mock filesystem
    mockFileSystem();
    
    // Additional setup: mock console methods to reduce test output noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });
  
  // Restore original implementations after all tests
  afterAll(() => {
    // Restore original functions
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
    fs.writeFileSync = originalWriteFileSync;
    fs.statSync = originalStatSync;
    fs.mkdirSync = originalMkdirSync;
    
    // Clear all mocks
    jest.restoreAllMocks();
  });
  
  beforeEach(() => {
    // Reset mock implementations for this test
    jest.clearAllMocks();
    
    // Reset mock files to original state
    Object.keys(mockFiles).forEach(key => {
      if (!key.startsWith(NODE_MODULES) && key !== PACKAGE_JSON_PATH) {
        delete mockFiles[key];
      }
    });
    
    // Reset package.json to original content
    mockFiles[PACKAGE_JSON_PATH] = JSON.stringify(TEST_PACKAGE_JSON, null, 2);
  });
  
  it('should build dependency graphs from package.json', async () => {
    // Build graphs using mocked file system - don't use test mode
    const result = await buildGraphs(TEST_PROJECT);
    
    // Basic structure validation
    validateGraphResult(result);
    
    // Verify root dependencies exist
    expect(result.idealTree.edgesOut['lodash']).toBeDefined();
    expect(result.idealTree.edgesOut['chalk']).toBeDefined();
    expect(result.idealTree.edgesOut['jest']).toBeDefined();
    
    // Verify dependency properties
    expect(result.idealTree.edgesOut['lodash']).toBeDefined();
    expect(result.idealTree.edgesOut['lodash'].type).toBe('dependencies');
    expect(result.idealTree.edgesOut['lodash'].spec).toBe('^4.17.21');
    
    expect(result.idealTree.edgesOut['jest']).toBeDefined();
    expect(result.idealTree.edgesOut['jest'].type).toBe('dependencies');
    
    // Verify dependency versions
    const lodashNode = result.idealTree.edgesOut['lodash'].to;
    expect(lodashNode).toBeDefined();
    expect(lodashNode.version).toBe('^4.17.21');
    
    // Check correct type assignment
    expect(lodashNode.dependencyType).toBe('dependencies');
  });
  
  it('should respect maxDepth parameter with dependencies', async () => {
    // Build graphs with maxDepth=1 - don't use test mode
    const result = await buildGraphs(TEST_PROJECT, { maxDepth: 1 });
    
    // Basic structure validation
    validateGraphResult(result);
    
    // Verify root dependencies exist
    expect(result.idealTree.edgesOut['lodash']).toBeDefined();
    expect(result.idealTree.edgesOut['chalk']).toBeDefined();
    expect(result.idealTree.edgesOut['jest']).toBeDefined();
    
    // Chalk node should exist but have empty edgesOut due to maxDepth
    const chalkEdge = result.idealTree.edgesOut['chalk'];
    expect(chalkEdge).toBeDefined();
    expect(chalkEdge.to).toBeDefined();
    
    // Check that edges are limited by maxDepth
    const chalkNode = chalkEdge.to;
    expect(chalkNode.edgesOut).toEqual({});
  });
  
  it('should create and use cache file when enabled', async () => {
    // Build with cache enabled - don't use test mode
    const firstResult = await buildGraphs(TEST_PROJECT, { useCache: true });
    
    // Basic structure validation
    validateGraphResult(firstResult);
    
    // Verify cache file was created
    expect(CACHE_FILE_PATH in mockFiles).toBe(true);
    
    // Cache file should be valid JSON
    const cacheContent = JSON.parse(mockFiles[CACHE_FILE_PATH]);
    expect(cacheContent).toBeDefined();
    expect(cacheContent.idealTree).toBeDefined();
    expect(cacheContent.actualTree).toBeDefined();
    
    // Now modify the package.json content directly for the new dependency
    const modifiedPackageJson = {
      ...TEST_PACKAGE_JSON,
      dependencies: {
        ...TEST_PACKAGE_JSON.dependencies,
        'new-dep': '^1.0.0'
      }
    };
    
    // Update the readFileSync mock specifically for package.json
    jest.spyOn(fs, 'readFileSync').mockImplementation((filepath, encoding) => {
      if (filepath === PACKAGE_JSON_PATH) {
        return JSON.stringify(modifiedPackageJson);
      }
      
      if (!(filepath in mockFiles)) {
        throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
      }
      return mockFiles[filepath];
    });
    
    // Mock the package.json for the new dependency
    mockFiles[path.join(NODE_MODULES, 'new-dep', 'package.json')] = 
      JSON.stringify({ name: 'new-dep', version: '1.0.0' }, null, 2);
    
    // Should rebuild due to changed package.json
    const secondResult = await buildGraphs(TEST_PROJECT, { useCache: true });
    
    // New dependency should be in the result
    expect(secondResult.idealTree.edgesOut['new-dep']).toBeDefined();
  });
  
  it('should respect forceRefresh parameter', async () => {
    // First build with cache enabled - don't use test mode
    await buildGraphs(TEST_PROJECT, { useCache: true });
    
    // Cache file should exist
    expect(CACHE_FILE_PATH in mockFiles).toBe(true);
    
    // Get the original cache content for comparison
    const originalCacheContent = mockFiles[CACHE_FILE_PATH];
    
    // Wait a moment to ensure timestamps would be different
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Force refresh with cache enabled
    await buildGraphs(TEST_PROJECT, { useCache: true, forceRefresh: true });
    
    // Cache should be updated (different content)
    expect(mockFiles[CACHE_FILE_PATH]).not.toBe(originalCacheContent);
  });
  
  it('should handle malformed package.json gracefully', async () => {
    // Create an invalid JSON string
    const invalidJson = 'This is not valid JSON { broken';
    
    // Override readFileSync for this test to return invalid JSON
    jest.spyOn(fs, 'readFileSync').mockImplementation((filepath, encoding) => {
      if (filepath === PACKAGE_JSON_PATH) {
        return invalidJson;
      }
      
      if (!(filepath in mockFiles)) {
        throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
      }
      return mockFiles[filepath];
    });
    
    // Should throw with helpful error about parsing
    await expect(buildGraphs(TEST_PROJECT)).rejects.toThrow(/parse|unexpected/i);
  });
  
  it('should report correct dependency types based on package.json sections', async () => {
    // Create a modified package.json with different dependency types
    const modifiedPackageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      },
      devDependencies: {
        'jest': '^29.0.0'
      },
      peerDependencies: {
        'peer-dep': '^1.0.0'
      },
      optionalDependencies: {
        'optional-dep': '^2.0.0'
      }
    };
    
    // Override readFileSync for this test to return the modified package.json
    jest.spyOn(fs, 'readFileSync').mockImplementation((filepath, encoding) => {
      if (filepath === PACKAGE_JSON_PATH) {
        return JSON.stringify(modifiedPackageJson);
      }
      
      if (!(filepath in mockFiles)) {
        throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
      }
      return mockFiles[filepath];
    });
    
    // Add mock package.json files for the new dependencies
    mockFiles[path.join(NODE_MODULES, 'peer-dep', 'package.json')] = 
      JSON.stringify({ name: 'peer-dep', version: '1.0.0' }, null, 2);
    
    mockFiles[path.join(NODE_MODULES, 'optional-dep', 'package.json')] = 
      JSON.stringify({ name: 'optional-dep', version: '2.0.0' }, null, 2);
    
    // Build graphs - don't use test mode
    const result = await buildGraphs(TEST_PROJECT);
    
    // Basic structure validation
    validateGraphResult(result);
    
    // Verify dependency types
    expect(result.idealTree.edgesOut['lodash'].type).toBe('dependencies');
    expect(result.idealTree.edgesOut['jest'].type).toBe('devDependencies');
    expect(result.idealTree.edgesOut['peer-dep'].type).toBe('peerDependencies');
    expect(result.idealTree.edgesOut['optional-dep'].type).toBe('optionalDependencies');
  });
}); 