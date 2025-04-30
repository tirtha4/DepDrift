/**
 * Dependency drift analyzer module for analyzing differences between expected and actual dependencies
 * @module analyzers/driftAnalyzer
 * @description Analyzes the differences between dependency trees, classifies version drifts,
 * and provides detailed reports on dependency inconsistencies in Node.js projects.
 */

const semver = require('semver');

/**
 * Flattens an Arborist tree into a map of name@version -> node
 * @private
 * @param {Object} tree - The Arborist tree to flatten
 * @param {Object} [options={}] - Flattening options
 * @param {number} [options.maxDepth=Infinity] - Maximum depth to traverse
 * @returns {Map<string, Object>} A map of package specifications to nodes
 * @property {string} name - Package name
 * @property {string} version - Package version
 * @property {string|null} expectedRange - Expected semver range if available
 * @property {string} dependencyType - Type of dependency (dependencies, devDependencies, etc.)
 */
function flattenTree (tree, options = {}) {
  const { maxDepth = Infinity } = options;
  const result = new Map();
  const visited = new Set(); // Prevent processing the same node multiple times

  // Process the root node's dependencies
  if (!tree.edgesOut) {
    return result;
  }

  // Function to recursively process a node and its dependencies
  function processNode (node, isRoot = false, depth = 0) {
    // Skip the root node itself from the results and respect max depth
    if (depth > maxDepth) {
      return;
    }

    // Skip already visited nodes (prevents infinite recursion in circular deps)
    const nodeId = node.id || `${node.name}@${node.version}`;
    if (!isRoot && visited.has(nodeId)) {
      return;
    }

    if (!isRoot) {
      visited.add(nodeId);

      // Extract dependency type and expected range from edge if available
      const { range, type } = getExpectedRangeAndType(node);

      // Create the key & store essential data (not the whole node to save memory)
      const key = `${node.name}@${node.version}`;
      result.set(key, {
        name: node.name,
        version: node.version,
        expectedRange: range,
        dependencyType: node.dependencyType || type
      });
    }

    // Process all dependencies recursively
    if (node.edgesOut) {
      for (const [, edge] of Object.entries(node.edgesOut)) {
        if (edge.to) {
          processNode(edge.to, false, depth + 1);
        }
      }
    }
  }

  // Start the recursion from the root
  processNode(tree, true);
  return result;
}

/**
 * Gets the expected semver range and type for a node from its incoming edges
 * @private
 * @param {Object} node - The Arborist node object
 * @returns {Object} Object containing the expected range and dependency type
 * @property {string|null} range - The expected semver range or null if not found
 * @property {string} type - The dependency type (defaults to 'dependencies' if not found)
 */
function getExpectedRangeAndType (node) {
  if (!node.edgesIn || node.edgesIn.size === 0) {
    return { range: null, type: 'dependencies' };
  }

  // Find the first valid edge that points to this node
  for (const edge of node.edgesIn) {
    if (edge.from && edge.to && edge.to.name === node.name) {
      return {
        range: edge.spec || null,
        type: edge.type || 'dependencies'
      };
    }
  }

  return { range: null, type: 'dependencies' };
}

/**
 * Determines the semantic version difference classification between expected and installed versions
 * @param {string} expectedRange - The expected semver range from package.json
 * @param {string} installedVersion - The actual installed version from node_modules
 * @param {Object} [options={}] - Classification options
 * @returns {'safe'|'minor'|'major'} Classification of the version difference:
 *   - 'safe': No drift or patch-level drift only
 *   - 'minor': Minor version drift
 *   - 'major': Major version drift or unclassifiable drift
 * @public
 */
function classifyVersionDifference (expectedRange, installedVersion, options = {}) {
  // Validate inputs
  if (!expectedRange || !installedVersion) {
    return 'major'; // Default to major difference if inputs are invalid
  }

  try {
    // Clean up versions for comparison
    const cleanInstalledVersion = semver.clean(installedVersion) || installedVersion;

    // If installed version satisfies the expected range, it's safe
    if (semver.satisfies(cleanInstalledVersion, expectedRange, { includePrerelease: true })) {
      return 'safe';
    }

    // For version comparison, we need a concrete version to compare against
    // For ranges, find the highest version that would satisfy the range
    let expectedVersion;

    // Try to get a real version to compare against
    if (semver.validRange(expectedRange)) {
      // Extract a usable version from the range
      if (expectedRange.startsWith('^') || expectedRange.startsWith('~')) {
        // For caret/tilde ranges, use the version without the prefix
        expectedVersion = expectedRange.substring(1);
      }
      // For more complex ranges like >=1.0.0 <2.0.0
      else if (expectedRange.includes(' ')) {
        // Try to parse the range and get a base version
        try {
          // For complex ranges, we can try to get the max satisfying version
          // from a set of possible versions based on the installed version
          const possibleVersions = generateVersionCandidates(cleanInstalledVersion);
          expectedVersion = semver.maxSatisfying(possibleVersions, expectedRange);

          if (!expectedVersion) {
            // If we can't find a satisfying version, use the coerced version
            expectedVersion = semver.coerce(expectedRange);
            if (expectedVersion) {
              expectedVersion = expectedVersion.version;
            } else {
              // Last resort - just find the first number in the range
              const match = expectedRange.match(/\d+\.\d+\.\d+/);
              expectedVersion = match ? match[0] : null;
            }
          }
        } catch (e) {
          // If all methods fail, use coerce as a fallback
          const coercedVersion = semver.coerce(expectedRange);
          expectedVersion = coercedVersion ? coercedVersion.version : null;
        }
      }
      // Handle simple versions without range specifiers
      else if (semver.valid(expectedRange)) {
        expectedVersion = expectedRange;
      }
      // For other ranges, coerce to a usable version
      else {
        const coercedVersion = semver.coerce(expectedRange);
        expectedVersion = coercedVersion ? coercedVersion.version : null;
      }
    } else if (semver.valid(expectedRange)) {
      // It's already a valid version, no need to extract
      expectedVersion = expectedRange;
    } else {
      // Last resort, try to coerce it
      const coercedVersion = semver.coerce(expectedRange);
      expectedVersion = coercedVersion ? coercedVersion.version : null;
    }

    // If we couldn't get a valid expected version, default to major
    if (!expectedVersion || !semver.valid(expectedVersion)) {
      return 'major';
    }

    // Compare major/minor/patch numbers
    if (semver.major(cleanInstalledVersion) !== semver.major(expectedVersion)) {
      return 'major';
    } else if (semver.minor(cleanInstalledVersion) !== semver.minor(expectedVersion)) {
      return 'minor';
    } else {
      // If major and minor match, it's a patch difference - considered safe
      return 'safe';
    }
  } catch (error) {
    console.warn('Error classifying version difference:', error);
    return 'unknown';
  }
}

/**
 * Generates an array of version candidates for comparison in semver operations
 * @private
 * @param {string} version - Base version to generate candidates around
 * @returns {Array<string>} Array of version strings to use in maxSatisfying checks
 */
function generateVersionCandidates (version) {
  try {
    const parsed = semver.parse(version);
    if (!parsed) {
      return [version];
    }

    const { major, minor, patch } = parsed;
    const candidates = [`${major}.${minor}.${patch}`];

    // Add minor variations
    for (let m = Math.max(0, minor - 1); m <= minor + 1; m++) {
      candidates.push(`${major}.${m}.0`);
    }

    // Add major variations
    for (let M = Math.max(0, major - 1); M <= major + 1; M++) {
      candidates.push(`${M}.0.0`);
    }

    return candidates;
  } catch (error) {
    console.warn('Error generating version candidates:', error);
    return [];
  }
}

/**
 * Determines the appropriate status for a missing package based on dependency type
 * @private
 * @param {string} dependencyType - The type of dependency (dependencies, devDependencies, etc.)
 * @returns {'missing'|'optional-missing'|'peer-missing'} Appropriate status for the missing dependency
 */
function getMissingStatus (dependencyType) {
  switch (dependencyType) {
  case 'optionalDependencies':
    return 'optional-missing';
  case 'peerDependencies':
    return 'peer-missing';
  default:
    return 'missing';
  }
}

/**
 * Analyzes drift between expected and actual dependency trees
 * @param {Object} idealTree - The expected dependency tree from package.json/lockfile
 * @param {Object} actualTree - The actual installed dependency tree from node_modules
 * @param {Object} [options={}] - Analysis options
 * @param {number} [options.maxDepth=Infinity] - Maximum depth to traverse in tree
 * @param {boolean} [options.excludeDevDependencies=false] - Whether to exclude dev dependencies
 * @param {boolean} [options.groupByDriftType=false] - Whether to group results by drift type
 * @returns {Object} Analysis results
 * @property {Array<Object>} results - Array of drift analysis results for each dependency
 * @property {Object} summary - Summary statistics of drift analysis
 * @property {number} summary.total - Total number of dependencies analyzed
 * @property {number} summary.matching - Number of exactly matching dependencies
 * @property {number} summary.safe - Number of dependencies with safe drift (patch level)
 * @property {number} summary.minor - Number of dependencies with minor version drift
 * @property {number} summary.major - Number of dependencies with major version drift
 * @property {number} summary.missing - Number of missing dependencies
 * @property {number} summary.extraneous - Number of extraneous dependencies
 * @property {Object} [grouped] - Dependencies grouped by drift type (if groupByDriftType=true)
 * @public
 */
function analyzeDrift (idealTree, actualTree, options = {}) {
  const {
    maxDepth = Infinity,
    excludeDevDependencies = false,
    groupByDriftType = false
  } = options;

  // Flatten both trees for easier comparison
  const expectedDeps = flattenTree(idealTree, { maxDepth });
  const actualDeps = flattenTree(actualTree, { maxDepth });

  // Track differences
  const driftResults = [];

  // First, check all expected dependencies against actual
  for (const [key, expectedNode] of expectedDeps.entries()) {
    // Skip dev dependencies if excluded
    if (excludeDevDependencies &&
        (expectedNode.dependencyType === 'devDependencies' ||
         expectedNode.dependencyType === 'dev')) {
      continue;
    }

    // Find matching actual dependency by name
    const actualKey = Array.from(actualDeps.keys()).find(k =>
      k.startsWith(`${expectedNode.name}@`));

    if (actualKey) {
      const actualNode = actualDeps.get(actualKey);

      // Check for version differences
      if (actualNode.version !== expectedNode.version) {
        // Classify the version difference
        const diffType = classifyVersionDifference(
          expectedNode.expectedRange || expectedNode.version,
          actualNode.version
        );

        driftResults.push({
          name: expectedNode.name,
          expectedVersion: expectedNode.version,
          expectedRange: expectedNode.expectedRange,
          actualVersion: actualNode.version,
          dependencyType: expectedNode.dependencyType,
          status: diffType
        });
      } else {
        // Versions match exactly, no drift
        driftResults.push({
          name: expectedNode.name,
          expectedVersion: expectedNode.version,
          expectedRange: expectedNode.expectedRange,
          actualVersion: actualNode.version,
          dependencyType: expectedNode.dependencyType,
          status: 'matching'
        });
      }
    } else {
      // Missing dependency
      driftResults.push({
        name: expectedNode.name,
        expectedVersion: expectedNode.version,
        expectedRange: expectedNode.expectedRange,
        actualVersion: null,
        dependencyType: expectedNode.dependencyType,
        status: getMissingStatus(expectedNode.dependencyType)
      });
    }
  }

  // Find extraneous dependencies
  for (const [key, actualNode] of actualDeps.entries()) {
    const expectedKey = Array.from(expectedDeps.keys()).find(k =>
      k.startsWith(`${actualNode.name}@`));

    if (!expectedKey) {
      driftResults.push({
        name: actualNode.name,
        expectedVersion: null,
        expectedRange: null,
        actualVersion: actualNode.version,
        dependencyType: actualNode.dependencyType,
        status: 'extraneous'
      });
    }
  }

  // Summary statistics
  const summary = {
    total: driftResults.length,
    matching: driftResults.filter(r => r.status === 'matching').length,
    safe: driftResults.filter(r => r.status === 'safe').length,
    minor: driftResults.filter(r => r.status === 'minor').length,
    major: driftResults.filter(r => r.status === 'major').length,
    missing: driftResults.filter(r => ['missing', 'optional-missing', 'peer-missing'].includes(r.status)).length,
    extraneous: driftResults.filter(r => r.status === 'extraneous').length
  };

  // Add percentages
  if (summary.total > 0) {
    summary.matchingPercent = Math.round((summary.matching / summary.total) * 100);
    summary.safePercent = Math.round((summary.safe / summary.total) * 100);
    summary.minorPercent = Math.round((summary.minor / summary.total) * 100);
    summary.majorPercent = Math.round((summary.major / summary.total) * 100);
    summary.missingPercent = Math.round((summary.missing / summary.total) * 100);
    summary.extraneousPercent = Math.round((summary.extraneous / summary.total) * 100);
    summary.driftPercent = 100 - summary.matchingPercent;
  }

  // Return the full results
  if (groupByDriftType) {
    return {
      results: driftResults,
      summary,
      grouped: {
        matching: driftResults.filter(r => r.status === 'matching'),
        safe: driftResults.filter(r => r.status === 'safe'),
        minor: driftResults.filter(r => r.status === 'minor'),
        major: driftResults.filter(r => r.status === 'major'),
        missing: driftResults.filter(r => ['missing', 'optional-missing', 'peer-missing'].includes(r.status)),
        extraneous: driftResults.filter(r => r.status === 'extraneous')
      }
    };
  }

  return {
    results: driftResults,
    summary
  };
}

module.exports = {
  analyzeDrift,
  flattenTree,
  classifyVersionDifference
};
