/**
 * Coverage-focused tests for the GraphBuilder module
 * 
 * These tests are specifically designed to increase code coverage by:
 * 1. Testing enhanceTreeWithDependencyTypes function
 * 2. Testing saveTreesToCache function
 * 3. Testing dependency tree processing
 * 4. Testing uncovered edge cases
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Mock the lockFileDetector module
jest.mock('../../../src/core/lockFileDetector.js', () => {
  return {
    detectLockFiles: jest.fn().mockReturnValue({
      npm: true,
      yarn: true,
      pnpm: true
    }),
    getPrimaryPackageManager: jest.fn().mockReturnValue('npm')
  };
}, { virtual: true });

// Import the functions we want to test
import { 
  enhanceTreeWithDependencyTypes, 
  saveTreesToCache, 
  buildGraphs
} from '../../../src/core/graphBuilder.js';

// Constants for testing
const TEST_PROJECT_ROOT = '/test-project';
const CACHE_FILE_PATH = path.join(TEST_PROJECT_ROOT, '.depdrift-cache.json');

describe('GraphBuilder Module - Coverage Tests', () => {
  // Mock console methods to avoid test output noise
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock Date.now() to return a consistent value
    jest.spyOn(Date, 'now').mockReturnValue(1746126396343);
    
    // Mock fs functions
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => 
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: { 'dep-1': '^1.0.0' },
        devDependencies: { 'dev-dep': '~2.0.0' },
        peerDependencies: { 'peer-dep': '3.x' },
        optionalDependencies: { 'opt-dep': '4.0.0' }
      })
    );
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({
      mtime: { getTime: () => Date.now() - 2000 },
      isDirectory: () => true,
      isFile: () => true
    }));
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['dependency-1', '@scoped']);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('enhanceTreeWithDependencyTypes', () => {
    it('should add dependency type information to nodes', () => {
      // Create a sample tree
      const tree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {
          'dep-1': {
            name: 'dep-1',
            type: 'dependencies',
            to: {
              name: 'dep-1',
              version: '1.0.0',
              edgesOut: {
                'nested-dep': {
                  name: 'nested-dep',
                  type: 'dependencies',
                  to: {
                    name: 'nested-dep',
                    version: '2.0.0',
                    edgesOut: {}
                  }
                }
              }
            }
          },
          'dev-dep': {
            name: 'dev-dep',
            type: 'devDependencies',
            to: {
              name: 'dev-dep',
              version: '1.0.0',
              edgesOut: {}
            }
          }
        }
      };
      
      // Call the function
      enhanceTreeWithDependencyTypes(tree);
      
      // Verify types are set
      expect(tree.dependencyType).toBe('dependencies');
      expect(tree.edgesOut['dep-1'].to.dependencyType).toBe('dependencies');
      expect(tree.edgesOut['dev-dep'].to.dependencyType).toBe('devDependencies');
      expect(tree.edgesOut['dep-1'].to.edgesOut['nested-dep'].to.dependencyType).toBe('dependencies');
    });
    
    it('should enforce maxDepth and clear edges beyond that depth', () => {
      // Create a sample tree with 3 levels of nesting
      const tree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {
          'dep-1': {
            name: 'dep-1',
            type: 'dependencies',
            to: {
              name: 'dep-1',
              version: '1.0.0',
              edgesOut: {
                'level-2': {
                  name: 'level-2',
                  type: 'dependencies',
                  to: {
                    name: 'level-2',
                    version: '1.0.0',
                    edgesOut: {
                      'level-3': {
                        name: 'level-3',
                        type: 'dependencies',
                        to: {
                          name: 'level-3',
                          version: '1.0.0',
                          edgesOut: {}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };
      
      // Apply with maxDepth=2
      enhanceTreeWithDependencyTypes(tree, 2);
      
      // Verify the structure - level 3 should be cleared
      expect(tree.edgesOut['dep-1'].to.edgesOut['level-2'].to.edgesOut).toEqual({});
    });
    
    it('should handle nodes with null edgesOut', () => {
      const tree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {
          'dep-1': {
            name: 'dep-1',
            type: 'dependencies',
            to: {
              name: 'dep-1',
              version: '1.0.0',
              // Missing edgesOut property
            }
          }
        }
      };
      
      // Should not throw an error
      expect(() => enhanceTreeWithDependencyTypes(tree)).not.toThrow();
    });
    
    it('should handle non-standard dependency types', () => {
      // Create a sample tree with non-standard dependency type
      const tree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {
          'bundle-dep': {
            name: 'bundle-dep',
            type: 'bundleDependencies',
            to: {
              name: 'bundle-dep',
              version: '1.0.0',
              edgesOut: {}
            }
          }
        }
      };
      
      // Call the function
      enhanceTreeWithDependencyTypes(tree);
      
      // Verify types are set
      expect(tree.dependencyType).toBe('dependencies');
      expect(tree.edgesOut['bundle-dep'].to.dependencyType).toBe('bundleDependencies');
    });
  });
  
  describe('saveTreesToCache', () => {
    beforeEach(() => {
      // Mock fs.writeFileSync
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    });
    
    it('should save the trees to a cache file', () => {
      // Create sample trees
      const idealTree = { name: 'ideal', version: '1.0.0', edgesOut: {} };
      const actualTree = { name: 'actual', version: '1.0.0', edgesOut: {} };
      
      // Call the function
      saveTreesToCache(CACHE_FILE_PATH, idealTree, actualTree);
      
      // Verify writeFileSync was called with the correct arguments
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      
      // Use a more flexible assertion that doesn't check the exact string
      const writeCallArg = fs.writeFileSync.mock.calls[0][1];
      const parsedCache = JSON.parse(writeCallArg);
      
      expect(parsedCache.timestamp).toBeDefined();
      expect(parsedCache.idealTree).toEqual(idealTree);
      expect(parsedCache.actualTree).toEqual(actualTree);
      expect(parsedCache.lockFilesObj).toBeDefined();
    });
    
    it('should handle write errors gracefully', () => {
      // Mock writeFileSync to throw an error
      fs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });
      
      const idealTree = { name: 'ideal', version: '1.0.0' };
      const actualTree = { name: 'actual', version: '1.0.0' };
      
      // Should not throw an error
      expect(() => saveTreesToCache(CACHE_FILE_PATH, idealTree, actualTree)).not.toThrow();
      
      // Verify console.warn was called
      expect(console.warn).toHaveBeenCalledWith(
        'Warning: failed to save cache to /test-project/.depdrift-cache.json: Permission denied'
      );
    });
    
    it('should handle trees that are simple objects', () => {
      // Use simple objects without edgesOut property
      const idealTree = { name: 'simple-tree' };
      const actualTree = { name: 'simple-tree' };
      
      // Should not throw an error
      expect(() => saveTreesToCache(CACHE_FILE_PATH, idealTree, actualTree)).not.toThrow();
      
      // Verify writeFileSync was called
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('buildGraphs', () => {
    // Mock the necessary functions for buildGraphs
    beforeEach(() => {
      // Mock file system for the test project
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('package.json')) return true;
        if (path.includes('node_modules')) return true;
        if (path.includes('package-lock.json')) return true;
        return false;
      });
      
      // Mock npm related functions
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
      }, { virtual: true });
    });
    
    it('should build graphs from package.json when cache is not available', async () => {
      // Mock no cache file
      fs.existsSync.mockImplementation((path) => {
        if (path.includes('.depdrift-cache.json')) return false;
        if (path.includes('package.json')) return true;
        if (path.includes('node_modules')) return true;
        return false;
      });
      
      const result = await buildGraphs(TEST_PROJECT_ROOT);
      
      expect(result).toBeDefined();
      expect(result.idealTree).toBeDefined();
      expect(result.actualTree).toBeDefined();
      expect(result.projectRoot).toBe(TEST_PROJECT_ROOT);
    });
    
    it('should handle file system errors when reading package.json', async () => {
      // Mock readFileSync to throw for package.json
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('File not readable');
      });
      
      await expect(buildGraphs(TEST_PROJECT_ROOT)).rejects.toThrow();
    });
    
    it('should handle invalid JSON in package.json', async () => {
      // Mock readFileSync to return invalid JSON
      fs.readFileSync.mockImplementationOnce(() => 'not valid json');
      
      await expect(buildGraphs(TEST_PROJECT_ROOT)).rejects.toThrow();
    });
    
    it('should process scoped packages in node_modules', async () => {
      // Mock readdirSync for scoped packages
      fs.readdirSync
        .mockImplementationOnce(() => ['dependency-1', '@scoped'])
        .mockImplementationOnce(() => ['scoped-pkg-1', 'scoped-pkg-2']);
      
      const result = await buildGraphs(TEST_PROJECT_ROOT);
      
      expect(result).toBeDefined();
      expect(result.idealTree).toBeDefined();
      expect(result.actualTree).toBeDefined();
    });
    
    it('should handle errors when reading node_modules directory', async () => {
      // Mock readdirSync to throw for node_modules
      fs.readdirSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });
      
      const result = await buildGraphs(TEST_PROJECT_ROOT);
      
      // Should still return a valid result even with node_modules errors
      expect(result).toBeDefined();
      expect(result.idealTree).toBeDefined();
      expect(result.actualTree).toBeDefined();
    });
  });
}); 