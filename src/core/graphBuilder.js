/**
 * Dependency graph builder module for analyzing project dependencies
 * @module core/graphBuilder
 */

const { Arborist } = require('@npmcli/arborist');
const fs = require('fs');
const path = require('path');
const { detectLockFiles } = require('./lockFileDetector');

/**
 * Creates a node structure from a dependency for the dependency graph
 * @private
 * @param {string} name - Package name 
 * @param {string} version - Package version or version range specification
 * @param {string} [dependencyType='dependencies'] - Type of dependency (dependencies, devDependencies, peerDependencies, optionalDependencies)
 * @returns {Object} Node structure representing a dependency
 * @property {string} name - Package name
 * @property {string} version - Package version or version range
 * @property {string} dependencyType - Type of dependency relationship
 * @property {Object} edgesOut - Outgoing edges to dependencies of this node
 */
function createNode(name, version, dependencyType = 'dependencies') {
  return {
    name,
    version,
    dependencyType,
    edgesOut: {}
  };
}

/**
 * Extracts the expected semver range and dependency type for a node from its incoming edges
 * @private
 * @param {Object} node - The Arborist node object to analyze
 * @returns {Object} Object containing the expected range and dependency type
 * @property {string|null} range - The expected semver range or null if not found
 * @property {string} type - The dependency type (defaults to 'dependencies' if not found)
 */
function getExpectedRangeAndType(node) {
  if (!node.edgesIn || node.edgesIn.size === 0) {
    return { range: null, type: 'dependencies' };
  }
  
  // Find the first valid edge that points to this node
  for (const edge of node.edgesIn) {
    if (edge.from && edge.to && edge.to.name === node.name) {
      return { 
        range: edge.spec,
        type: edge.type || 'dependencies'
      };
    }
  }
  
  return { range: null, type: 'dependencies' };
}

/**
 * Builds dependency graphs using Arborist and falls back to direct package.json parsing if needed
 * 
 * This function attempts to build two dependency trees:
 * 1. The "ideal" tree - what should be installed according to package.json and lockfiles
 * 2. The "actual" tree - what is actually installed in node_modules
 * 
 * @param {string} projectRoot - The root directory of the project to analyze
 * @param {Object} [options={}] - Options for graph building
 * @param {boolean} [options.useCache=false] - Whether to use cached trees if available for better performance
 * @param {number} [options.maxDepth=Infinity] - Maximum depth to traverse in the dependency tree
 * @returns {Promise<Object>} Object containing both ideal and actual dependency trees
 * @property {Object} idealTree - The expected dependency tree from lockfile/package.json
 * @property {Object} actualTree - The actual installed dependency tree from node_modules
 * @property {string} source - Source of the tree data ('arborist', 'package.json', or 'cache')
 * @throws {Error} When dependency trees cannot be loaded due to missing files or parsing errors
 */
async function buildGraphs(projectRoot, options = {}) {
  const { useCache = false, maxDepth = Infinity } = options;
  
  try {
    // Check for cache if enabled
    let useCachedTrees = false;
    let cachedTrees = null;
    
    const cacheFile = path.join(projectRoot, '.depdrift-cache.json');
    if (useCache && fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // Check if package files have changed
        const packageJson = path.join(projectRoot, 'package.json');
        
        // Check lock files
        const lockFiles = detectLockFiles(projectRoot);
        const packageLock = path.join(projectRoot, 'package-lock.json');
        const yarnLock = path.join(projectRoot, 'yarn.lock');
        const pnpmLock = path.join(projectRoot, 'pnpm-lock.yaml');
        
        // Get file modification times
        const packageJsonMtime = fs.existsSync(packageJson) ? fs.statSync(packageJson).mtime.getTime() : 0;
        const packageLockMtime = lockFiles.npm ? fs.statSync(packageLock).mtime.getTime() : 0;
        const yarnLockMtime = lockFiles.yarn ? fs.statSync(yarnLock).mtime.getTime() : 0;
        const pnpmLockMtime = lockFiles.pnpm ? fs.statSync(pnpmLock).mtime.getTime() : 0;
        
        // If no files have changed since cache was created, use cached trees
        if (cache.timestamp && 
            packageJsonMtime <= cache.timestamp && 
            packageLockMtime <= cache.timestamp &&
            yarnLockMtime <= cache.timestamp &&
            pnpmLockMtime <= cache.timestamp) {
          console.log('Using cached dependency trees (no changes detected)');
          cachedTrees = {
            idealTree: cache.idealTree,
            actualTree: cache.actualTree,
            source: 'cache'
          };
          useCachedTrees = true;
        }
      } catch (cacheError) {
        // If cache handling fails, continue with normal tree building
        console.warn('Cache read failed, building trees normally:', cacheError.message);
      }
    }
    
    // If we're using cached trees, return them now
    if (useCachedTrees && cachedTrees) {
      return cachedTrees;
    }

    // Try using Arborist first
    let useArborist = true;
    let idealTree, actualTree;
    
    try {
      const arborist = new Arborist({ path: projectRoot });
      idealTree = await arborist.loadVirtual();
      actualTree = await arborist.loadActual();
      
      // Add dependency type information to nodes
      if (idealTree) {
        enhanceTreeWithDependencyTypes(idealTree, maxDepth);
      }
    } catch (err) {
      // If Arborist fails, continue with fallback approach
      console.error('Warning: Arborist failed, falling back to direct package.json parsing:', err.message);
      useArborist = false;
    }
    
    // If Arborist worked, return those trees
    if (useArborist && idealTree && actualTree) {
      const result = { idealTree, actualTree, source: 'arborist' };
      
      // Save to cache if enabled
      if (useCache) {
        saveTreesToCache(cacheFile, idealTree, actualTree);
      }
      
      return result;
    }
    
    // Fallback: Read package.json directly
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('Project root does not contain a package.json file');
    }
    
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    
    // Read package.json for the expected dependencies
    const packageJsonContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Create an idealTree structure
    idealTree = {
      name: packageJsonContent.name || 'unknown',
      version: packageJsonContent.version || '0.0.0',
      path: projectRoot,
      edgesOut: {}
    };
    
    // Process all dependency types
    const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    
    for (const depType of dependencyTypes) {
      const deps = packageJsonContent[depType] || {};
      
      for (const [name, versionRange] of Object.entries(deps)) {
        const node = createNode(name, versionRange, depType);
        idealTree.edgesOut[name] = {
          name,
          spec: versionRange,
          type: depType,
          to: node
        };
      }
    }
    
    // Create an actualTree structure
    actualTree = {
      name: packageJsonContent.name || 'unknown',
      version: packageJsonContent.version || '0.0.0',
      path: projectRoot,
      edgesOut: {}
    };
    
    // Check if node_modules exists
    if (fs.existsSync(nodeModulesPath)) {
      try {
        // Loop through top-level directories in node_modules
        const nodeModulesEntries = fs.readdirSync(nodeModulesPath)
          .filter(entry => {
            try {
              const fullPath = path.join(nodeModulesPath, entry);
              // Skip files and hidden directories
              return fs.statSync(fullPath).isDirectory() && !entry.startsWith('.');
            } catch (err) {
              // If stat fails, skip this entry
              return false;
            }
          });
        
        // Process scoped packages (directories starting with @)
        for (const entry of nodeModulesEntries) {
          if (entry.startsWith('@')) {
            // This is a scope directory, process packages inside it
            const scopePath = path.join(nodeModulesPath, entry);
            try {
              const scopedPackages = fs.readdirSync(scopePath)
                .filter(pkg => {
                  try {
                    const fullPath = path.join(scopePath, pkg);
                    return fs.statSync(fullPath).isDirectory();
                  } catch (err) {
                    return false;
                  }
                });
              
              for (const pkg of scopedPackages) {
                const fullName = `${entry}/${pkg}`;
                const packagePath = path.join(scopePath, pkg);
                const packageJsonPath = path.join(packagePath, 'package.json');
                
                if (fs.existsSync(packageJsonPath)) {
                  try {
                    const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    const node = createNode(fullName, pkgJson.version);
                    
                    actualTree.edgesOut[fullName] = {
                      name: fullName,
                      spec: pkgJson.version,
                      to: node
                    };
                  } catch (err) {
                    // Skip if package.json can't be read
                    console.warn(`Warning: could not read package.json for ${fullName}:`, err.message);
                  }
                }
              }
            } catch (err) {
              console.warn(`Warning: could not read scoped packages in ${entry}:`, err.message);
            }
          } else {
            // Regular package
            const packagePath = path.join(nodeModulesPath, entry);
            const packageJsonPath = path.join(packagePath, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
              try {
                const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const node = createNode(entry, pkgJson.version);
                
                actualTree.edgesOut[entry] = {
                  name: entry,
                  spec: pkgJson.version,
                  to: node
                };
              } catch (err) {
                // Skip if package.json can't be read
                console.warn(`Warning: could not read package.json for ${entry}:`, err.message);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Warning: error reading node_modules directory:`, err.message);
      }
    }
    
    const result = { idealTree, actualTree, source: 'package.json' };
    
    // Apply maxDepth for package.json parsing approach
    if (maxDepth < Infinity) {
      enhanceTreeWithDependencyTypes(idealTree, maxDepth);
      enhanceTreeWithDependencyTypes(actualTree, maxDepth);
    }
    
    // Save to cache if enabled
    if (useCache) {
      saveTreesToCache(cacheFile, idealTree, actualTree);
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to build dependency graph: ${error.message}`);
  }
}

/**
 * Enhances the dependency tree by adding dependency type information to all nodes
 * and enforces the maximum depth limit by pruning edges beyond that depth
 * @private
 * @param {Object} tree - The Arborist tree to enhance with dependency type information
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse in the dependency tree
 */
function enhanceTreeWithDependencyTypes(tree, maxDepth = Infinity) {
  // Map to track node depths
  const nodeDepths = new Map();
  
  /**
   * Recursively processes nodes in the dependency tree to add type information
   * and enforce depth limits
   * @private
   * @param {Object} node - The current node to process
   * @param {number} [depth=0] - Current depth in the tree
   */
  function processNode(node, depth = 0) {
    // Store the depth of this node
    nodeDepths.set(node, depth);
    
    // First, handle the root node which might not have incoming edges
    if (!node.dependencyType) {
      node.dependencyType = 'dependencies';
    }
    
    // If we've exceeded maxDepth, don't process children
    if (depth >= maxDepth) {
      // Clear edges deeper than maxDepth to enforce the depth limit
      if (node.edgesOut) {
        node.edgesOut = {};
      }
      return;
    }
    
    // Process edges to set dependency types on child nodes
    if (node.edgesOut) {
      for (const [name, edge] of Object.entries(node.edgesOut)) {
        if (edge.to) {
          // Set the dependency type based on the edge type
          edge.to.dependencyType = edge.type || 'dependencies';
          // Recursively process children with increased depth
          processNode(edge.to, depth + 1);
        }
      }
    }
  }
  
  // Start the recursive enhancement
  processNode(tree);
  
  // Additional pass to ensure all nodes at maxDepth have empty edgesOut
  nodeDepths.forEach((depth, node) => {
    if (depth === maxDepth && node.edgesOut) {
      node.edgesOut = {};
    }
  });
}

/**
 * Saves the dependency trees to a cache file for faster future analysis
 * @private
 * @param {string} cacheFile - Path to the cache file to write
 * @param {Object} idealTree - The ideal dependency tree to cache
 * @param {Object} actualTree - The actual dependency tree to cache
 * @returns {void} The function does not return a value but logs a warning if caching fails
 */
function saveTreesToCache(cacheFile, idealTree, actualTree) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({
      timestamp: Date.now(),
      idealTree,
      actualTree
    }));
  } catch (err) {
    console.warn('Warning: failed to save cache:', err.message);
  }
}

module.exports = {
  buildGraphs,
  getExpectedRangeAndType
}; 