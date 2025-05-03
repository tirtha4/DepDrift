/**
 * Edge case tests for the GraphBuilder module
 * 
 * These tests focus on unusual or edge cases:
 * - Invalid JSON
 * - Incomplete or malformed data
 * - Missing directories
 * - Special characters in paths
 * - Extremely large dependency trees
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { buildGraphs } from '../../../src/core/graphBuilder.js';

// Helper for safe logging
const safeLog = (msg) => process.stdout.write(`${msg}\n`);

describe('GraphBuilder Module - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup console mocks
    jest.spyOn(console, 'log').mockImplementation(safeLog);
    jest.spyOn(console, 'debug').mockImplementation((msg) => safeLog(`[DEBUG] ${msg}`));
    jest.spyOn(console, 'error').mockImplementation((msg) => safeLog(`[ERROR] ${msg}`));
    jest.spyOn(console, 'warn').mockImplementation((msg) => safeLog(`[WARN] ${msg}`));
    
    // Default mock implementations
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => 
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'dependency-1': '^1.0.0'
        }
      })
    );
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['dependency-1']);
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({
      isDirectory: () => true,
      isFile: () => true,
      mtime: { getTime: () => Date.now() }
    }));
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should handle invalid JSON in package.json', async () => {
    // Setup invalid JSON
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => 
      'This is not valid JSON { broken: true'
    );
    
    // Verify it throws with the expected message
    await expect(buildGraphs('/test-project')).rejects.toThrow(/parse/i);
  });
  
  it('should handle missing node_modules directory', async () => {
    // Mock node_modules not existing
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      if (path.includes('node_modules')) return false;
      return true;
    });
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify it still builds the ideal tree but has empty actual tree
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.idealTree.edgesOut['dependency-1']).toBeDefined();
    expect(result.actualTree).toBeDefined();
    expect(Object.keys(result.actualTree.edgesOut).length).toBe(0);
  });
  
  it('should handle node_modules directory with no subdirectories', async () => {
    // Mock node_modules existing but empty
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => []);
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify it builds the ideal tree but has empty actual tree
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.idealTree.edgesOut['dependency-1']).toBeDefined();
    expect(result.actualTree).toBeDefined();
    expect(Object.keys(result.actualTree.edgesOut).length).toBe(0);
  });
  
  it('should handle scoped packages correctly', async () => {
    // Mock package.json with scoped packages
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => 
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          '@scope/package-1': '^1.0.0',
          '@another-scope/package-2': '2.0.0'
        }
      })
    );
    
    // Mock node_modules with scopes
    jest.spyOn(fs, 'readdirSync').mockImplementation((path) => {
      if (path.endsWith('node_modules')) {
        return ['@scope', '@another-scope'];
      }
      if (path.includes('@scope')) {
        return ['package-1'];
      }
      if (path.includes('@another-scope')) {
        return ['package-2'];
      }
      return [];
    });
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify scoped packages are processed correctly
    expect(result.idealTree.edgesOut['@scope/package-1']).toBeDefined();
    expect(result.idealTree.edgesOut['@scope/package-1'].spec).toBe('^1.0.0');
    expect(result.idealTree.edgesOut['@another-scope/package-2']).toBeDefined();
    expect(result.idealTree.edgesOut['@another-scope/package-2'].spec).toBe('2.0.0');
  });
  
  it('should handle paths with special characters', async () => {
    // Path with special characters
    const specialPath = '/test project/with spaces & symbols!';
    
    // Run buildGraphs with special path
    const result = await buildGraphs(specialPath);
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.projectRoot).toBe(specialPath);
  });
  
  it('should handle errors when reading node_modules contents', async () => {
    // Mock readdirSync to throw an error
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify it still builds the ideal tree but has empty actual tree
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.idealTree.edgesOut['dependency-1']).toBeDefined();
    expect(result.actualTree).toBeDefined();
    expect(Object.keys(result.actualTree.edgesOut).length).toBe(0);
    
    // There should be an error recorded in the result
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });
  
  it('should handle missing package.json in node_modules packages', async () => {
    // Mock existsSync to make node_modules packages have no package.json
    jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      if (path.includes('node_modules') && path.endsWith('package.json')) return false;
      return true;
    });
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.idealTree).toBeDefined();
    expect(result.actualTree).toBeDefined();
    expect(Object.keys(result.actualTree.edgesOut).length).toBe(0);
  });
  
  it('should handle circular dependencies in package.json', async () => {
    // Mock package.json with circular dependencies
    jest.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path.endsWith('package.json')) {
        // Main package depends on circular-a
        return JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'circular-a': '^1.0.0'
          }
        });
      }
      
      // circular-a depends on circular-b
      if (path.includes('circular-a/package.json')) {
        return JSON.stringify({
          name: 'circular-a',
          version: '1.0.0',
          dependencies: {
            'circular-b': '^1.0.0'
          }
        });
      }
      
      // circular-b depends on circular-a
      if (path.includes('circular-b/package.json')) {
        return JSON.stringify({
          name: 'circular-b',
          version: '1.0.0',
          dependencies: {
            'circular-a': '^1.0.0'
          }
        });
      }
      
      return '{}';
    });
    
    // Mock node_modules structure
    jest.spyOn(fs, 'readdirSync').mockImplementation((path) => {
      if (path.endsWith('node_modules')) {
        return ['circular-a', 'circular-b'];
      }
      return [];
    });
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify circular dependencies are processed without infinite recursion
    expect(result).toBeDefined();
    expect(result.idealTree.edgesOut['circular-a']).toBeDefined();
  });
  
  it('should handle extremely large dependency trees', async () => {
    // Create a large tree with many dependencies
    const largeDeps = {};
    const numDeps = 500;
    
    for (let i = 1; i <= numDeps; i++) {
      largeDeps[`dependency-${i}`] = `^1.0.0`;
    }
    
    // Mock package.json with large dependency list
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => 
      JSON.stringify({
        name: 'large-project',
        version: '1.0.0',
        dependencies: largeDeps
      })
    );
    
    // Mock node_modules to have many directories
    const largeList = Array.from({ length: numDeps }, (_, i) => `dependency-${i + 1}`);
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => largeList);
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify large tree is processed correctly
    expect(result).toBeDefined();
    expect(result.idealTree.edgesOut).toBeDefined();
    expect(Object.keys(result.idealTree.edgesOut).length).toBe(numDeps);
  });
  
  it('should handle empty files in node_modules', async () => {
    // Mock readdirSync to include a file
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['dependency-1', 'some-file.txt']);
    
    // Mock statSync to identify some-file.txt as a file
    jest.spyOn(fs, 'statSync').mockImplementation((path) => ({
      isDirectory: () => !path.includes('some-file.txt'),
      isFile: () => path.includes('some-file.txt'),
      mtime: { getTime: () => Date.now() }
    }));
    
    // Run buildGraphs
    const result = await buildGraphs('/test-project');
    
    // Verify it only processes directories
    expect(result).toBeDefined();
    expect(result.actualTree.edgesOut).toBeDefined();
    expect(Object.keys(result.actualTree.edgesOut)).not.toContain('some-file.txt');
  });
}); 