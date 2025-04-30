/**
 * Unified Reporter module for displaying and saving drift analysis results
 * @module formatters/reporter
 */
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { formatDriftLevel, formatSecuritySeverity } = require('../utils/formatters');
const tableFormatter = require('./tableFormatter');
const textFormatter = require('./textFormatter');

/**
 * Report dependency drift to console and/or file
 * @param {Object} analysis - The complete analysis results
 * @param {Object} options - Report options
 * @param {boolean} [options.json=false] - Whether to output as JSON
 * @param {string} [options.output] - Path to output file (if saving to file)
 * @param {string} [options.format='table'] - Output format ('table', 'text', 'json', 'csv', 'html')
 * @param {boolean} [options.showAll=false] - Whether to show all dependencies or only issues
 * @param {string} [options.sortBy='drift'] - How to sort dependencies ('drift', 'security', 'name', 'days')
 * @param {boolean} [options.compact=false] - Use compact table format
 * @param {boolean} [options.includeSecurity=true] - Include security information
 * @returns {Promise<void>}
 */
async function reportAnalysis (analysis, options = {}) {
  const {
    json = false,
    output,
    format = 'table',
    showAll = false,
    sortBy = 'drift',
    compact = false,
    includeSecurity = true
  } = options;

  if (!analysis || !analysis.dependencies) {
    console.log(chalk.yellow('No analysis results to report.'));

    if (output) {
      await fs.writeJson(output, { dependencies: [] }, { spaces: 2 });
      console.log(chalk.gray(`Empty report written to ${output}`));
    }

    return;
  }

  // Format the analysis based on requested format
  let formattedOutput;

  switch (format.toLowerCase()) {
  case 'json':
    formattedOutput = formatAnalysisJson(analysis, { pretty: true });
    break;

  case 'text':
    formattedOutput = formatAnalysisText(analysis, {
      includeDetails: true,
      includeSecurity,
      sortBy
    });
    break;

  case 'csv':
    formattedOutput = formatAnalysisCSV(analysis);
    break;

  case 'html':
    // For future support of HTML output
    throw new Error('HTML output format not yet implemented');

  case 'table':
  default:
    // Get formatted tables using the tableFormatter
    formattedOutput = tableFormatter.formatAnalysisAsTables(analysis, {
      compact,
      includeSecurity,
      sortBy,
      showAll
    });
  }

  // Display output to console if not suppressed
  if (!options.silent) {
    console.log(formattedOutput);
  }

  // Save to file if output path provided
  if (output) {
    await saveReport(formattedOutput, output, format);
    console.log(chalk.green(`\nReport saved to ${output}`));
  }

  return formattedOutput;
}

/**
 * Generate a summary of analysis results
 * @param {Object} analysis - Complete analysis results
 * @returns {Object} Summary object
 */
function generateSummary (analysis) {
  if (!analysis || !analysis.dependencies || analysis.dependencies.length === 0) {
    return {
      total: 0,
      outdated: 0,
      vulnerable: 0,
      driftLevels: {},
      securitySeverities: {}
    };
  }

  const summary = {
    total: analysis.dependencies.length,
    outdated: 0,
    vulnerable: 0,
    driftLevels: {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    securitySeverities: {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
  };

  // Count by drift level and security severity
  analysis.dependencies.forEach(dep => {
    const driftLevel = dep.driftLevel || 'none';
    const securitySeverity = dep.security?.highestSeverity || 'none';

    // Count drift levels
    summary.driftLevels[driftLevel] = (summary.driftLevels[driftLevel] || 0) + 1;

    // Count if outdated
    if (driftLevel !== 'none') {
      summary.outdated++;
    }

    // Count security severities
    summary.securitySeverities[securitySeverity] =
      (summary.securitySeverities[securitySeverity] || 0) + 1;

    // Count if vulnerable
    if (securitySeverity !== 'none') {
      summary.vulnerable++;
    }
  });

  return summary;
}

/**
 * Save report to file
 * @param {string} content - Report content
 * @param {string} filePath - Path to save report
 * @param {string} format - Report format
 * @returns {Promise<void>}
 */
async function saveReport (content, filePath, format) {
  try {
    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(filePath));

    switch (format.toLowerCase()) {
    case 'json':
      // For json string, parse and then write to ensure proper formatting
      const jsonObj = typeof content === 'string' ? JSON.parse(content) : content;
      await fs.writeJson(filePath, jsonObj, { spaces: 2 });
      break;

    case 'csv':
    case 'text':
    case 'table':
    case 'html':
    default:
      // For all other formats, write as string
      await fs.writeFile(filePath, content);
    }
  } catch (error) {
    throw new Error(`Failed to save report: ${error.message}`);
  }
}

/**
 * Get color function for drift status
 * @param {string} status - Drift status
 * @returns {Function} Chalk color function
 */
function getStatusColor (status) {
  switch (status.toLowerCase()) {
  case 'missing':
  case 'major':
  case 'extra':
  case 'critical':
  case 'high':
  case 'peer-missing':
    return chalk.red;

  case 'minor':
  case 'medium':
    return chalk.yellow;

  case 'patch':
  case 'low':
    return chalk.cyan;

  case 'safe':
  case 'none':
  case 'optional-missing':
    return chalk.green;

  case 'unknown':
  default:
    return chalk.gray;
  }
}

/**
 * Legacy function for backward compatibility
 * Report dependency drift records to console and/or file
 * @param {Array} records - Array of dependency records to report
 * @param {Object} options - Report options
 * @returns {Promise<void>}
 */
async function reportDrift (records, options = {}) {
  const {
    json = false,
    jsonFile = 'drift-report.json',
    showAll = false,
    sortBy = 'status',
    sortDirection = 'desc',
    title = 'Dependency Drift Report'
  } = options;

  console.log(chalk.yellow('Warning: reportDrift is deprecated. Please use reportAnalysis instead.'));

  if (!records || !Array.isArray(records) || records.length === 0) {
    console.log(chalk.yellow('No dependency drift records to report.'));

    if (json) {
      await fs.writeJson(jsonFile, { records: [] }, { spaces: 2 });
      console.log(chalk.gray(`Empty report written to ${jsonFile}`));
    }

    return;
  }

  // Convert old-style records to new analysis format
  const analysis = {
    projectName: 'Project',
    projectVersion: '1.0.0',
    packageJsonPath: '',
    timestamp: Date.now(),
    dependencies: records.map(record => ({
      name: record.package,
      currentVersion: record.installed,
      latestVersion: record.expected,
      driftLevel: record.status.toLowerCase(),
      daysBehind: 0
    }))
  };

  // Use new reporter with old options
  await reportAnalysis(analysis, {
    json,
    output: json ? jsonFile : undefined,
    format: 'table',
    showAll,
    sortBy: sortBy === 'status' ? 'drift' : sortBy,
    compact: false,
    includeSecurity: false
  });
}

// Use local name references to imported formatters to avoid circular dependencies
const { formatAnalysisJson, formatAnalysisText, formatAnalysisCSV } = require('../utils/formatters');

module.exports = {
  reportAnalysis,
  generateSummary,
  saveReport,
  getStatusColor,
  // Legacy exports for backward compatibility
  reportDrift,
  generateDriftSummary: generateSummary,
  saveDriftReport: saveReport
};
