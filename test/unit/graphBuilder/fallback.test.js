/**
 * Fallback behavior tests for the GraphBuilder module
 * 
 * These tests focus on the Arborist integration and fallback behavior:
 * - Using Arborist when available
 * - Falling back to package.json when Arborist fails
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Mock the Arborist module before importing graphBuilder
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

describe('GraphBuilder Module - Fallback Functionality', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock fs methods using jest spy instead of direct replacement
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { 'dependency-1': '^1.0.0' },
      devDependencies: { 'dev-dep': '^1.0.0' }
    }));
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['dependency-1']);
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({
      isDirectory: () => true,
      isFile: () => true,
      mtime: { getTime: () => Date.now() }
    }));
    
    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1645123456789);
  });
  
  afterEach(() => {
    // Restore all mocks after each test
    jest.restoreAllMocks();
  });
  
  it('should fall back to package.json when necessary', async () => {
    // The test doesn't need to actually mock loadVirtual/loadActual
    // since those will be undefined and the code will fall back
    
    const result = await graphBuilder.buildGraphs('/test-project', { _testMode: true });
    
    // Verify the fallback worked
    expect(result.source).toBe('package.json');
    expect(result.idealTree.name).toBe('test-project');
    expect(result.idealTree.version).toBe('1.0.0');
    expect(Object.keys(result.idealTree.edgesOut)).toContain('dependency-1');
    expect(Object.keys(result.idealTree.edgesOut)).toContain('dev-dep');
  });
  
  it('should handle missing package.json', async () => {
    // Simulate missing package.json
    fs.existsSync.mockImplementation(path => {
      return !path.includes('package.json');
    });
    
    // Verify it throws
    await expect(graphBuilder.buildGraphs('/test-project')).rejects.toThrow('Package.json not found');
  });
  
  it('should handle malformed package.json', async () => {
    // Simulate corrupted JSON
    fs.readFileSync.mockImplementation(() => 'not valid json');
    
    // First disable test mode to ensure we're actually reading the file
    await expect(graphBuilder.buildGraphs('/test-project')).rejects.toThrow();
  });
  
  it('should handle missing node_modules', async () => {
    // Simulate missing node_modules
    fs.existsSync.mockImplementation(path => {
      if (path.includes('node_modules')) {
        return false;
      }
      return true;
    });
    
    const result = await graphBuilder.buildGraphs('/test-project', { _testMode: true });
    
    // Should still return a result, just without actual tree dependencies
    expect(result.source).toBe('package.json');
    expect(result.actualTree).toBeDefined();
    expect(Object.keys(result.actualTree.edgesOut).length).toBe(0);
  });
}); 