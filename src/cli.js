#!/usr/bin/env node

/**
 * Command line interface for DepDrift
 */

const { assessDependencies, generateRecommendations } = require('./core/assessor');
const { formatAnalysisText, formatAnalysisJson, formatAnalysisCSV } = require('./utils/formatters');
const { formatAnalysisAsTables } = require('./formatters/tableFormatter');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { handleError, handleWarning } = require('./utils/errorHandler');
const { generateTable } = require('./formatters/tableFormatter');
const { generateHtmlReport } = require('./formatters/htmlFormatter');
const { formatAnalysisText } = require('./formatters/textFormatter');
const { displayRecommendations, displayVulnerabilities } = require('./formatters/reporter');

// Force chalk to enable colors for non-TTY environments when needed
if (process.env.FORCE_COLOR) {
  chalk.level = 2;
}

/**
 * Find package.json in the specified directory or parent directories
 * @param {string} startDir - Starting directory
 * @returns {string|null} Path to package.json or null if not found
 */
function findPackageJson (startDir) {
  let currentDir = startDir;

  // Set a limit to avoid infinite loops
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }

    // Go up one directory
    const parentDir = path.dirname(currentDir);

    // If we're at the root directory, stop searching
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    iterations++;
  }

  return null;
}

/**
 * Parse exclude types string into array
 * @param {string} excludeTypes - Comma-separated list of types to exclude
 * @returns {Object} Object with boolean flags for each type
 */
function parseExcludeTypes (excludeTypes) {
  const result = {
    excludeDev: false,
    excludePeer: false,
    excludeOptional: false
  };

  if (!excludeTypes) {
    return result;
  }

  const types = excludeTypes.split(',').map(t => t.trim().toLowerCase());

  if (types.includes('dev')) {
    result.excludeDev = true;
  }

  if (types.includes('peer')) {
    result.excludePeer = true;
  }

  if (types.includes('optional')) {
    result.excludeOptional = true;
  }

  return result;
}

/**
 * Parse security sources string into array
 * @param {string} sourceString - Comma-separated list of security sources
 * @returns {Array<string>} Array of security source names
 */
function parseSecuritySources (sourceString) {
  if (!sourceString) {
    return ['NPM_AUDIT'];
  }

  return sourceString.split(',').map(s => s.trim().toUpperCase());
}

/**
 * Format drift level with colors
 * @param {string} level - Drift level
 * @returns {string} Colored drift level
 */
function formatDriftLevel (level) {
  if (!level) return chalk.gray('unknown');

  switch (level.toLowerCase()) {
  case 'critical': return chalk.red.bold('Critical');
  case 'high': return chalk.red('High');
  case 'medium': return chalk.yellow('Medium');
  case 'low': return chalk.green('Low');
  case 'none': return chalk.green('None');
  default: return chalk.gray(level);
  }
}

/**
 * Format security severity with colors
 * @param {string} severity - Security severity
 * @returns {string} Colored security severity
 */
function formatSecuritySeverity (severity) {
  if (!severity) return chalk.gray('unknown');

  switch (severity.toLowerCase()) {
  case 'critical': return chalk.bgRed.white.bold(' Critical ');
  case 'high': return chalk.bgRed.white(' High ');
  case 'medium': return chalk.bgYellow.black(' Medium ');
  case 'low': return chalk.bgGreen.black(' Low ');
  case 'none': return chalk.green('None');
  default: return chalk.gray(severity);
  }
}

/**
 * Format date as time ago
 * @param {number} days - Days behind
 * @returns {string} Formatted time ago
 */
function formatTimeAgo (days) {
  if (days === 0) return chalk.green('Today');
  if (days === 1) return chalk.green('Yesterday');
  if (days < 30) return chalk.green(`${days} days ago`);
  if (days < 90) return chalk.yellow(`${days} days ago`);
  if (days < 365) {
    const months = Math.floor(days / 30);
    return chalk.yellow(`${months} ${months === 1 ? 'month' : 'months'} ago`);
  }

  const years = Math.floor(days / 365);
  return chalk.red(`${years} ${years === 1 ? 'year' : 'years'} ago`);
}

/**
 * Generate table for the analysis results
 * @param {Object} results - Analysis results
 * @returns {string} Table output
 */
function generateTable (results) {
  // Create a new table
  const table = new Table({
    head: [
      chalk.cyan.bold('Package'),
      chalk.cyan.bold('Current'),
      chalk.cyan.bold('Latest'),
      chalk.cyan.bold('Update Status'),
      chalk.cyan.bold('Last Updated'),
      chalk.cyan.bold('Drift'),
      chalk.cyan.bold('Security')
    ],
    colWidths: [20, 12, 12, 25, 20, 15, 20]
  });

  // Add rows for each dependency
  results.dependencies.forEach(dep => {
    const hasVulnerabilities = dep.security &&
      dep.security.vulnerable &&
      dep.security.vulnerabilities.length > 0;

    // Create update status message
    let updateStatus;
    if (dep.driftLevel === 'none') {
      updateStatus = chalk.green('Up to date');
    } else {
      updateStatus = chalk.yellow(`Needs update (${dep.daysBehind} days behind)`);
    }

    // Prepare security info
    let securityInfo = formatSecuritySeverity(dep.security?.highestSeverity || 'none');

    if (hasVulnerabilities) {
      const vulnCount = dep.security.vulnerabilities.length;
      securityInfo += `\n${chalk.red(`${vulnCount} ${vulnCount === 1 ? 'issue' : 'issues'}`)}`;
    }

    // Calculate the date last updated (current date - days behind)
    const lastUpdatedDays = dep.daysBehind || 0;
    const lastUpdated = formatTimeAgo(lastUpdatedDays);

    table.push([
      chalk.white.bold(dep.name) + (dep.isDev ? chalk.gray(' [dev]') : ''),
      dep.currentVersion,
      dep.latestVersion,
      updateStatus,
      lastUpdated,
      formatDriftLevel(dep.driftLevel),
      securityInfo
    ]);
  });

  return table.toString();
}

/**
 * Generate HTML report for the analysis results
 * @param {Object} results - Analysis results
 * @returns {string} HTML report
 */
function generateHtmlReport (results) {
  // Start with HTML structure
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dependency Analysis: ${results.projectName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #0366d6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #f6f8fa;
      text-align: left;
      padding: 10px;
      border-bottom: 2px solid #dfe2e5;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #eaecef;
      vertical-align: top;
    }
    .summary {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .status {
      font-weight: bold;
      padding: 3px 8px;
      border-radius: 3px;
    }
    .excellent { background-color: #28a745; color: white; }
    .good { background-color: #34d058; color: white; }
    .fair { background-color: #ffcc00; color: #24292e; }
    .poor { background-color: #d73a49; color: white; }
    .critical { background-color: #d73a49; color: white; }
    .high { background-color: #ea4a5a; color: white; }
    .medium { background-color: #ffcc00; color: #24292e; }
    .low { background-color: #28a745; color: white; }
    .none { color: #6a737d; }
    .drift-critical { color: #d73a49; font-weight: bold; }
    .drift-high { color: #ea4a5a; font-weight: bold; }
    .drift-medium { color: #ffcc00; }
    .drift-low { color: #28a745; }
    .drift-none { color: #6a737d; }
    .security { display: inline-block; }
    .updates-needed {
      color: #d73a49;
    }
    .up-to-date {
      color: #28a745;
    }
    .explanation {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
    }
    .vulnerabilities {
      margin-top: 20px;
    }
    .vuln-item {
      background-color: #ffe3e3;
      border: 1px solid #d73a49;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 10px;
    }
    .vuln-title {
      font-weight: bold;
      color: #d73a49;
    }
    .last-updated-recent { color: #28a745; }
    .last-updated-medium { color: #ffcc00; }
    .last-updated-old { color: #d73a49; }
  </style>
</head>
<body>
  <h1>Dependency Analysis Report</h1>
  <div class="summary">
    <h2>${results.projectName}@${results.projectVersion}</h2>
    <p>Analysis date: ${new Date(results.timestamp).toLocaleString()}</p>
    <p>Overall status: <span class="status ${results.overallAssessment.status.toLowerCase()}">${results.overallAssessment.status}</span></p>
    <p>Outdated dependencies: ${results.overallAssessment.outdatedDependencies} of ${results.overallAssessment.totalDependencies}</p>
    <p>Vulnerable dependencies: ${results.securitySummary.vulnerable} of ${results.securitySummary.total}</p>
  </div>

  <h2>Dependencies</h2>
  <table>
    <thead>
      <tr>
        <th>Package</th>
        <th>Current</th>
        <th>Latest</th>
        <th>Update Status</th>
        <th>Last Updated</th>
        <th>Drift</th>
        <th>Security</th>
      </tr>
    </thead>
    <tbody>
`;

  // Sort dependencies by security severity and drift level
  results.dependencies.sort((a, b) => {
    // Sort by security severity first
    const securityOrder = { high: 3, medium: 2, low: 1, none: 0 };
    const securityDiff =
      securityOrder[b.security?.highestSeverity || 'none'] -
      securityOrder[a.security?.highestSeverity || 'none'];

    if (securityDiff !== 0) return securityDiff;

    // Then sort by drift level
    const driftOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    return driftOrder[b.driftLevel || 'none'] - driftOrder[a.driftLevel || 'none'];
  }).forEach(dep => {
    const hasVulnerabilities = dep.security &&
      dep.security.vulnerable &&
      dep.security.vulnerabilities.length > 0;

    // Create update status message
    let updateStatusHtml;
    if (dep.driftLevel === 'none') {
      updateStatusHtml = '<span class="up-to-date">Up to date</span>';
    } else {
      updateStatusHtml = `<span class="updates-needed">Needs update (${dep.daysBehind} days behind)</span>`;
    }

    // Create last updated class
    let lastUpdatedClass = 'last-updated-recent';
    if (dep.daysBehind > 90) {
      lastUpdatedClass = 'last-updated-old';
    } else if (dep.daysBehind > 30) {
      lastUpdatedClass = 'last-updated-medium';
    }

    // Format last updated date
    let lastUpdatedText;
    if (dep.daysBehind === 0) {
      lastUpdatedText = 'Today';
    } else if (dep.daysBehind === 1) {
      lastUpdatedText = 'Yesterday';
    } else if (dep.daysBehind < 30) {
      lastUpdatedText = `${dep.daysBehind} days ago`;
    } else if (dep.daysBehind < 365) {
      const months = Math.floor(dep.daysBehind / 30);
      lastUpdatedText = `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
      const years = Math.floor(dep.daysBehind / 365);
      lastUpdatedText = `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }

    // Prepare security info
    let securityHtml = `<span class="security ${dep.security?.highestSeverity || 'none'}">${dep.security?.highestSeverity || 'none'}</span>`;

    if (hasVulnerabilities) {
      const vulnCount = dep.security.vulnerabilities.length;
      securityHtml += `<br>${vulnCount} ${vulnCount === 1 ? 'issue' : 'issues'}`;
    }

    html += `
      <tr>
        <td><strong>${dep.name}</strong>${dep.isDev ? ' <em>[dev]</em>' : ''}</td>
        <td>${dep.currentVersion}</td>
        <td>${dep.latestVersion}</td>
        <td>${updateStatusHtml}</td>
        <td class="${lastUpdatedClass}">${lastUpdatedText}</td>
        <td class="drift-${dep.driftLevel || 'none'}">${dep.driftLevel || 'none'}</td>
        <td>${securityHtml}</td>
      </tr>
    `;
  });

  html += `
    </tbody>
  </table>

  <div class="explanation">
    <h3>Explanation</h3>
    <ul>
      <li><strong>Update Status</strong>: Shows if you need to update the package</li>
      <li><strong>Last Updated</strong>: When the latest version was published</li>
      <li><strong>Drift</strong>: How far your version is behind the latest</li>
      <li><strong>Security</strong>: Highest severity of any known vulnerabilities</li>
    </ul>
  </div>
  `;

  // Add vulnerability details if any
  if (results.securitySummary.vulnerable > 0) {
    html += `
    <div class="vulnerabilities">
      <h2>Security Vulnerabilities</h2>
    `;

    results.dependencies.forEach(dep => {
      if (dep.security && dep.security.vulnerable) {
        html += `<h3>${dep.name}@${dep.currentVersion}</h3>`;

        dep.security.vulnerabilities.forEach((vuln, index) => {
          html += `
          <div class="vuln-item">
            <div class="vuln-title">${vuln.title} (${vuln.severity})</div>
            <p><strong>ID:</strong> ${vuln.id}</p>
            <p><strong>URL:</strong> <a href="${vuln.url || '#'}" target="_blank">${vuln.url || 'N/A'}</a></p>
            <p><strong>Patched in:</strong> ${vuln.patchedIn}</p>
            <p><strong>Recommendation:</strong> ${vuln.recommendation}</p>
          </div>
          `;
        });
      }
    });

    html += '</div>';
  }

  html += `
  </body>
  </html>
  `;

  return html;
}

async function processResults (results, argv) {
  let output;
  let formattedOutput;

  switch (argv.format) {
    case 'json': {
      formattedOutput = JSON.stringify(results, null, 2);
      break;
    }
    case 'csv': {
      formattedOutput = generateCsvReport(results);
      break;
    }
    case 'table': {
      formattedOutput = generateTable(results);
      break;
    }
    case 'html': {
      formattedOutput = generateHtmlReport(results);
      break;
    }
    default: {
      formattedOutput = formatAnalysisText(results, {
        includeDetails: true,
        includeSecurity: true
      });
    }
  }

  if (argv.output) {
    await fs.writeFile(argv.output, formattedOutput);
    handleWarning(`Analysis results written to ${argv.output}`);
  } else {
    handleWarning(formattedOutput);
  }

  if (argv.recommendations) {
    displayRecommendations(results, argv);
  }

  if (results.securitySummary.vulnerable > 0 && argv.showVulnerabilities) {
    displayVulnerabilities(results);
  }
}

/**
 * Main CLI function
 * @param {Object} argv - Command line arguments
 */
async function main (argv) {
  try {
    // Process paths
    let packageJsonPath = argv.path;

    if (!packageJsonPath) {
      // Try to find package.json in current directory
      packageJsonPath = findPackageJson(process.cwd());

      if (!packageJsonPath) {
        console.error('Error: Could not find package.json in current directory');
        process.exit(1);
      }
    } else {
      // Check if the path is a directory or file
      if (fs.statSync(packageJsonPath).isDirectory()) {
        packageJsonPath = findPackageJson(packageJsonPath);

        if (!packageJsonPath) {
          console.error(`Error: Could not find package.json in ${argv.path}`);
          process.exit(1);
        }
      } else if (!packageJsonPath.endsWith('package.json')) {
        console.error('Error: Specified path does not point to a package.json file');
        process.exit(1);
      }
    }

    // Set up analysis options
    const { excludeDev, excludePeer, excludeOptional } = parseExcludeTypes(argv.excludeTypes);
    const securitySources = parseSecuritySources(argv.securitySources);

    const options = {
      includeDevDependencies: !excludeDev,
      includePeerDependencies: !excludePeer,
      includeOptionalDependencies: !excludeOptional,
      checkSecurity: !argv.noSecurity,
      securitySources,
      useCache: argv.cache,
      maxConcurrent: argv.maxConcurrent
    };

    // Run the analysis
    const results = await assessDependencies(packageJsonPath, options);

    // Sort dependencies if requested
    if (argv.sortBy) {
      const sortBy = argv.sortBy.toLowerCase();
      const sortDirection = argv.sortDirection.toLowerCase() === 'asc' ? 1 : -1;

      results.dependencies.sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
        case 'name':
          return sortDirection * a.name.localeCompare(b.name);
        case 'driftlevel':
          const driftOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
          aValue = driftOrder[a.driftLevel || 'none'];
          bValue = driftOrder[b.driftLevel || 'none'];
          break;
        case 'daysbehind':
          aValue = a.daysBehind || 0;
          bValue = b.daysBehind || 0;
          break;
        case 'security':
          const securityOrder = { critical: 3, high: 2, medium: 1, low: 0, none: -1 };
          aValue = securityOrder[a.security?.highestSeverity || 'none'];
          bValue = securityOrder[b.security?.highestSeverity || 'none'];
          break;
        default:
          return 0;
        }

        return sortDirection * (bValue - aValue);
      });
    }

    // Filter dependencies to show only outdated ones if requested
    if (!argv.showAll) {
      results.dependencies = results.dependencies.filter(dep =>
        dep.driftLevel !== 'none' ||
        (dep.security && dep.security.vulnerable)
      );
    }

    // Generate output
    await processResults(results, argv);
  } catch (error) {
    handleError(error, 'An error occurred while running the analysis');
  }
}

module.exports = { main };