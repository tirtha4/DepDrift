/**
 * DepDrift JSON Formatter
 * Formats dependency analysis results as JSON
 *
 * @module formatters/jsonFormatter
 */

/**
 * Generate a JSON report from the analysis results
 * @param {Object} results - Analysis results
 * @returns {string} JSON formatted string
 */
function generateJsonReport(results) {
  // Create a copy of the results to avoid modifying the original
  const reportData = {
    projectName: results.projectName || 'Unknown',
    projectVersion: results.projectVersion || '',
    timestamp: new Date().toISOString(),
    summary: {
      totalDependencies: results.dependencies?.length || 0,
      upToDate: results.dependencies?.filter(dep => dep.driftLevel === 'none').length || 0,
      needsUpdate: results.dependencies?.filter(dep => dep.driftLevel !== 'none').length || 0,
      vulnerableDependencies: results.dependencies?.filter(dep => dep.security && dep.security.vulnerable).length || 0,
      driftLevels: countDriftLevels(results.dependencies || []),
      securitySeverities: countSecuritySeverities(results.dependencies || [])
    },
    dependencies: (results.dependencies || []).map(dep => ({
      name: dep.name,
      type: getDependencyType(dep),
      currentVersion: dep.currentVersion,
      latestVersion: dep.latestVersion,
      status: dep.driftLevel === 'none' ? 'up-to-date' : 'needs-update',
      daysBehind: dep.daysBehind || 0,
      driftLevel: dep.driftLevel || 'none',
      lastPublished: dep.lastPublished,
      security: formatSecurityInfo(dep.security)
    })),
    recommendations: results.recommendations || []
  };

  return JSON.stringify(reportData, null, 2);
}

/**
 * Count the number of dependencies in each drift level
 * @param {Array} dependencies - Array of dependency objects
 * @returns {Object} Counts by drift level
 */
function countDriftLevels(dependencies) {
  const levels = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  dependencies.forEach(dep => {
    const level = dep.driftLevel || 'none';
    if (levels[level] !== undefined) {
      levels[level]++;
    } else {
      levels[level] = 1;
    }
  });

  return levels;
}

/**
 * Count the number of dependencies in each security severity level
 * @param {Array} dependencies - Array of dependency objects
 * @returns {Object} Counts by security severity
 */
function countSecuritySeverities(dependencies) {
  const severities = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  dependencies.forEach(dep => {
    const severity = dep.security?.highestSeverity || 'none';
    if (severities[severity] !== undefined) {
      severities[severity]++;
    } else {
      severities[severity] = 1;
    }
  });

  return severities;
}

/**
 * Get the dependency type as a string
 * @param {Object} dependency - Dependency object
 * @returns {string} Dependency type
 */
function getDependencyType(dependency) {
  if (dependency.isDevDependency) return 'dev';
  if (dependency.isPeerDependency) return 'peer';
  if (dependency.isOptionalDependency) return 'optional';
  return 'regular';
}

/**
 * Format security information for output
 * @param {Object} security - Security object
 * @returns {Object} Formatted security info
 */
function formatSecurityInfo(security) {
  if (!security || !security.vulnerable) {
    return { vulnerable: false };
  }

  return {
    vulnerable: security.vulnerable,
    highestSeverity: security.highestSeverity || 'unknown',
    vulnerabilities: (security.vulnerabilities || []).map(vuln => ({
      id: vuln.id,
      title: vuln.title,
      severity: vuln.severity,
      url: vuln.url,
      patchedIn: vuln.patchedIn,
      source: vuln.source
    }))
  };
}

export { generateJsonReport }; 