/**
 * Comprehensive dependency assessment module for analyzing package dependencies
 * @module core/assessor
 */

const { analyzePackage } = require('../analyzers/packageAnalyzer');
const { analyzeSecurity } = require('../analyzers/securityAnalyzer');
const { summarizeDriftLevels } = require('../utils/driftUtils');
const fs = require('fs-extra');
const path = require('path');

/**
 * Assesses dependencies in a package.json file for drift and security issues
 * @param {string} packageJsonPath - Path to package.json file to analyze
 * @param {Object} [options={}] - Assessment options
 * @param {boolean} [options.includeDevDependencies=true] - Whether to include dev dependencies
 * @param {boolean} [options.includePeerDependencies=true] - Whether to include peer dependencies
 * @param {boolean} [options.includeOptionalDependencies=true] - Whether to include optional dependencies
 * @param {boolean} [options.checkSecurity=true] - Whether to check for security vulnerabilities
 * @param {Array<string>} [options.securitySources=['NPM_AUDIT']] - Security sources to check (e.g., 'NPM_AUDIT', 'SNYK')
 * @param {boolean} [options.useCache=true] - Whether to use cached results for improved performance
 * @param {number} [options.maxConcurrent=5] - Maximum number of concurrent requests to make
 * @returns {Promise<Object>} Assessment results including drift and security data
 * @throws {Error} If the package.json file cannot be found or parsed
 */
async function assessDependencies (packageJsonPath, options = {}) {
  const {
    includeDevDependencies = true,
    includePeerDependencies = true,
    includeOptionalDependencies = true,
    checkSecurity = true,
    securitySources = ['NPM_AUDIT'],
    useCache = true,
    maxConcurrent = 5
  } = options;

  try {
    // Validate and read package.json
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`Package.json not found at ${packageJsonPath}`);
    }

    const packageJsonContent = await fs.readJson(packageJsonPath);

    // Analyze dependency drift
    const driftAnalysis = await analyzePackage(packageJsonContent, {
      excludeDev: !includeDevDependencies,
      excludePeer: !includePeerDependencies,
      excludeOptional: !includeOptionalDependencies,
      maxConcurrent,
      groupByLevel: true
    });

    // Create combined results object
    const results = {
      projectName: packageJsonContent.name,
      projectVersion: packageJsonContent.version,
      packageJsonPath,
      timestamp: new Date().toISOString(),
      dependencies: driftAnalysis.dependencies,
      driftSummary: driftAnalysis.summary,
      securitySummary: null,
      overallAssessment: null
    };

    // Add security analysis if requested
    if (checkSecurity) {
      const securityAnalysis = await analyzeSecurity(driftAnalysis.dependencies, {
        sources: securitySources,
        useCache,
        maxConcurrent,
        packageJsonPath
      });

      // Merge security info into dependencies
      results.dependencies = results.dependencies.map(dep => {
        const securityInfo = securityAnalysis.results.find(
          s => s.packageName === dep.name && s.version === dep.currentVersion
        );

        if (securityInfo) {
          return {
            ...dep,
            security: {
              vulnerable: securityInfo.vulnerable,
              highestSeverity: securityInfo.highestSeverity,
              vulnerabilities: securityInfo.vulnerabilities
            }
          };
        }

        return {
          ...dep,
          security: {
            vulnerable: false,
            highestSeverity: 'none',
            vulnerabilities: []
          }
        };
      });

      results.securitySummary = securityAnalysis.summary;
    }

    // Calculate overall assessment
    results.overallAssessment = calculateOverallAssessment(results);

    return results;
  } catch (error) {
    throw new Error(`Error assessing dependencies: ${error.message}`);
  }
}

/**
 * Calculates an overall assessment score and status based on drift and security data
 * @private
 * @param {Object} results - Assessment results with dependencies and summaries
 * @param {Array<Object>} results.dependencies - List of analyzed dependencies
 * @param {Object} results.driftSummary - Summary of drift analysis
 * @param {Object} [results.securitySummary] - Summary of security analysis
 * @returns {Object} Overall assessment with scores and status
 * @property {number} driftScore - Score representing drift level (0-100)
 * @property {number|null} securityScore - Score representing security issues (0-100)
 * @property {number} combinedScore - Combined score (0-100)
 * @property {string} status - Status label (excellent, good, fair, poor, critical)
 * @property {number} outdatedDependencies - Count of outdated dependencies
 * @property {number|null} vulnerableDependencies - Count of vulnerable dependencies
 */
function calculateOverallAssessment (results) {
  const { dependencies, driftSummary, securitySummary } = results;

  // Define weights for scoring
  const weights = {
    drift: {
      none: 0,
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1
    },
    security: {
      none: 0,
      low: 0.5,
      medium: 0.7,
      high: 0.9,
      critical: 1
    }
  };

  // Calculate raw score (0-100)
  let driftScore = 0;
  let securityScore = 0;

  // Calculate drift score
  if (driftSummary) {
    const totalDeps = driftSummary.total || dependencies.length;
    if (totalDeps > 0) {
      // Weight each drift level and normalize
      Object.entries(driftSummary.levels).forEach(([level, count]) => {
        if (level !== 'unknown') {
          driftScore += (count * weights.drift[level]);
        }
      });
      driftScore = (driftScore / totalDeps) * 100;
    }
  }

  // Calculate security score if available
  if (securitySummary) {
    const totalDeps = securitySummary.total || dependencies.length;
    if (totalDeps > 0) {
      // Count vulnerabilities by severity
      const vulnerableDeps = dependencies.filter(d => d.security && d.security.vulnerable);

      vulnerableDeps.forEach(dep => {
        securityScore += weights.security[dep.security.highestSeverity];
      });

      securityScore = (securityScore / totalDeps) * 100;
    }
  }

  // Combined score (security is weighted more heavily)
  const hasSecurityData = securitySummary !== null;
  const combinedScore = hasSecurityData
    ? Math.round((driftScore * 0.4) + (securityScore * 0.6))
    : Math.round(driftScore);

  // Determine overall status
  let status;
  if (combinedScore < 10) {
    status = 'excellent';
  } else if (combinedScore < 30) {
    status = 'good';
  } else if (combinedScore < 50) {
    status = 'fair';
  } else if (combinedScore < 70) {
    status = 'poor';
  } else {
    status = 'critical';
  }

  // Critical security vulnerabilities always result in critical status
  if (hasSecurityData && securitySummary.severityCounts.critical > 0) {
    status = 'critical';
  }

  return {
    driftScore: Math.round(driftScore),
    securityScore: hasSecurityData ? Math.round(securityScore) : null,
    combinedScore,
    status,
    outdatedDependencies: dependencies.filter(d => d.driftLevel !== 'none').length,
    vulnerableDependencies: hasSecurityData
      ? dependencies.filter(d => d.security && d.security.vulnerable).length
      : null,
    totalDependencies: dependencies.length,
    criticalUpdates: dependencies.filter(d => d.driftLevel === 'critical').length,
    criticalVulnerabilities: hasSecurityData
      ? dependencies.filter(d => d.security && d.security.highestSeverity === 'critical').length
      : null
  };
}

/**
 * Generates prioritized recommendations for dependency updates based on security and drift analysis
 * @param {Object} assessment - The assessment results object from assessDependencies
 * @param {Array<Object>} assessment.dependencies - List of analyzed dependencies
 * @param {Object} [options={}] - Options for generating recommendations
 * @param {number} [options.maxRecommendations=5] - Maximum number of recommendations to return
 * @returns {Array<Object>} Array of prioritized recommendations
 * @property {string} type - Type of recommendation ('security' or 'drift')
 * @property {number} priority - Priority score for sorting (higher = more important)
 * @property {string} dependencyName - Name of the dependency
 * @property {string} currentVersion - Current version of the dependency
 * @property {string} [latestVersion] - Latest version available (for drift recommendations)
 * @property {string} recommendation - Text recommendation of what action to take
 * @property {string} details - Additional details about the recommendation
 * @public
 * @example
 * // Generate top 3 recommendations
 * const recommendations = generateRecommendations(assessmentResult, { maxRecommendations: 3 });
 * // Example output
 * // [{ type: 'security', priority: 180, dependencyName: 'lodash', ... }]
 */
function generateRecommendations (assessment, options = {}) {
  const { maxRecommendations = 5 } = options;
  const { dependencies } = assessment;

  if (!dependencies || dependencies.length === 0) {
    return [];
  }

  // Generate recommendations for each dependency
  const allRecommendations = dependencies.map(dep => {
    const recommendations = [];

    // Security vulnerabilities (highest priority)
    if (dep.security && dep.security.vulnerable) {
      const vulnerabilities = dep.security.vulnerabilities || [];

      if (vulnerabilities.length > 0) {
        // Use the first vulnerability's recommendation or create a generic one
        const vuln = vulnerabilities[0];
        recommendations.push({
          type: 'security',
          priority: getPriorityScore('security', dep.security.highestSeverity),
          dependencyName: dep.name,
          currentVersion: dep.currentVersion,
          recommendation: vuln.recommendation || `Upgrade to fix ${vulnerabilities.length} security ${vulnerabilities.length === 1 ? 'issue' : 'issues'}`,
          details: `${dep.security.highestSeverity} severity: ${vuln.title}`
        });
      }
    }

    // Version drift (second priority)
    if (dep.driftLevel && dep.driftLevel !== 'none') {
      recommendations.push({
        type: 'drift',
        priority: getPriorityScore('drift', dep.driftLevel),
        dependencyName: dep.name,
        currentVersion: dep.currentVersion,
        latestVersion: dep.latestVersion,
        recommendation: `Update to version ${dep.latestVersion}`,
        details: `${dep.driftLevel} drift: ${dep.daysBehind} days behind`
      });
    }

    return recommendations;
  }).flat();

  // Sort by priority (highest first)
  allRecommendations.sort((a, b) => b.priority - a.priority);

  // Return top N recommendations
  return allRecommendations.slice(0, maxRecommendations);
}

/**
 * Calculates a priority score for a recommendation to enable sorting
 * @private
 * @param {string} type - Recommendation type ('security' or 'drift')
 * @param {string} level - Severity or drift level (critical, high, medium, low, none)
 * @returns {number} Priority score (higher = more important)
 */
function getPriorityScore (type, level) {
  const baseScore = type === 'security' ? 100 : 50;

  const levelScores = {
    critical: 100,
    high: 80,
    medium: 60,
    low: 40,
    none: 0,
    unknown: 20
  };

  return baseScore + (levelScores[level] || 0);
}

/**
 * Assesses multiple packages in batch mode for drift and security issues
 * @param {Array<string>} projectPaths - Array of paths to package.json files to analyze
 * @param {Object} [options={}] - Assessment options (same as assessDependencies)
 * @param {boolean} [options.includeDevDependencies=true] - Whether to include dev dependencies
 * @param {boolean} [options.includePeerDependencies=true] - Whether to include peer dependencies
 * @param {boolean} [options.includeOptionalDependencies=true] - Whether to include optional dependencies
 * @param {boolean} [options.checkSecurity=true] - Whether to check for security vulnerabilities
 * @returns {Promise<Array<Object>>} Array of assessment results, one per project
 * @property {string} packageJsonPath - Path to the package.json that was analyzed
 * @property {string} projectName - Name of the project from package.json
 * @property {string} projectVersion - Version of the project from package.json
 * @property {string} timestamp - ISO timestamp of when the analysis was performed
 * @property {Array<Object>} dependencies - List of dependencies with drift and security info
 * @property {Object} driftSummary - Summary of drift analysis
 * @property {Object} [securitySummary] - Summary of security analysis if performed
 * @property {Object} [overallAssessment] - Overall assessment scores and status
 * @property {string} [error] - Error message if analysis failed for this project
 * @throws {Error} If the projectPaths array is invalid
 * @public
 * @example
 * // Assess multiple projects
 * const results = await batchAssessDependencies([
 *   '/path/to/project1/package.json',
 *   '/path/to/project2/package.json'
 * ]);
 */
async function batchAssessDependencies (projectPaths, options = {}) {
  const results = [];

  for (const path of projectPaths) {
    try {
      const result = await assessDependencies(path, options);
      results.push(result);
    } catch (error) {
      results.push({
        packageJsonPath: path,
        error: error.message,
        dependencies: [],
        timestamp: new Date().toISOString()
      });
    }
  }

  return results;
}

module.exports = {
  assessDependencies,
  generateRecommendations,
  batchAssessDependencies
};
