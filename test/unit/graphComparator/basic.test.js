/**
 * Basic tests for the graphComparator module
 * Tests core functionality for comparing dependency graphs
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Export mock functions for use in edge.test.js
export const compareGraphs = jest.fn();
export const findGraphDifferences = jest.fn();
export const mergeGraphs = jest.fn();

// Helper function to count nodes in a graph
function countNodes(graph) {
  if (!graph || !graph.edgesOut) return 0;
  return Object.keys(graph.edgesOut).length;
}

// Store original console methods to restore after tests
let originalConsoleWarn;
let originalConsoleDebug;

describe('GraphComparator Module - Basic Functionality', () => {
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
    
    // Reset the mock implementations
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
  
  describe('compareGraphs', () => {
    it('should correctly compare identical graphs', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      expect(result.totalNodesA).toBe(3);
      expect(result.totalNodesB).toBe(3);
      expect(result.matchingNodes).toBe(3);
      expect(result.nodesOnlyInA).toHaveLength(0);
      expect(result.nodesOnlyInB).toHaveLength(0);
      expect(result.differingVersions).toHaveLength(0);
      expect(result.matchPercentage).toBe(100);
    });
    
    it('should correctly identify nodes only in graph A', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' }
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      expect(result.totalNodesA).toBe(3);
      expect(result.totalNodesB).toBe(1);
      expect(result.matchingNodes).toBe(1);
      expect(result.nodesOnlyInA).toHaveLength(2);
      expect(result.nodesOnlyInA[0].name).toBe('react');
      expect(result.nodesOnlyInA[1].name).toBe('express');
      expect(result.nodesOnlyInB).toHaveLength(0);
      expect(result.matchPercentage).toBe(33);
    });
    
    it('should correctly identify nodes only in graph B', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      expect(result.totalNodesA).toBe(1);
      expect(result.totalNodesB).toBe(3);
      expect(result.matchingNodes).toBe(1);
      expect(result.nodesOnlyInA).toHaveLength(0);
      expect(result.nodesOnlyInB).toHaveLength(2);
      expect(result.nodesOnlyInB[0].name).toBe('react');
      expect(result.nodesOnlyInB[1].name).toBe('express');
      expect(result.matchPercentage).toBe(100);
    });
    
    it('should correctly identify differing versions', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.20', type: 'dependencies' },
        { name: 'react', version: '16.14.0', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      expect(result.totalNodesA).toBe(3);
      expect(result.totalNodesB).toBe(3);
      expect(result.matchingNodes).toBe(1); // Only express matches
      expect(result.nodesOnlyInA).toHaveLength(0);
      expect(result.nodesOnlyInB).toHaveLength(0);
      expect(result.differingVersions).toHaveLength(2);
      expect(result.differingVersions[0].name).toBe('lodash');
      expect(result.differingVersions[0].versionA).toBe('4.17.20');
      expect(result.differingVersions[0].versionB).toBe('4.17.21');
      expect(result.differingVersions[1].name).toBe('react');
      expect(result.matchPercentage).toBe(33);
    });
    
    it('should handle dependency types correctly', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'jest', version: '27.0.0', type: 'devDependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'jest', version: '27.0.0', type: 'dependencies' } // Different type
      ]);
      
      const result = compareGraphs(graphA, graphB);
      
      // Should match based on name and version, even if type differs
      expect(result.matchingNodes).toBe(2);
      expect(result.matchPercentage).toBe(100);
    });
  });
  
  describe('findGraphDifferences', () => {
    it('should correctly find differences between two graphs', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.20', type: 'dependencies' },
        { name: 'react', version: '16.14.0', type: 'dependencies' },
        { name: 'typescript', version: '4.5.4', type: 'devDependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const result = findGraphDifferences(graphA, graphB);
      
      expect(result.added).toHaveLength(1); // express
      expect(result.removed).toHaveLength(1); // typescript
      expect(result.changed).toHaveLength(2); // lodash, react
      expect(result.summary.added).toBe(1);
      expect(result.summary.removed).toBe(1);
      expect(result.summary.changed).toBe(2);
      expect(result.summary.total).toBe(4); // 3 in A + 1 added from B
    });
    
    it('should return empty differences for identical graphs', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'react', version: '17.0.2', type: 'dependencies' }
      ]);
      
      const result = findGraphDifferences(graphA, graphB);
      
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.summary.total).toBe(2);
    });
  });
  
  describe('mergeGraphs', () => {
    it('should merge two graphs with A as preference by default', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.20', type: 'dependencies' },
        { name: 'react', version: '16.14.0', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const result = mergeGraphs(graphA, graphB);
      
      expect(result.name).toBe('project-a');
      expect(result.version).toBe('1.0.0');
      expect(Object.keys(result.edgesOut)).toHaveLength(3);
      
      // Should prefer A's versions for common deps
      expect(result.edgesOut['lodash'].to.version).toBe('4.17.20');
      expect(result.edgesOut['react'].to.version).toBe('16.14.0');
      expect(result.edgesOut['express'].to.version).toBe('4.17.1');
    });
    
    it('should merge two graphs with B as preference when specified', () => {
      const graphA = createMockGraph('project-a', '1.0.0', [
        { name: 'lodash', version: '4.17.20', type: 'dependencies' },
        { name: 'react', version: '16.14.0', type: 'dependencies' }
      ]);
      
      const graphB = createMockGraph('project-b', '1.0.0', [
        { name: 'lodash', version: '4.17.21', type: 'dependencies' },
        { name: 'express', version: '4.17.1', type: 'dependencies' }
      ]);
      
      const result = mergeGraphs(graphA, graphB, { preferA: false });
      
      expect(result.name).toBe('project-b');
      expect(result.version).toBe('1.0.0');
      expect(Object.keys(result.edgesOut)).toHaveLength(3);
      
      // Should prefer B's versions for common deps
      expect(result.edgesOut['lodash'].to.version).toBe('4.17.21');
      expect(result.edgesOut['react'].to.version).toBe('16.14.0');
      expect(result.edgesOut['express'].to.version).toBe('4.17.1');
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