/**
 * Table formatter for dependency drift and security output
 * @module formatters/tableFormatter
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import { formatDriftLevel, formatSecuritySeverity } from '../utils/formatters.js';

/**
 * Get terminal width
 * @returns {number} Width of terminal in columns
 */
function getTerminalWidth () {
  return process.stdout.columns || 80;
}

/**
 * Format a date as "time ago"
 * @param {Date} date - Date to format
 * @returns {string} Formatted time ago string
 */
function formatTimeAgo (date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 30) {
    return `${diffDays} days ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}

/**
 * Create a colored table of dependencies with drift and security information
 * @param {Object} analysis - The analysis results
 * @param {Object} options - Table formatting options
 * @param {boolean} [options.compact=false] - Whether to use a compact view
 * @param {boolean} [options.includeSecurity=true] - Whether to include security columns
 * @param {string} [options.sortBy='drift'] - Sort by: 'drift', 'security', 'name', 'days'
 * @param {string} [options.sortDirection='desc'] - Sort direction: 'asc' or 'desc'
 * @param {boolean} [options.useImprovedFormat=true] - Whether to use the improved table format
 * @param {boolean} [options.showAll=false] - Whether to show all dependencies or only issues
 * @returns {string} Table output as string
 */
function createDependencyTable (analysis, options = {}) {
  const {
    compact = false,
    includeSecurity = true,
    sortBy = 'drift',
    sortDirection = 'desc',
    useImprovedFormat = true,
    showAll = false
  } = options;

  // Define table columns based on options
  const columns = useImprovedFormat
    ? ['Package', 'Current', 'Latest', 'Update Status', 'Last Published', 'Drift']
    : compact
      ? ['Package', 'Current', 'Latest', 'Drift']
      : ['Package', 'Current', 'Latest', 'Days Behind', 'Drift'];

  // Add security columns if requested
  if (includeSecurity) {
    columns.push('Security');
  }

  // Calculate available terminal width
  const terminalWidth = getTerminalWidth();

  // Calculate column widths proportionally based on typical content size and terminal width
  const tableWidth = terminalWidth - 5; // Allow some padding

  // Define column width ratios
  let colWidths;

  if (useImprovedFormat) {
    // Package, Current, Latest, Update Status, Last Published, Drift, [Security]
    if (includeSecurity) {
      colWidths = calculateColumnWidths(tableWidth, [3, 1.5, 1.5, 3, 2, 1.5, 2.5]);
    } else {
      colWidths = calculateColumnWidths(tableWidth, [3, 1.5, 1.5, 3, 2, 1.5]);
    }
  } else if (compact) {
    // Package, Current, Latest, Drift, [Security]
    if (includeSecurity) {
      colWidths = calculateColumnWidths(tableWidth, [4, 2, 2, 2, 3]);
    } else {
      colWidths = calculateColumnWidths(tableWidth, [4, 2, 2, 2]);
    }
  } else {
    // Package, Current, Latest, Days Behind, Drift, [Security]
    if (includeSecurity) {
      colWidths = calculateColumnWidths(tableWidth, [3, 1.5, 1.5, 2, 1.5, 2.5]);
    } else {
      colWidths = calculateColumnWidths(tableWidth, [3, 1.5, 1.5, 2, 1.5]);
    }
  }

  // Create table instance with border styling and column widths
  const table = new Table({
    head: columns.map(col => chalk.cyan.bold(col)),
    colWidths: colWidths,
    wordWrap: true,
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: {
      head: [], // No additional styling for header
      border: [] // No additional styling for border
    }
  });

  // Sort dependencies
  const sortedDeps = [...analysis.dependencies];

  switch (sortBy) {
  case 'drift':
    // Sort by drift level (critical first)
    const driftOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4, unknown: 5 };
    sortedDeps.sort((a, b) => {
      const orderA = driftOrder[a.driftLevel] || 5;
      const orderB = driftOrder[b.driftLevel] || 5;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
    break;
  case 'security':
    // Sort by security severity (critical first)
    const securityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    sortedDeps.sort((a, b) => {
      const secA = a.security || { highestSeverity: 'none' };
      const secB = b.security || { highestSeverity: 'none' };
      const orderA = securityOrder[secA.highestSeverity] || 4;
      const orderB = securityOrder[secB.highestSeverity] || 4;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
    break;
  case 'days':
    // Sort by days behind (most days first)
    sortedDeps.sort((a, b) => {
      const daysA = a.daysBehind || 0;
      const daysB = b.daysBehind || 0;
      return daysB - daysA || a.name.localeCompare(b.name);
    });
    break;
  case 'name':
  default:
    // Sort by name
    sortedDeps.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Apply sort direction if 'asc' is specified (default is already 'desc')
  if (sortDirection === 'asc') {
    sortedDeps.reverse();
  }

  // Filter dependencies if not showing all
  const depsToShow = showAll
    ? sortedDeps
    : sortedDeps.filter(dep =>
      dep.driftLevel && dep.driftLevel !== 'none' ||
        (dep.security && dep.security.vulnerable)
    );

  // If no dependencies to show after filtering
  if (depsToShow.length === 0) {
    if (!showAll) {
      return 'No outdated dependencies found. All packages are up to date.';
    }
    return 'No dependencies found.';
  }

  // Add rows to table
  depsToShow.forEach(dep => {
    const row = [];

    // Package name column (with dev indicator if needed)
    let nameDisplay = dep.isDevDependency
      ? `${dep.name} ${chalk.cyan('[dev]')}`
      : dep.isPeerDependency
        ? `${dep.name} ${chalk.magenta('[peer]')}`
        : dep.isOptionalDependency
          ? `${dep.name} ${chalk.yellow('[optional]')}`
          : dep.name;

    // Highlight package name if it has vulnerabilities
    if (dep.security && dep.security.vulnerable) {
      nameDisplay = chalk.bold.red(nameDisplay);
    }

    row.push(nameDisplay);

    // Current version column
    row.push(getColoredVersion(dep.currentVersion, dep.driftLevel));

    // Latest version column
    row.push(chalk.cyan(dep.latestVersion || 'unknown'));

    if (useImprovedFormat) {
      // Update Status column - clearly indicates if update is needed
      if (dep.currentVersion !== dep.latestVersion) {
        row.push(chalk.yellow(`Needs update (${dep.daysBehind} days behind)`));
      } else {
        row.push(chalk.green('Up to date'));
      }

      // Last Published column
      const lastPublished = dep.latestPublishDate ?
        formatTimeAgo(new Date(dep.latestPublishDate)) :
        formatTimeAgo(new Date(Date.now() - (dep.daysBehind * 24 * 60 * 60 * 1000)));
      row.push(getDaysBehindDisplay(lastPublished, dep.daysBehind));
    } else if (!compact) {
      // Traditional Days behind column (if not compact mode)
      row.push(getDaysBehindDisplay(dep.daysBehind));
    }

    // Drift level column
    row.push(formatDriftLevel(dep.driftLevel));

    // Security column (if requested)
    if (includeSecurity) {
      const security = dep.security || { vulnerable: false, highestSeverity: 'none', vulnerabilities: [] };

      if (security.vulnerable) {
        // Create enhanced security display with vulnerability count
        const vulnCount = security.vulnerabilities?.length || 0;
        const securityColor = getSecurityColor(security.highestSeverity);
        const vulnCountText = vulnCount > 0 ? ` (${vulnCount})` : '';
        const securityDisplay = `${securityColor(security.highestSeverity.toUpperCase())}${chalk.bold.red(vulnCountText)}`;

        row.push(securityDisplay);
      } else {
        // Standard "none" for non-vulnerable packages
        row.push(chalk.green('none'));
      }
    }

    table.push(row);
  });

  return table.toString();
}

/**
 * Calculate proportional column widths based on available space and weight ratios
 * @param {number} totalWidth - Total available width
 * @param {Array<number>} ratios - Weight ratios for each column
 * @returns {Array<number>} Column widths
 */
function calculateColumnWidths (totalWidth, ratios) {
  // Calculate total ratio
  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);

  // Calculate column widths based on ratios, ensuring minimum width
  const columnWidths = ratios.map(ratio => {
    // Allocate percentage of available width based on ratio
    const width = Math.floor((ratio / totalRatio) * totalWidth);
    // Ensure minimum width of 3 characters
    return Math.max(width, 3);
  });

  // Adjust last column to account for any rounding errors
  const allocatedWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  if (allocatedWidth < totalWidth) {
    columnWidths[columnWidths.length - 1] += (totalWidth - allocatedWidth);
  }

  return columnWidths;
}

/**
 * Create a colored summary table with overall assessment
 * @param {Object} analysis - The analysis results
 * @returns {string} Summary table as string
 */
function createSummaryTable (analysis) {
  const terminalWidth = getTerminalWidth();

  const table = new Table({
    colWidths: [
      Math.floor(terminalWidth * 0.4),
      Math.floor(terminalWidth * 0.6) - 5
    ],
    wordWrap: true,
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: {
      head: [], // No additional styling for header
      border: [] // No additional styling for border
    }
  });

  if (!analysis.overallAssessment) {
    return 'No assessment data available';
  }

  const { overallAssessment } = analysis;

  // Get status display with color
  const getStatusDisplay = status => {
    switch (status) {
    case 'excellent': return chalk.green.bold('Excellent');
    case 'good': return chalk.blue.bold('Good');
    case 'fair': return chalk.yellow.bold('Fair');
    case 'poor': return chalk.red.bold('Poor');
    case 'critical': return chalk.bgRed.white.bold('Critical');
    default: return status;
    }
  };

  // Get score display with color
  const getScoreDisplay = score => {
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
  };

  // Add rows to table
  table.push(
    [chalk.cyan.bold('Status'), getStatusDisplay(overallAssessment.status)],
    [chalk.cyan.bold('Drift Score'), getScoreDisplay(overallAssessment.driftScore)],
    [chalk.cyan.bold('Security Score'), getScoreDisplay(overallAssessment.securityScore)],
    [chalk.cyan.bold('Combined Score'), getScoreDisplay(overallAssessment.combinedScore)],
    [chalk.cyan.bold('Outdated Dependencies'), `${overallAssessment.outdatedDependencies} of ${analysis.dependencies.length}`],
    [chalk.cyan.bold('Vulnerable Dependencies'), `${overallAssessment.vulnerableDependencies || 0} of ${analysis.dependencies.length}`]
  );

  return table.toString();
}

/**
 * Create a table with recommendations for addressing drift issues
 * @param {Array<Object>} recommendations - Recommendations from analysis
 * @returns {string} Recommendations table as string
 */
function createRecommendationsTable (recommendations) {
  // Handle missing or invalid recommendations
  if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
    return 'No specific recommendations available.';
  }

  // Create table with columns
  const table = new Table({
    head: [
      chalk.cyan.bold('#'),
      chalk.cyan.bold('Package'),
      chalk.cyan.bold('Current'),
      chalk.cyan.bold('Recommendation'),
      chalk.cyan.bold('Reason')
    ],
    wordWrap: true,
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: {
      head: [], // No additional styling for header
      border: [] // No additional styling for border
    }
  });

  // Convert recommendations to standard format if they're not already
  const standardizedRecs = recommendations.map(rec => {
    // If it's already in the expected format
    if (rec.dependencyName && rec.currentVersion && rec.recommendation && rec.details) {
      return rec;
    }

    // Convert from alternative format
    return {
      dependencyName: rec.dependencyName || rec.package || rec.name || 'Unknown package',
      currentVersion: rec.currentVersion || rec.version || 'unknown',
      recommendation: rec.recommendation ||
                     (rec.recommendedVersion ? `Update to ${rec.recommendedVersion}` : 'Update recommended'),
      details: rec.details || rec.reason ||
              (rec.reason ? `${rec.reason} (${rec.priority || 'medium'} priority)` :
                'Dependency needs attention'),
      hasSecurity: rec.hasSecurity || rec.security || false
    };
  });

  // Add rows to the table
  standardizedRecs.forEach((rec, index) => {
    // Update terminology in details to be more accurate
    let detailsDisplay = rec.details
      .replace(/(days behind)/i, chalk.yellow('days since latest release'))
      .replace(/(critical|high|medium|low)/i, match => {
        const lowerMatch = match.toLowerCase();
        if (lowerMatch === 'critical') return chalk.bgRed.white(match);
        if (lowerMatch === 'high') return chalk.red(match);
        if (lowerMatch === 'medium') return chalk.yellow(match);
        if (lowerMatch === 'low') return chalk.blue(match);
        return match;
      });

    // Add security indicator if this recommendation is based on security
    if (rec.hasSecurity || (rec.details && rec.details.toLowerCase().includes('security'))) {
      detailsDisplay = `${chalk.bgRed.white(' SECURITY ')} ${detailsDisplay}`;
    }

    // Format the package name to highlight security issues
    const packageDisplay = rec.hasSecurity ?
      chalk.bold.red(rec.dependencyName) :
      chalk.bold(rec.dependencyName);

    // Add recommendation with package version
    let recommendationDisplay = rec.recommendation;
    if (rec.targetVersion && !rec.recommendation.includes(rec.targetVersion)) {
      recommendationDisplay = `Update to ${chalk.green(rec.targetVersion)}`;
    }

    table.push([
      chalk.white.bold(index + 1),
      packageDisplay,
      chalk.cyan(rec.currentVersion),
      recommendationDisplay,
      detailsDisplay
    ]);
  });

  return table.toString();
}

/**
 * Create an explanation block to help users understand the improved table
 * @returns {string} Explanation text
 */
function createExplanationBlock () {
  return `
${chalk.cyan.bold('📋 Understanding the Table:')}
  • ${chalk.cyan.bold('Package:')} Dependency name and type
  • ${chalk.cyan.bold('Current:')} The version you currently have installed
  • ${chalk.cyan.bold('Latest:')} The latest version available
  • ${chalk.cyan.bold('Update Status:')} Whether you need to update the package
      - ${chalk.green('Up to date:')} You have the latest version (even if that version is old)
      - ${chalk.yellow('Needs update:')} A newer version is available
  • ${chalk.cyan.bold('Last Published:')} When the latest version was published
      - A package can be ${chalk.green('Up to date')} but still show ${chalk.yellow('Last Published: 1 year ago')}
      - This means you have the latest version, but that version itself is old
  • ${chalk.cyan.bold('Drift:')} The version drift level calculated from version difference
  • ${chalk.cyan.bold('Security:')} Whether the package has security vulnerabilities
`;
}

/**
 * Format the full analysis as tables
 * @param {Object} analysis - The analysis results
 * @param {Object} options - Formatting options
 * @param {boolean} [options.includeSecurity=true] - Whether to include security columns
 * @param {string} [options.sortBy='drift'] - Sort by: 'drift', 'security', 'name', 'days'
 * @param {string} [options.sortDirection='desc'] - Sort direction: 'asc' or 'desc'
 * @param {boolean} [options.useImprovedFormat=true] - Whether to use the improved table format
 * @param {boolean} [options.showAll=false] - Whether to show all dependencies or only outdated ones
 * @returns {string} Formatted tables as string
 */
function formatAnalysisAsTables (analysis, options = {}) {
  const {
    includeSecurity = true,
    sortBy = 'drift',
    sortDirection = 'desc',
    useImprovedFormat = true,
    showAll = false
  } = options;

  // Handle missing analysis
  if (!analysis) {
    return 'No analysis results available.';
  }

  // Generate header info
  const header = `
${chalk.bold.blue('DepDrift Analysis Results')}
${chalk.cyan('Project:')} ${chalk.white(analysis.projectName)}@${chalk.white(analysis.projectVersion)}
${chalk.cyan('Path:')} ${chalk.white(analysis.packageJsonPath || analysis.projectPath)}
${chalk.cyan('Analyzed on:')} ${chalk.white(analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : new Date().toLocaleString())}
`;

  // Generate summary table
  const summaryTable = createSummaryTable(analysis);

  // Generate dependencies table with showAll option
  const dependenciesTable = createDependencyTable(analysis, {
    includeSecurity,
    sortBy,
    sortDirection,
    useImprovedFormat,
    compact: options.compact || false,
    showAll
  });

  // Generate recommendations table if recommendations exist
  const recommendationsTable = analysis.recommendations ?
    createRecommendationsTable(analysis.recommendations) :
    'No recommendations available.';

  // Add explanation block if using improved format
  const explanation = useImprovedFormat ? createExplanationBlock() : '';

  // Combine all sections
  return `${header}
${chalk.bold.blue('Overall Assessment')}
${summaryTable}
${explanation}
${chalk.bold.blue('Dependencies')}
${dependenciesTable}

${chalk.bold.blue('Recommendations')}
${recommendationsTable}
`;
}

/**
 * Helper function to get colored version string
 * @private
 * @param {string} version - Version string
 * @param {string} driftLevel - Drift level
 * @returns {string} Colored version string
 */
function getColoredVersion (version, driftLevel) {
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
 * Helper function to get colored days behind string
 * @private
 * @param {string|number} value - Days behind or formatted date string
 * @param {number} [days] - Days behind (only needed if first param is string)
 * @returns {string} Colored days behind string
 */
function getDaysBehindDisplay (value, days) {
  // If value is a number, it's the traditional days behind
  if (typeof value === 'number') {
    if (!value || value <= 0) {
      return chalk.green('0 days');
    }

    if (value <= 30) {
      return chalk.blue(`${value} days`);
    } else if (value <= 90) {
      return chalk.yellow(`${value} days`);
    } else if (value <= 180) {
      return chalk.red(`${value} days`);
    } else {
      return chalk.bgRed.white(`${value} days`);
    }
  }

  // If value is a string, it's the formatted date string
  if (!days || days <= 30) {
    return chalk.green(value);
  } else if (days <= 90) {
    return chalk.blue(value);
  } else if (days <= 180) {
    return chalk.yellow(value);
  } else if (days <= 365) {
    return chalk.red(value);
  } else {
    return chalk.bgRed.white(value);
  }
}

/**
 * Get appropriate color function for security severity
 * @private
 * @param {string} severity - Security severity level
 * @returns {Function} Chalk color function
 */
function getSecurityColor (severity) {
  switch (severity) {
  case 'critical': return chalk.bgRed.white;
  case 'high': return chalk.bold.red;
  case 'medium': return chalk.bold.yellow;
  case 'low': return chalk.blue;
  default: return chalk.green;
  }
}

/**
 * Generate a table representation of the analysis results
 * @param {Object} results - Analysis results
 * @returns {Object} Table object that can be converted to a string
 */
function generateTable(results) {
  const output = formatAnalysisAsTables(results);
  return {
    toString: () => output
  };
}

export {
  formatAnalysisAsTables,
  createDependencyTable,
  createSummaryTable,
  createRecommendationsTable,
  createExplanationBlock,
  generateTable
};
