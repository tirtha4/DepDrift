/**
 * Basic tests for the driftAnalyzer module
 * Tests basic functionality of classifyVersionDifference, flattenTree, and analyzeDrift
 */

import { jest } from '@jest/globals';
import * as semver from 'semver';
import { analyzeDrift, flattenTree, classifyVersionDifference } from '../../../src/analyzers/driftAnalyzer.js';

// Mock semver
jest.mock('semver', () => {
  // Store original implementation
  const originalSemver = jest.requireActual('semver');
  
  return {
    ...originalSemver,
    satisfies: jest.fn().mockImplementation(originalSemver.satisfies),
    validRange: jest.fn().mockImplementation(originalSemver.validRange),
    valid: jest.fn().mockImplementation(originalSemver.valid),
    coerce: jest.fn().mockImplementation(originalSemver.coerce),
    maxSatisfying: jest.fn().mockImplementation(originalSemver.maxSatisfying),
    major: jest.fn().mockImplementation(originalSemver.major),
    minor: jest.fn().mockImplementation(originalSemver.minor),
    patch: jest.fn().mockImplementation(originalSemver.patch),
    parse: jest.fn().mockImplementation(originalSemver.parse),
    clean: jest.fn().mockImplementation(originalSemver.clean)
  };
});

// Store original implementations to restore after tests
let originalConsoleWarn;

describe('DriftAnalyzer Module - Basic Functionality', () => {
  // Setup and teardown for all tests
  beforeAll(() => {
    // Store original console methods
    originalConsoleWarn = console.warn;
    
    // Mock console methods to prevent output during tests
    console.warn = jest.fn();
  });
  
  afterAll(() => {
    // Restore original console methods
    console.warn = originalConsoleWarn;
  });
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });
  
  describe('classifyVersionDifference', () => {
    it('should classify version as safe when versions match exactly', () => {
      const result = classifyVersionDifference('1.0.0', '1.0.0');
      expect(result).toBe('safe');
    });
    
    it('should classify version as safe for patch-level changes', () => {
      const result = classifyVersionDifference('1.0.0', '1.0.1');
      expect(result).toBe('safe');
    });
    
    it('should classify version as safe when satisfying a range', () => {
      const result = classifyVersionDifference('^1.0.0', '1.1.0');
      expect(result).toBe('safe');
    });
    
    it('should classify version as minor for minor version changes', () => {
      const result = classifyVersionDifference('1.0.0', '1.1.0');
      expect(result).toBe('minor');
    });
    
    it('should classify version as major for major version changes', () => {
      const result = classifyVersionDifference('1.0.0', '2.0.0');
      expect(result).toBe('major');
    });
    
    it('should handle caret ranges properly', () => {
      const result = classifyVersionDifference('^1.0.0', '2.0.0');
      expect(result).toBe('major');
    });
    
    it('should handle tilde ranges properly', () => {
      const result = classifyVersionDifference('~1.0.0', '1.1.0');
      expect(result).toBe('minor');
    });
    
    it('should handle complex ranges', () => {
      const result = classifyVersionDifference('>=1.0.0 <2.0.0', '1.5.0');
      expect(result).toBe('safe');
    });
  });
  
  describe('flattenTree', () => {
    it('should flatten a simple tree structure', () => {
      const simpleTree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {
          'dep1': {
            to: {
              name: 'dep1',
              version: '1.0.0',
              edgesIn: new Set([{ from: { name: 'root' }, to: { name: 'dep1' }, spec: '^1.0.0', type: 'dependencies' }]),
              edgesOut: {}
            }
          }
        }
      };
      
      const result = flattenTree(simpleTree);
      expect(result.size).toBe(1);
      expect(result.has('dep1@1.0.0')).toBe(true);
      
      const dep = result.get('dep1@1.0.0');
      expect(dep.name).toBe('dep1');
      expect(dep.version).toBe('1.0.0');
      expect(dep.expectedRange).toBe('^1.0.0');
      expect(dep.dependencyType).toBe('dependencies');
    });
    
    it('should respect maxDepth option', () => {
      const deepTree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {
          'dep1': {
            to: {
              name: 'dep1',
              version: '1.0.0',
              edgesIn: new Set([{ from: { name: 'root' }, to: { name: 'dep1' }, spec: '^1.0.0', type: 'dependencies' }]),
              edgesOut: {
                'dep2': {
                  to: {
                    name: 'dep2',
                    version: '1.0.0',
                    edgesIn: new Set([{ from: { name: 'dep1' }, to: { name: 'dep2' }, spec: '^1.0.0', type: 'dependencies' }]),
                    edgesOut: {}
                  }
                }
              }
            }
          }
        }
      };
      
      const result = flattenTree(deepTree, { maxDepth: 1 });
      expect(result.size).toBe(1);
      expect(result.has('dep1@1.0.0')).toBe(true);
      expect(result.has('dep2@1.0.0')).toBe(false);
    });
    
    it('should handle trees with no edges', () => {
      const emptyTree = {
        name: 'root',
        version: '1.0.0'
        // No edgesOut property
      };
      
      const result = flattenTree(emptyTree);
      expect(result.size).toBe(0);
    });
    
    it('should handle circular dependencies', () => {
      // Create a circular dependency: root -> dep1 -> dep2 -> dep1
      const circularTree = {
        name: 'root',
        version: '1.0.0',
        edgesOut: {}
      };
      
      const dep1 = {
        name: 'dep1',
        version: '1.0.0',
        edgesIn: new Set([{ from: { name: 'root' }, to: { name: 'dep1' }, spec: '^1.0.0', type: 'dependencies' }]),
        edgesOut: {}
      };
      
      const dep2 = {
        name: 'dep2',
        version: '1.0.0',
        edgesIn: new Set([{ from: { name: 'dep1' }, to: { name: 'dep2' }, spec: '^1.0.0', type: 'dependencies' }]),
        edgesOut: {}
      };
      
      // Create circular references
      circularTree.edgesOut.dep1 = { to: dep1 };
      dep1.edgesOut = { dep2: { to: dep2 } };
      dep2.edgesOut = { dep1: { to: dep1 } }; // Circular reference back to dep1
      
      const result = flattenTree(circularTree);
      expect(result.size).toBe(2);
      expect(result.has('dep1@1.0.0')).toBe(true);
      expect(result.has('dep2@1.0.0')).toBe(true);
    });
  });
  
  describe('analyzeDrift', () => {
    it('should detect matching dependencies correctly', () => {
      const idealTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const result = analyzeDrift(idealTree, actualTree);
      expect(result.summary.total).toBe(1);
      expect(result.summary.matching).toBe(1);
      expect(result.summary.matchingPercent).toBe(100);
      expect(result.results[0].status).toBe('matching');
    });
    
    it('should detect safe drift correctly', () => {
      const idealTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.2', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const result = analyzeDrift(idealTree, actualTree);
      expect(result.summary.total).toBe(1);
      expect(result.summary.safe).toBe(1);
      expect(result.summary.safePercent).toBe(100);
      expect(result.results[0].status).toBe('safe');
    });
    
    it('should detect minor drift correctly', () => {
      const idealTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'dep1', version: '1.1.0', range: '1.0.0', type: 'dependencies' }
      ]);
      
      const result = analyzeDrift(idealTree, actualTree);
      expect(result.summary.total).toBe(1);
      expect(result.summary.minor).toBe(1);
      expect(result.summary.minorPercent).toBe(100);
      expect(result.results[0].status).toBe('minor');
    });
    
    it('should detect major drift correctly', () => {
      const idealTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'dep1', version: '2.0.0', range: '1.0.0', type: 'dependencies' }
      ]);
      
      const result = analyzeDrift(idealTree, actualTree);
      expect(result.summary.total).toBe(1);
      expect(result.summary.major).toBe(1);
      expect(result.summary.majorPercent).toBe(100);
      expect(result.results[0].status).toBe('major');
    });
    
    it('should detect missing dependencies', () => {
      const idealTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'dep2', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
        // dep2 is missing
      ]);
      
      const result = analyzeDrift(idealTree, actualTree);
      expect(result.summary.total).toBe(2);
      expect(result.summary.missing).toBe(1);
      expect(result.summary.missingPercent).toBe(50);
      
      const missingDep = result.results.find(r => r.name === 'dep2');
      expect(missingDep.status).toBe('missing');
    });
    
    it('should detect extraneous dependencies', () => {
      const idealTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'dep1', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'dep2', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }  // Extra dependency
      ]);
      
      const result = analyzeDrift(idealTree, actualTree);
      expect(result.summary.total).toBe(2);
      expect(result.summary.extraneous).toBe(1);
      expect(result.summary.extraneousPercent).toBe(50);
      
      const extraDep = result.results.find(r => r.name === 'dep2');
      expect(extraDep.status).toBe('extraneous');
    });
    
    it('should group results when groupByDriftType is true', () => {
      const idealTree = createTreeWithDeps([
        { name: 'matching', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'safe', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'minor', version: '1.0.0', range: '1.0.0', type: 'dependencies' },
        { name: 'major', version: '1.0.0', range: '1.0.0', type: 'dependencies' },
        { name: 'missing', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'matching', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'safe', version: '1.0.1', range: '^1.0.0', type: 'dependencies' },
        { name: 'minor', version: '1.1.0', range: '1.0.0', type: 'dependencies' },
        { name: 'major', version: '2.0.0', range: '1.0.0', type: 'dependencies' },
        { name: 'extraneous', version: '1.0.0', range: '^1.0.0', type: 'dependencies' }  // Extra dependency
      ]);
      
      const result = analyzeDrift(idealTree, actualTree, { groupByDriftType: true });
      expect(result.grouped).toBeDefined();
      expect(result.grouped.matching.length).toBe(1);
      expect(result.grouped.safe.length).toBe(1);
      expect(result.grouped.minor.length).toBe(1);
      expect(result.grouped.major.length).toBe(1);
      expect(result.grouped.missing.length).toBe(1);
      expect(result.grouped.extraneous.length).toBe(1);
    });
    
    it('should exclude dev dependencies when excludeDevDependencies is true', () => {
      const idealTree = createTreeWithDeps([
        { name: 'prod', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'dev', version: '1.0.0', range: '^1.0.0', type: 'devDependencies' }
      ]);
      
      const actualTree = createTreeWithDeps([
        { name: 'prod', version: '1.0.0', range: '^1.0.0', type: 'dependencies' },
        { name: 'dev', version: '1.0.0', range: '^1.0.0', type: 'devDependencies' }
      ]);
      
      const result = analyzeDrift(idealTree, actualTree, { excludeDevDependencies: true });
      expect(result.summary.total).toBe(1); // Only the prod dependency
      expect(result.results[0].name).toBe('prod');
    });
  });
});

/**
 * Helper function to create a tree with specified dependencies
 * @param {Array<Object>} deps - Array of dependency objects
 * @returns {Object} A mock dependency tree
 */
function createTreeWithDeps(deps) {
  const tree = {
    name: 'root',
    version: '1.0.0',
    edgesOut: {}
  };
  
  deps.forEach(dep => {
    // Create the dependency node
    const node = {
      name: dep.name,
      version: dep.version,
      dependencyType: dep.type,
      edgesIn: new Set([
        { 
          from: { name: 'root' }, 
          to: { name: dep.name },
          spec: dep.range,
          type: dep.type
        }
      ]),
      edgesOut: {}
    };
    
    // Add it to the root's edges
    tree.edgesOut[dep.name] = { to: node };
  });
  
  return tree;
} 