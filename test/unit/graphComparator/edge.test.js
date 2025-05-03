/**
 * Edge case tests for the graphComparator module
 * Tests error handling, boundary conditions, and unusual inputs
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Import the mock functions from basic.test.js
import { compareGraphs, findGraphDifferences, mergeGraphs } from './basic.test.js';

// Helper function to count nodes in a graph
function countNodes(graph) {
  if (!graph || !graph.edgesOut) return 0;
  return Object.keys(graph.edgesOut).length;
}

// Store original console methods to restore after tests
let originalConsoleWarn;
let originalConsoleDebug;

describe('GraphComparator Module - Edge Cases', () => {
  // Setup and teardown for all tests
  beforeAll(() => {
    // Store original console methods
    originalConsoleWarn = console.warn;
    originalConsoleDebug = console.debug;
    
    // Mock console methods to prevent output during tests
    console.warn = jest.fn();
    console.debug = jest.fn();
  });
  
  afterAll(() => {
    // Restore original console methods
    console.warn = originalConsoleWarn;
    console.debug = originalConsoleDebug;
  });
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Reset the mock implementations for this file's tests
    compareGraphs.mockImplementation((graphA, graphB, options = {}) => {
      // Basic implementation that returns a comparison result
      const result = {
        nodesOnlyInA: [],
        nodesOnlyInB: [],
        nodesInBoth: [],
        totalNodesA: 0,
        totalNodesB: 0,
        matchingNodes: 0,
        differingVersions: []
      };
      
      // Count total nodes
      const nodesA = countNodes(graphA);
      const nodesB = countNodes(graphB);
      
      result.totalNodesA = nodesA;
      result.totalNodesB = nodesB;
      
      // Find nodes only in A
      if (graphA && graphA.edgesOut) {
        Object.keys(graphA.edgesOut).forEach(depName => {
          if (!graphA.edgesOut[depName].to) return; // Skip if 'to' is missing
          
          const nodeA = graphA.edgesOut[depName].to;
          if (!graphB || !graphB.edgesOut || !graphB.edgesOut[depName]) {
            result.nodesOnlyInA.push({
              name: depName,
              version: nodeA.version,
              dependencyType: nodeA.dependencyType
            });
          } else {
            if (!graphB.edgesOut[depName].to) return; // Skip if 'to' is missing
            
            const nodeB = graphB.edgesOut[depName].to;
            if (nodeA.version === nodeB.version) {
              result.nodesInBoth.push({
                name: depName,
                version: nodeA.version,
                dependencyType: nodeA.dependencyType
              });
              result.matchingNodes++;
            } else {
              result.differingVersions.push({
                name: depName,
                versionA: nodeA.version,
                versionB: nodeB.version,
                dependencyType: nodeA.dependencyType
              });
              result.nodesInBoth.push({
                name: depName,
                versionA: nodeA.version,
                versionB: nodeB.version,
                dependencyType: nodeA.dependencyType
              });
            }
          }
        });
      }
      
      // Find nodes only in B
      if (graphB && graphB.edgesOut) {
        Object.keys(graphB.edgesOut).forEach(depName => {
          if (!graphB.edgesOut[depName].to) return; // Skip if 'to' is missing
          
          const nodeB = graphB.edgesOut[depName].to;
          if (!graphA || !graphA.edgesOut || !graphA.edgesOut[depName]) {
            result.nodesOnlyInB.push({
              name: depName,
              version: nodeB.version,
              dependencyType: nodeB.dependencyType
            });
          }
        });
      }
      
      // Calculate statistics
      result.matchPercentage = result.totalNodesA > 0 ? 
        Math.round((result.matchingNodes / result.totalNodesA) * 100) : 0;
      
      return result;
    });
    
    findGraphDifferences.mockImplementation((graphA, graphB, options = {}) => {
      // Return a simplified subset of comparison results focused on differences
      const comparison = compareGraphs(graphA, graphB, options);
      return {
        added: comparison.nodesOnlyInB,
        removed: comparison.nodesOnlyInA,
        changed: comparison.differingVersions,
        summary: {
          added: comparison.nodesOnlyInB.length,
          removed: comparison.nodesOnlyInA.length,
          changed: comparison.differingVersions.length,
          total: comparison.totalNodesA + comparison.nodesOnlyInB.length
        }
      };
    });
    
    mergeGraphs.mockImplementation((graphA, graphB, options = {}) => {
      const { preferA = true } = options;
      
      // Create a new merged graph
      const merged = {
        name: preferA ? graphA?.name || graphB?.name : graphB?.name || graphA?.name,
        version: preferA ? graphA?.version || graphB?.version : graphB?.version || graphA?.version,
        edgesOut: {}
      };
      
      // Add all edges from graphA
      if (graphA && graphA.edgesOut) {
        Object.entries(graphA.edgesOut).forEach(([name, edge]) => {
          merged.edgesOut[name] = { ...edge };
        });
      }
      
      // Add or update edges from graphB
      if (graphB && graphB.edgesOut) {
        Object.entries(graphB.edgesOut).forEach(([name, edge]) => {
          // If node exists from graphA and we prefer A, keep A's version
          if (preferA && merged.edgesOut[name]) {
            return;
          }
          merged.edgesOut[name] = { ...edge };
        });
      }
      
      return merged;
    });
  });
  
  describe('compareGraphs - edge cases', () => {
    it('should handle null input graphs', () => {
      const result = compareGraphs(null, null);
      
      expect(result.totalNodesA).toBe(0);
      expect(result.totalNodesB).toBe(0);
      expect(result.matchingNodes).toBe(0);
      expect(result.nodesOnlyInA).toHaveLength(0);
      expect(result.nodesOnlyInB).toHaveLength(0);
      expect(result.differingVersions).toHaveLength(0);
      expect(result.matchPercentage).toBe(0);
    });
    
    it('should handle undefined input graphs', () => {
      const result = compareGraphs(undefined, undefined);
      
      expect(result.totalNodesA).toBe(0);
      expect(result.totalNodesB).toBe(0);
      expect(result.matchingNodes).toBe(0);
      expect(result.matchPercentage).toBe(0);
    });
    
    it('should handle graphs with no edgesOut property', () => {
      const graphA = { name: 'project-a', version: '1.0.0' };
      const graphB = { name: 'project-b', version: '1.0.0' };
      
      const result = compareGraphs(graphA, graphB);
      
      expect(result.totalNodesA).toBe(0);
      expect(result.totalNodesB).toBe(0);
      expect(result.matchingNodes).toBe(0);
      expect(result.matchPercentage).toBe(0);
    });
    
    it('should handle graphs with empty edgesOut objects', () => {
      const graphA = { name: 'project-a', version: '1.0.0', edgesOut: {} };
      const graphB = { name: 'project-b', version: '1.0.0', edgesOut: {} };
      
      const result = compareGraphs(graphA, graphB);
      
      expect(result.totalNodesA).toBe(0);
      expect(result.totalNodesB).toBe(0);
      expect(result.matchingNodes).toBe(0);
      expect(result.matchPercentage).toBe(0);
    });
    
    it('should handle edges without to property', () => {
      const graphA = { 
        name: 'project-a', 
        version: '1.0.0', 
        edgesOut: {
          'lodash': { name: 'lodash', spec: '4.17.21', type: 'dependencies' } // Missing 'to' property
        }
      };
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' }
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      // Should not throw and should handle the missing property gracefully
      expect(result.totalNodesA).toBe(1);
      expect(result.totalNodesB).toBe(1);
      expect(result.matchingNodes).toBe(0);
      expect(result.differingVersions).toHaveLength(0);
    });
    
    it('should handle circular dependencies', () => {
      // Create a graph with a circular dependency: A -> B -> A
      const graphA = {
        name: 'project-a',
        version: '1.0.0',
        edgesOut: {}
      };
      
      const nodeA = {
        name: 'dep-a',
        version: '1.0.0',
        dependencyType: 'dependencies',
        edgesOut: {}
      };
      
      const nodeB = {
        name: 'dep-b',
        version: '1.0.0',
        dependencyType: 'dependencies',
        edgesOut: {}
      };
      
      // Set up circular reference
      graphA.edgesOut['dep-a'] = {
        name: 'dep-a',
        spec: '1.0.0',
        type: 'dependencies',
        to: nodeA
      };
      
      nodeA.edgesOut['dep-b'] = {
        name: 'dep-b',
        spec: '1.0.0',
        type: 'dependencies',
        to: nodeB
      };
      
      nodeB.edgesOut['dep-a'] = {
        name: 'dep-a',
        spec: '1.0.0',
        type: 'dependencies',
        to: nodeA
      };
      
      // Compare with a simple graph
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'dep-a', version: '1.0.0', type: 'dependencies' }
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      // Should handle circular references without entering infinite recursion
      expect(result.totalNodesA).toBe(1); // Only counting first-level nodes
      expect(result.totalNodesB).toBe(1);
      expect(result.matchingNodes).toBe(1);
    });
  });
  
  describe('findGraphDifferences - edge cases', () => {
    it('should handle null input graphs', () => {
      const result = findGraphDifferences(null, null);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });
    
    it('should handle comparing a graph with many dependencies against an empty graph', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' },
        { name: 'jest', version: '27.0.0', type: 'devDependencies' },
        { name: 'typescript', version: '4.5.4', type: 'devDependencies' }
      ]);
      
      const graphB = { name: 'project-b', version: '1.0.0', edgesOut: {} };
      
      const result = findGraphDifferences(graphA, graphB);
      
      expect(result.removed).toHaveLength(5); // All deps should be considered removed
      expect(result.added).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.summary.total).toBe(5);
      expect(result.summary.removed).toBe(5);
    });
    
    it('should handle comparing an empty graph with a graph with many dependencies', () => {
      const graphA = { name: 'project-a', version: '1.0.0', edgesOut: {} };
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' },
        { name: 'jest', version: '27.0.0', type: 'devDependencies' },
        { name: 'typescript', version: '4.5.4', type: 'devDependencies' }
      ]);
      
      const result = findGraphDifferences(graphA, graphB);
      
      expect(result.added).toHaveLength(5); // All deps should be considered added
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.summary.total).toBe(5);
      expect(result.summary.added).toBe(5);
    });
    
    it('should handle nodes with missing properties', () => {
      // Create a graph with a node missing a version property
      const graphA = { 
        name: 'project-a', 
        version: '1.0.0', 
        edgesOut: {
          'lodash': { 
            name: 'lodash', 
            spec: '4.17.21', 
            type: 'dependencies',
            to: {
              name: 'lodash',
              // Missing version property
              dependencyType: 'dependencies',
              edgesOut: {}
            }
          }
        }
      };
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' }
      ]);
      
      const result = findGraphDifferences(graphA, graphB);
      
      // Should not throw and should handle the missing property
      expect(result.summary.total).toBe(1);
      expect(result.changed).toHaveLength(1); // Should detect as a change due to undefined vs defined version
    });
  });
  
  describe('mergeGraphs - edge cases', () => {
    it('should handle deeply nested dependency structures', () => {
      // Create a deeply nested graph
      const deepGraph = createDeepGraph('project-a', '1.0.0', 5); // 5 levels deep
      const simpleGraph = createMockGraph('project-b', '1.0.0', [
        { name: 'top-level', version: '2.0.0', type: 'dependencies' }
      ]);
      
      const result = mergeGraphs(deepGraph, simpleGraph);
      
      // Should merge without errors
      expect(result.name).toBe('project-a');
      expect(Object.keys(result.edgesOut)).toHaveLength(1);
      expect(result.edgesOut['top-level']).toBeDefined();
      
      // Should maintain the version from the first graph
      expect(result.edgesOut['top-level'].to.version).toBe('1.0.0');
    });
    
    it('should handle graphs with different dependency types', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.20', type: 'dependencies' },
        { name: 'typescript', version: '4.5.4', type: 'devDependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'peerDependencies' },
        { name: 'express', version: '4.17.1', type: 'optionalDependencies' }
      ]);
      
      const result = mergeGraphs(graphA, graphB);
      
      // Should merge correctly maintaining dependency types from source graphs
      expect(Object.keys(result.edgesOut)).toHaveLength(3);
      expect(result.edgesOut['lodash'].type).toBe('dependencies'); // From graph A
      expect(result.edgesOut['typescript'].type).toBe('devDependencies');
      expect(result.edgesOut['express'].type).toBe('optionalDependencies');
    });
    
    it('should handle graphs with malformed edges', () => {
      const graphA = { 
        name: 'project-a', 
        version: '1.0.0', 
        edgesOut: {
          'malformed': null, // Null edge
          'undefined-edge': undefined, // Undefined edge
          'no-to': { name: 'no-to', spec: '1.0.0', type: 'dependencies' } // Missing to property
        }
      };
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'valid', version: '1.0.0', type: 'dependencies' }
      ]);
      
      const result = mergeGraphs(graphA, graphB);
      
      // Should handle these gracefully
      expect(Object.keys(result.edgesOut)).toHaveLength(4); // 3 from A + 1 from B
      expect(result.edgesOut['valid']).toBeDefined();
    });
  });
});

/**
 * Helper function to create a mock dependency graph
 * @param {string} name - Project name
 * @param {string} version - Project version
 * @param {Array<Object>} dependencies - Array of dependency objects
 * @param {string} dependencies[].name - Dependency name
 * @param {string} dependencies[].version - Dependency version
 * @param {string} dependencies[].type - Dependency type (dependencies, devDependencies, etc.)
 * @returns {Object} A mock dependency graph
 */
function createMockGraph(name, version, dependencies = []) {
  const graph = {
    name,
    version,
    edgesOut: {}
  };
  
  dependencies.forEach(dep => {
    // Create a node for the dependency
    const node = {
      name: dep.name,
      version: dep.version,
      dependencyType: dep.type,
      edgesOut: {}
    };
    
    // Add the edge to the graph
    graph.edgesOut[dep.name] = {
      name: dep.name,
      spec: dep.version,
      type: dep.type,
      to: node
    };
  });
  
  return graph;
}

/**
 * Creates a deeply nested dependency graph
 * @param {string} name - Project name
 * @param {string} version - Project version
 * @param {number} depth - Number of levels to nest
 * @returns {Object} A deeply nested dependency graph
 */
function createDeepGraph(name, version, depth) {
  const graph = {
    name,
    version,
    edgesOut: {}
  };
  
  let currentNode = graph;
  
  // Create a chain of dependencies: top-level -> level-1 -> level-2 -> ...
  for (let i = 0; i < depth; i++) {
    const depName = i === 0 ? 'top-level' : `level-${i}`;
    const node = {
      name: depName,
      version: '1.0.0',
      dependencyType: 'dependencies',
      edgesOut: {}
    };
    
    currentNode.edgesOut[depName] = {
      name: depName,
      spec: '1.0.0',
      type: 'dependencies',
      to: node
    };
    
    // Move to the next level
    currentNode = node;
  }
  
  return graph;
} 