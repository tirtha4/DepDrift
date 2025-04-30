/**
 * Utility formatters for dependency drift and security output
 *
 * This module provides formatting functions for converting raw analysis data into
 * human-readable and machine-readable formats. It includes functions for:
 * - Color-coding dependency status in terminal output
 * - Generating text reports of analysis results
 * - Converting analysis data to JSON and CSV formats
 * - Formatting specific elements like drift levels, version strings, etc.
 *
 * @module utils/formatters
 */

const chalk = require('chalk');

/**
 * Formats a drift level with color coding for terminal output
 * @param {string} level - Drift level ('none', 'low', 'medium', 'high', 'critical', or 'unknown')
 * @returns {string} Color-coded drift level string with appropriate highlighting
 */
function formatDriftLevel (level) {
  switch (level) {
  case 'none':
    return chalk.green('none');
  case 'low':
    return chalk.blue('low');
  case 'medium':
    return chalk.yellow('medium');
  case 'high':
    return chalk.red('high');
  case 'critical':
    return chalk.bgRed.white('critical');
  default:
    return chalk.gray('unknown');
  }
}

/**
 * Formats a security severity level with color coding for terminal output
 * @param {string} severity - Security severity level ('none', 'low', 'medium', 'high', 'critical', or 'unknown')
 * @returns {string} Color-coded severity string with appropriate highlighting based on severity
 */
function formatSecuritySeverity (severity) {
  switch (severity) {
  case 'none':
    return chalk.green('none');
  case 'low':
    return chalk.blue('low');
  case 'medium':
    return chalk.yellow('medium');
  case 'high':
    return chalk.red('high');
  case 'critical':
    return chalk.bgRed.white('critical');
  default:
    return chalk.gray('unknown');
  }
}

/**
 * Formats a version string with color based on drift level severity
 * @param {string} version - Version string to format
 * @param {string} driftLevel - Drift level to determine color ('none', 'low', 'medium', 'high', 'critical')
 * @returns {string} Color-coded version string reflecting the drift severity
 */
function formatVersion (version, driftLevel) {
  switch (driftLevel) {
  case 'none':
    return chalk.green(version);
  case 'low':
    return chalk.blue(version);
  case 'medium':
    return chalk.yellow(version);
  case 'high':
    return chalk.red(version);
  case 'critical':
    return chalk.bgRed.white(version);
  default:
    return version;
  }
}

/**
 * Formats the complete dependency analysis as a human-readable text report
 *
 * @param {Object} analysis - Analysis results object
 * @param {string} analysis.projectName - Name of the analyzed project
 * @param {string} analysis.projectVersion - Version of the analyzed project
 * @param {string} analysis.packageJsonPath - Path to the package.json file
 * @param {string} analysis.timestamp - Timestamp of the analysis
 * @param {Object} [analysis.overallAssessment] - Overall assessment metrics
 * @param {Object} [analysis.driftSummary] - Summary of drift analysis
 * @param {Object} [analysis.securitySummary] - Summary of security analysis
 * @param {Array<Object>} analysis.dependencies - List of analyzed dependencies
 *
 * @param {Object} [options={}] - Formatting options
 * @param {boolean} [options.includeDetails=true] - Whether to include detailed dependency information
 * @param {boolean} [options.includeSecurity=true] - Whether to include security information
 * @param {string} [options.sortBy='name'] - Sort dependencies by 'name', 'drift', or 'security'
 *
 * @returns {string} Formatted text output suitable for terminal display or file output
 */
function formatAnalysisText (analysis, options = {}) {
  const {
    includeDetails = true,
    includeSecurity = true,
    sortBy = 'name'
  } = options;

  let output = '';

  // Header information
  output += `Project: ${chalk.bold(analysis.projectName)}@${analysis.projectVersion}\n`;
  output += `Path: ${analysis.packageJsonPath}\n`;
  output += `Analyzed on: ${new Date(analysis.timestamp).toLocaleString()}\n\n`;

  // Overall assessment
  if (analysis.overallAssessment) {
    const assessment = analysis.overallAssessment;
    output += chalk.bold('Overall Assessment:\n');
    output += `Status: ${formatAssessmentStatus(assessment.status)}\n`;
    output += `Drift Score: ${formatScore(assessment.driftScore)}\n`;

    if (assessment.securityScore !== null) {
      output += `Security Score: ${formatScore(assessment.securityScore)}\n`;
    }

    output += `Combined Score: ${formatScore(assessment.combinedScore)}\n`;
    output += `Outdated Dependencies: ${assessment.outdatedDependencies} of ${analysis.dependencies.length}\n`;

    if (assessment.vulnerableDependencies !== null) {
      output += `Vulnerable Dependencies: ${assessment.vulnerableDependencies} of ${analysis.dependencies.length}\n`;
    }

    output += '\n';
  }

  // Drift summary
  if (analysis.driftSummary) {
    output += chalk.bold('Drift Summary:\n');
    const { levels, types } = analysis.driftSummary;

    output += 'By Drift Level:\n';
    Object.entries(levels).forEach(([level, count]) => {
      if (count > 0 || level === 'none') {
        output += `  ${formatDriftLevel(level)}: ${count}\n`;
      }
    });

    output += 'By Dependency Type:\n';
    Object.entries(types).forEach(([type, count]) => {
      if (count > 0) {
        output += `  ${type}: ${count}\n`;
      }
    });

    output += '\n';
  }

  // Security summary
  if (analysis.securitySummary && includeSecurity) {
    output += chalk.bold('Security Summary:\n');
    const { severityCounts, sources } = analysis.securitySummary;

    output += 'By Severity:\n';
    Object.entries(severityCounts).forEach(([severity, count]) => {
      if (count > 0 || severity === 'none') {
        output += `  ${formatSecuritySeverity(severity)}: ${count}\n`;
      }
    });

    if (Object.keys(sources).length > 0) {
      output += 'By Source:\n';
      Object.entries(sources).forEach(([source, count]) => {
        output += `  ${source}: ${count}\n`;
      });
    }

    output += '\n';
  }

  // Detailed dependency information
  if (includeDetails && analysis.dependencies && analysis.dependencies.length > 0) {
    output += chalk.bold('Dependencies:\n');

    // Sort dependencies
    const dependencies = [...analysis.dependencies];
    sortDependencies(dependencies, sortBy);

    dependencies.forEach(dep => {
      // Get the security status if available
      const security = dep.security || { vulnerable: false, highestSeverity: 'none' };

      // Format the dependency name based on drift level and security status
      let depName = dep.name;

      if (security.vulnerable) {
        depName = chalk.bold.underline(depName);
      } else if (dep.driftLevel !== 'none') {
        depName = chalk.bold(depName);
      }

      output += `${depName} ${formatDepType(dep)}\n`;
      output += `  Current: ${formatVersion(dep.currentVersion, dep.driftLevel)}\n`;

      if (dep.latestVersion) {
        output += `  Latest: ${chalk.cyan(dep.latestVersion)}\n`;
      }

      if (dep.daysBehind > 0) {
        output += `  Behind: ${formatDaysBehind(dep.daysBehind)}\n`;
      }

      output += `  Drift: ${formatDriftLevel(dep.driftLevel)}\n`;

      // Add security info if available and requested
      if (includeSecurity && security) {
        if (security.vulnerable) {
          output += `  Security: ${formatSecuritySeverity(security.highestSeverity)}\n`;

          // List vulnerabilities if any
          if (security.vulnerabilities && security.vulnerabilities.length > 0) {
            security.vulnerabilities.forEach((vuln, i) => {
              output += `    [${i + 1}] ${vuln.title}\n`;
              if (vuln.recommendation) {
                output += `        ${chalk.cyan(vuln.recommendation)}\n`;
              }
            });
          }
        } else {
          output += `  Security: ${formatSecuritySeverity('none')}\n`;
        }
      }

      output += '\n';
    });
  }

  return output;
}

/**
 * Format dependency analysis as JSON
 * @param {Object} analysis - Analysis results
 * @param {Object} options - Formatting options
 * @param {boolean} [options.pretty=true] - Whether to pretty-print the JSON
 * @returns {string} Formatted JSON output
 */
function formatAnalysisJson (analysis, options = {}) {
  const { pretty = true } = options;

  // Create a clean copy without circular references
  const cleanAnalysis = JSON.parse(JSON.stringify(analysis));

  // Remove chalk color formatting from any strings
  return pretty
    ? JSON.stringify(cleanAnalysis, null, 2)
    : JSON.stringify(cleanAnalysis);
}

/**
 * Format dependency analysis as CSV
 * @param {Object} analysis - Analysis results
 * @returns {string} Formatted CSV output
 */
function formatAnalysisCSV (analysis) {
  if (!analysis.dependencies || analysis.dependencies.length === 0) {
    return 'No dependencies found';
  }

  // CSV header
  let output = 'Name,Current Version,Latest Version,Days Behind,Drift Level,Type,Vulnerable,Security Severity\n';

  // Sort dependencies by name
  const dependencies = [...analysis.dependencies].sort((a, b) => a.name.localeCompare(b.name));

  // Add rows
  dependencies.forEach(dep => {
    const security = dep.security || { vulnerable: false, highestSeverity: 'none' };

    // CSV row fields
    const fields = [
      dep.name,
      dep.currentVersion || '',
      dep.latestVersion || '',
      dep.daysBehind || '0',
      dep.driftLevel || 'unknown',
      getDepType(dep),
      security.vulnerable ? 'Yes' : 'No',
      security.highestSeverity || 'none'
    ];

    // Escape CSV fields and join
    output += fields.map(field => escapeCsvField(String(field))).join(',') + '\n';
  });

  return output;
}

/**
 * Format assessment status with color
 * @private
 * @param {string} status - Assessment status
 * @returns {string} Color-coded status string
 */
function formatAssessmentStatus (status) {
  switch (status) {
  case 'excellent':
    return chalk.green.bold('Excellent');
  case 'good':
    return chalk.blue.bold('Good');
  case 'fair':
    return chalk.yellow.bold('Fair');
  case 'poor':
    return chalk.red.bold('Poor');
  case 'critical':
    return chalk.bgRed.white.bold('Critical');
  default:
    return status;
  }
}

/**
 * Format a score with color based on value
 * @private
 * @param {number} score - Numeric score (0-100)
 * @returns {string} Color-coded score string
 */
function formatScore (score) {
  if (score === null || score === undefined) {
    return chalk.gray('N/A');
  }

  if (score < 10) {
    return chalk.green(score);
  } else if (score < 30) {
    return chalk.blue(score);
  } else if (score < 50) {
    return chalk.yellow(score);
  } else if (score < 70) {
    return chalk.red(score);
  } else {
    return chalk.bgRed.white(score);
  }
}

/**
 * Format days behind with color based on value
 * @private
 * @param {number} days - Number of days behind
 * @returns {string} Color-coded days string
 */
function formatDaysBehind (days) {
  if (days <= 30) {
    return chalk.blue(`${days} days`);
  } else if (days <= 90) {
    return chalk.yellow(`${days} days`);
  } else if (days <= 180) {
    return chalk.red(`${days} days`);
  } else {
    return chalk.bgRed.white(`${days} days`);
  }
}

/**
 * Format dependency type
 * @private
 * @param {Object} dependency - Dependency object
 * @returns {string} Formatted dependency type
 */
function formatDepType (dependency) {
  if (dependency.isDevDependency) {
    return chalk.cyan('[dev]');
  } else if (dependency.isPeerDependency) {
    return chalk.magenta('[peer]');
  } else if (dependency.isOptionalDependency) {
    return chalk.yellow('[optional]');
  }
  return '';
}

/**
 * Get dependency type as a string
 * @private
 * @param {Object} dependency - Dependency object
 * @returns {string} Dependency type
 */
function getDepType (dependency) {
  if (dependency.isDevDependency) {
    return 'dev';
  } else if (dependency.isPeerDependency) {
    return 'peer';
  } else if (dependency.isOptionalDependency) {
    return 'optional';
  }
  return 'regular';
}

/**
 * Sort dependencies by the specified field
 * @private
 * @param {Array<Object>} dependencies - Array of dependencies to sort
 * @param {string} sortBy - Field to sort by
 */
function sortDependencies (dependencies, sortBy) {
  switch (sortBy) {
  case 'drift':
    // Sort by drift level (critical first)
    const driftOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4, unknown: 5 };
    dependencies.sort((a, b) => {
      const orderA = driftOrder[a.driftLevel] || 5;
      const orderB = driftOrder[b.driftLevel] || 5;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
    break;

  case 'security':
    // Sort by security severity (critical first)
    const securityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    dependencies.sort((a, b) => {
      const secA = a.security || { highestSeverity: 'none' };
      const secB = b.security || { highestSeverity: 'none' };
      const orderA = securityOrder[secA.highestSeverity] || 4;
      const orderB = securityOrder[secB.highestSeverity] || 4;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
    break;

  case 'days':
    // Sort by days behind (most days first)
    dependencies.sort((a, b) => {
      const daysA = a.daysBehind || 0;
      const daysB = b.daysBehind || 0;
      return daysB - daysA || a.name.localeCompare(b.name);
    });
    break;

  case 'type':
    // Sort by dependency type
    dependencies.sort((a, b) => {
      const typeA = getDepType(a);
      const typeB = getDepType(b);
      return typeA.localeCompare(typeB) || a.name.localeCompare(b.name);
    });
    break;

  case 'name':
  default:
    // Sort by name (alphabetical)
    dependencies.sort((a, b) => a.name.localeCompare(b.name));
    break;
  }
}

/**
 * Escape a field for CSV output
 * @private
 * @param {string} field - Field to escape
 * @returns {string} Escaped field
 */
function escapeCsvField (field) {
  // If the field contains a comma, newline, or double-quote, wrap it in quotes
  if (/[,\n"]/.test(field)) {
    // Double any existing quotes
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

module.exports = {
  formatDriftLevel,
  formatSecuritySeverity,
  formatVersion,
  formatAnalysisText,
  formatAnalysisJson,
  formatAnalysisCSV
};
