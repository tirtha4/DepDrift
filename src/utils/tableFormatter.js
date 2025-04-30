/**
 * Table formatter for dependency drift and security output
 * @module utils/tableFormatter
 */

const Table = require('cli-table3');
const chalk = require('chalk');
const { formatDriftLevel, formatSecuritySeverity } = require('./formatters');

/**
 * Create a colored table of dependencies with drift and security information
 * @param {Object} analysis - The analysis results 
 * @param {Object} options - Table formatting options
 * @param {boolean} [options.compact=false] - Whether to use a compact view
 * @param {boolean} [options.includeSecurity=true] - Whether to include security columns
 * @param {string} [options.sortBy='drift'] - Sort by: 'drift', 'security', 'name', 'days'
 * @returns {string} Table output as string
 */
function createDependencyTable(analysis, options = {}) {
  const { 
    compact = false,
    includeSecurity = true,
    sortBy = 'drift'
  } = options;
  
  // Define table columns based on options
  const columns = compact 
    ? ['Package', 'Current', 'Latest', 'Drift']
    : ['Package', 'Current', 'Latest', 'Days Behind', 'Drift'];
  
  // Add security columns if requested
  if (includeSecurity) {
    columns.push('Security');
  }
  
  // Create table instance with border styling
  const table = new Table({
    head: columns.map(col => chalk.cyan.bold(col)),
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: {
      head: [], // No additional styling for header
      border: [], // No additional styling for border
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
  
  // Add rows to table
  sortedDeps.forEach(dep => {
    const row = [];
    
    // Package name column (with dev indicator if needed)
    const nameDisplay = dep.isDevDependency 
      ? `${dep.name} ${chalk.cyan('[dev]')}` 
      : dep.isPeerDependency 
        ? `${dep.name} ${chalk.magenta('[peer]')}` 
        : dep.isOptionalDependency 
          ? `${dep.name} ${chalk.yellow('[optional]')}` 
          : dep.name;
    
    row.push(nameDisplay);
    
    // Current version column
    row.push(getColoredVersion(dep.currentVersion, dep.driftLevel));
    
    // Latest version column
    row.push(chalk.cyan(dep.latestVersion || 'unknown'));
    
    // Days behind column (if not compact mode)
    if (!compact) {
      row.push(getDaysBehindDisplay(dep.daysBehind));
    }
    
    // Drift level column
    row.push(formatDriftLevel(dep.driftLevel));
    
    // Security column (if requested)
    if (includeSecurity) {
      const security = dep.security || { vulnerable: false, highestSeverity: 'none' };
      const securityDisplay = security.vulnerable
        ? formatSecuritySeverity(security.highestSeverity)
        : formatSecuritySeverity('none');
      row.push(securityDisplay);
    }
    
    table.push(row);
  });
  
  return table.toString();
}

/**
 * Create a colored summary table with overall assessment
 * @param {Object} analysis - The analysis results
 * @returns {string} Summary table as string
 */
function createSummaryTable(analysis) {
  const table = new Table({
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: {
      head: [], // No additional styling for header
      border: [], // No additional styling for border
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
 * Create a recommendations table
 * @param {Array<Object>} recommendations - Array of recommendations
 * @returns {string} Recommendations table as string
 */
function createRecommendationsTable(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return chalk.green('✓ No recommendations needed - everything looks good!');
  }
  
  const table = new Table({
    head: [
      chalk.cyan.bold('#'), 
      chalk.cyan.bold('Package'), 
      chalk.cyan.bold('Current'), 
      chalk.cyan.bold('Recommendation'), 
      chalk.cyan.bold('Details')
    ],
    chars: {
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│'
    },
    style: {
      head: [], // No additional styling for header
      border: [], // No additional styling for border
    },
    wordWrap: true,
    colWidths: [3, 20, 15, 30, 30]
  });
  
  recommendations.forEach((rec, index) => {
    const detailsDisplay = rec.details
      .replace(/(days behind)/, chalk.yellow('$1'))
      .replace(/(critical|high|medium|low)/, match => {
        if (match === 'critical') return chalk.bgRed.white(match);
        if (match === 'high') return chalk.red(match);
        if (match === 'medium') return chalk.yellow(match);
        if (match === 'low') return chalk.blue(match);
        return match;
      });
    
    table.push([
      chalk.white.bold(index + 1),
      chalk.bold(rec.dependencyName),
      chalk.cyan(rec.currentVersion),
      chalk.green(rec.recommendation),
      detailsDisplay
    ]);
  });
  
  return table.toString();
}

/**
 * Format the full analysis as tables
 * @param {Object} analysis - The analysis results
 * @param {Array<Object>} recommendations - Array of recommendations
 * @param {Object} options - Formatting options
 * @returns {string} Formatted tables as string
 */
function formatAnalysisAsTables(analysis, recommendations, options = {}) {
  const { includeSecurity = true, sortBy = 'drift' } = options;
  
  // Generate header info
  const header = `
${chalk.bold.blue('DepDrift Analysis Results')}
${chalk.cyan('Project:')} ${chalk.white(analysis.projectName)}@${chalk.white(analysis.projectVersion)}
${chalk.cyan('Path:')} ${chalk.white(analysis.packageJsonPath)}
${chalk.cyan('Analyzed on:')} ${chalk.white(new Date(analysis.timestamp).toLocaleString())}
`;
  
  // Generate summary table
  const summaryTable = createSummaryTable(analysis);
  
  // Generate dependencies table
  const dependenciesTable = createDependencyTable(analysis, { 
    includeSecurity, 
    sortBy 
  });
  
  // Generate recommendations table
  const recommendationsTable = createRecommendationsTable(recommendations);
  
  // Combine all sections
  return `${header}
${chalk.bold.blue('Overall Assessment')}
${summaryTable}

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
function getColoredVersion(version, driftLevel) {
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
 * @param {number} days - Days behind
 * @returns {string} Colored days behind string
 */
function getDaysBehindDisplay(days) {
  if (!days || days <= 0) {
    return chalk.green('0 days');
  }
  
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

module.exports = {
  createDependencyTable,
  createSummaryTable,
  createRecommendationsTable,
  formatAnalysisAsTables
}; 