import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import Table from 'cli-table3';

/**
 * Format drift level with color
 * @param {string} level - Drift level
 * @returns {string} Colored drift level text
 */
function formatDriftLevel (level) {
  switch (level) {
  case 'critical':
    return chalk.bold.red(level);
  case 'high':
    return chalk.red(level);
  case 'medium':
    return chalk.yellow(level);
  case 'low':
    return chalk.cyan(level);
  case 'none':
    return chalk.green(level);
  case 'unknown':
  default:
    return chalk.gray(level);
  }
}

/**
 * Format the days behind with color based on threshold
 * @param {number} days - Number of days behind
 * @returns {string} Colored days string
 */
function formatDaysBehind (days) {
  if (days <= 30) {
    return chalk.green(`${days} days`);
  } else if (days <= 90) {
    return chalk.yellow(`${days} days`);
  } else if (days <= 180) {
    return chalk.red(`${days} days`);
  } else {
    return chalk.bgRed.white(`${days} days`);
  }
}

/**
 * Format versions showing diff
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {string} Formatted version string
 */
function formatVersions (current, latest) {
  if (current === latest) {
    return chalk.green(`${current}`);
  }

  return `${chalk.red(current)} → ${chalk.green(latest)}`;
}

/**
 * Format date as a nice string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate (date) {
  if (!date) return 'unknown';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'invalid date';
  }

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format the analysis summary table
 * @param {Object} analysis - Analysis results object
 * @returns {string} Formatted summary
 */
function formatSummary (analysis) {
  if (!analysis) {
    return chalk.red('No analysis results available');
  }

  const { projectName, dependencies } = analysis;
  
  // Get counts, using analysis.totalDependencies or calculating from dependencies
  const totalDependencies = analysis.totalDependencies || (dependencies ? dependencies.length : 0);
  const outdatedDependencies = analysis.outdatedDependencies || 
    (dependencies ? dependencies.filter(d => d.driftLevel !== 'none').length : 0);
  const upToDateDependencies = totalDependencies - outdatedDependencies;
  
  // Count dependencies by drift level
  const driftCounts = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  // Try to get counts from driftSummary if available, otherwise calculate from dependencies
  if (analysis.driftSummary && analysis.driftSummary.levels) {
    Object.keys(driftCounts).forEach(level => {
      driftCounts[level] = analysis.driftSummary.levels[level] || 0;
    });
  } else if (dependencies) {
    // Count manually
    dependencies.forEach(dep => {
      if (dep.driftLevel && driftCounts[dep.driftLevel] !== undefined) {
        driftCounts[dep.driftLevel]++;
      }
    });
  }

  // Build the summary string
  let summary = `\n${chalk.bold(projectName || 'Project')}\n\n`;
  summary += `Total dependencies: ${chalk.bold(totalDependencies)}\n`;
  summary += `Up-to-date: ${chalk.green.bold(upToDateDependencies)} | Needs update: ${chalk.yellow.bold(outdatedDependencies)}\n\n`;

  // Add drift levels breakdown
  summary += `${chalk.bold('Drift Levels:')}\n`;
  summary += `  ${chalk.green('None')}: ${driftCounts.none} ${chalk.gray('(up to date)')}\n`;
  summary += `  ${chalk.cyan('Low')}: ${driftCounts.low}\n`;
  summary += `  ${chalk.yellow('Medium')}: ${driftCounts.medium}\n`;
  summary += `  ${chalk.red('High')}: ${driftCounts.high}\n`;
  summary += `  ${chalk.bgRed.white('Critical')}: ${driftCounts.critical}\n`;

  return summary;
}

/**
 * Format the detailed dependency information
 * @param {Object} dependency - Dependency information
 * @returns {string} Formatted dependency details
 */
function formatDependency (dependency) {
  const {
    name,
    currentVersion,
    latestVersion,
    daysBehind,
    driftLevel,
    lastUpdated
  } = dependency;

  let output = `${chalk.bold(name)}\n`;
  
  // Show version differently depending on whether it's the latest or not
  if (currentVersion === latestVersion || driftLevel === 'none') {
    output += `  Version: ${chalk.green(currentVersion)} ${chalk.gray('(up to date)')}\n`;
  } else {
    output += `  Version: ${formatVersions(currentVersion, latestVersion)}\n`;
  }
  
  // Clarify that "Last updated" refers to when the package was published
  output += `  Last published: ${formatDate(lastUpdated)}\n`;
  
  // Use consistent field name "Status" but different content based on up-to-date status
  if (driftLevel === 'none') {
    output += `  Status: ${chalk.green('Up to date')}\n`;
  } else {
    output += `  Status: ${chalk.yellow('Needs update')} (${formatDaysBehind(daysBehind)} behind)\n`;
  }
  
  output += `  Drift level: ${formatDriftLevel(driftLevel)}\n`;

  return output;
}

/**
 * Format the analysis results as a table
 * @param {Object} results - Analysis results
 * @param {Object} options - Formatting options
 * @returns {string} Formatted table
 */
function formatAsTable (results, options = {}) {
  const { sortBy = 'driftLevel', sortDirection = 'desc', showAll = false } = options;

  // Get dependencies to display
  const deps = showAll ? results.dependencies : results.outdated;

  if (!deps || deps.length === 0) {
    return chalk.green('All dependencies are up to date!');
  }

  // Sort dependencies
  const sortedDeps = [...deps].sort((a, b) => {
    const driftLevels = { 'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'none': 1, 'unknown': 0 };

    let comparison = 0;

    switch (sortBy) {
    case 'driftLevel':
      comparison = driftLevels[b.driftLevel] - driftLevels[a.driftLevel];
      break;
    case 'daysBehind':
      comparison = b.daysBehind - a.daysBehind;
      break;
    case 'name':
      comparison = a.name.localeCompare(b.name);
      break;
    default:
      comparison = 0;
    }

    return sortDirection === 'desc' ? comparison : -comparison;
  });

  // Create table
  const table = new Table({
    head: [
      chalk.bold('Package'),
      chalk.bold('Current'),
      chalk.bold('Latest'),
      chalk.bold('Update Status'),
      chalk.bold('Last Published'),
      chalk.bold('Drift Level')
    ],
    style: {
      head: [] // Empty style for head
    }
  });

  // Add rows
  sortedDeps.forEach(dep => {
    // Format the update status
    let updateStatus;
    if (dep.driftLevel === 'none') {
      updateStatus = chalk.green('Up to date');
    } else {
      updateStatus = chalk.yellow(`Needs update (${dep.daysBehind} days behind)`);
    }

    // Format the last published date
    const lastPublished = formatDate(dep.lastUpdated);

    table.push([
      dep.name,
      dep.currentVersion || '-',
      dep.latestVersion || '-',
      updateStatus,
      lastPublished,
      formatDriftLevel(dep.driftLevel)
    ]);
  });

  return table.toString();
}

/**
 * Format drift summary as a table
 * @param {Object} summary - Drift summary
 * @returns {string} Formatted summary table
 */
function formatDriftSummary (summary) {
  if (!summary) {
    return '';
  }

  const table = new Table({
    head: [
      chalk.bold('Drift Level'),
      chalk.bold('Count')
    ],
    style: {
      head: [] // Empty style for head
    }
  });

  // Add rows in order of severity
  const levels = ['critical', 'high', 'medium', 'low', 'none', 'unknown'];

  levels.forEach(level => {
    if (summary[level] > 0) {
      table.push([
        formatDriftLevel(level),
        summary[level]
      ]);
    }
  });

  return table.toString();
}

/**
 * Format security information
 * @param {Object} security - Security information for a dependency
 * @returns {string} Formatted security info
 */
function formatSecurityInfo (security) {
  if (!security || !security.vulnerable) {
    return `  Security: ${chalk.green('No known vulnerabilities')}\n`;
  }

  let output = `  ${chalk.bold('Security Issues:')}\n`;

  security.vulnerabilities.forEach(vuln => {
    output += `    - ${formatSecuritySeverity(vuln.severity)}: ${vuln.title}\n`;
    if (vuln.recommendation) {
      output += `      ${chalk.green(vuln.recommendation)}\n`;
    }
  });

  return output;
}

/**
 * Format security severity with color
 * @param {string} severity - Security severity level
 * @returns {string} Colored severity text
 */
function formatSecuritySeverity (severity) {
  switch (severity) {
  case 'critical':
    return chalk.bgRed.white(severity);
  case 'high':
    return chalk.red(severity);
  case 'medium':
    return chalk.yellow(severity);
  case 'low':
    return chalk.blue(severity);
  case 'none':
    return chalk.green('safe');
  default:
    return chalk.gray(severity || 'unknown');
  }
}

/**
 * Format results as JSON
 * @param {Object} results - Analysis results
 * @returns {string} JSON formatted string
 */
function formatAsJson (results) {
  // Create a more friendly JSON structure
  const jsonOutput = {
    project: results.projectName,
    version: results.projectVersion,
    timestamp: results.timestamp,
    summary: {
      totalDependencies: results.dependencies.length,
      upToDate: results.dependencies.filter(d => d.driftLevel === 'none').length,
      needsUpdate: results.dependencies.filter(d => d.driftLevel !== 'none').length,
      driftLevels: results.driftSummary?.levels || {}
    },
    dependencies: results.dependencies.map(dep => ({
      name: dep.name,
      currentVersion: dep.currentVersion,
      latestVersion: dep.latestVersion,
      status: dep.driftLevel === 'none' ? 'up-to-date' : 'needs-update',
      daysBehind: dep.daysBehind,
      driftLevel: dep.driftLevel,
      lastPublished: dep.lastUpdated,
      type: dep.type || 'regular'
    }))
  };

  return JSON.stringify(jsonOutput, null, 2);
}

/**
 * Format output based on format option
 * @param {Object} results - Analysis results
 * @param {boolean} colorize - Whether to use colors in output
 * @returns {string} Formatted output
 */
function formatOutput (results, colorize = true) {
  if (!colorize) {
    chalk.level = 0; // Disable colors
  }

  const {
    format = 'text',
    sortBy = 'driftLevel',
    sortDirection = 'desc',
    showAll = false,
    summary = true
  } = results.options || {};

  let output = '';

  if (format === 'json') {
    return formatAsJson(results);
  }

  if (summary) {
    output += formatSummary(results);
  }

  if (format === 'table') {
    output += '\n' + formatAsTable(results, { sortBy, sortDirection, showAll });
  } else {
    // Default to text format
    const deps = showAll ? results.dependencies : results.outdated;

    if (!deps || deps.length === 0) {
      output += chalk.green('\nAll dependencies are up to date!');
    } else {
      output += '\n' + deps.map(dep => formatDependency(dep)).join('\n');
    }
  }

  return output;
}

/**
 * Save output to a file
 * @param {string} content - Content to save
 * @param {string} outputPath - Path to save output
 * @returns {Promise<boolean>} Success status
 */
async function saveOutput (content, outputPath) {
  try {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`Output saved to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error saving output: ${error.message}`);
    return false;
  }
}

export {
  formatDriftLevel,
  formatDaysBehind,
  formatVersions,
  formatDate,
  formatSummary,
  formatDependency,
  formatAsTable,
  formatDriftSummary,
  formatSecurityInfo,
  formatSecuritySeverity,
  formatAsJson,
  formatOutput,
  saveOutput
};
