/**
 * Reporter module for displaying drift analysis results
 * @module utils/reporter
 */
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

/**
 * Get color for drift status
 * @param {string} status - Drift status
 * @returns {Function} Chalk color function
 */
function getStatusColor(status) {
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
 * Report dependency drift to console and/or file
 * @param {Array} records - Array of dependency records to report
 * @param {Object} options - Report options
 * @returns {Promise<void>}
 */
async function reportDrift(records, options = {}) {
  const {
    json = false,
    jsonFile = 'drift-report.json',
    showAll = false,
    sortBy = 'status',
    sortDirection = 'desc',
    title = 'Dependency Drift Report'
  } = options;
  
  if (!records || !Array.isArray(records) || records.length === 0) {
    console.log(chalk.yellow('No dependency drift records to report.'));
    
    if (json) {
      await fs.writeJson(jsonFile, { records: [] }, { spaces: 2 });
      console.log(chalk.gray(`Empty report written to ${jsonFile}`));
    }
    
    return;
  }
  
  // Sort the records
  const sortedRecords = [...records].sort((a, b) => {
    const statusRank = {
      'missing': 50,
      'peer-missing': 45, 
      'extra': 40,
      'critical': 30,
      'high': 25,
      'major': 20,
      'medium': 15,
      'minor': 10,
      'low': 5,
      'patch': 3,
      'optional-missing': 2,
      'safe': 1,
      'none': 0,
      'unknown': -1
    };
    
    let comparison = 0;
    
    switch (sortBy) {
      case 'status':
        // Get status rank or default to -1 if not found
        const aRank = statusRank[a.status?.toLowerCase()] ?? -1;
        const bRank = statusRank[b.status?.toLowerCase()] ?? -1;
        comparison = bRank - aRank;
        break;
        
      case 'name':
      case 'package':
        comparison = a.package?.localeCompare(b.package) ?? 0;
        break;
        
      case 'expected':
        comparison = a.expected?.localeCompare(b.expected) ?? 0;
        break;
        
      case 'installed':
        comparison = a.installed?.localeCompare(b.installed) ?? 0;
        break;
        
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? -comparison : comparison;
  });
  
  // Create table
  const table = new Table({
    head: [
      chalk.bold('Package'),
      chalk.bold('Expected'),
      chalk.bold('Installed'),
      chalk.bold('Status')
    ],
    style: {
      head: []
    }
  });
  
  // Filter records if not showing all
  const recordsToShow = showAll 
    ? sortedRecords 
    : sortedRecords.filter(r => 
        r.status && 
        !['safe', 'none', 'optional-missing'].includes(r.status.toLowerCase())
      );
  
  // Add rows
  recordsToShow.forEach(record => {
    const colorFn = getStatusColor(record.status || 'unknown');
    
    table.push([
      record.package || '-',
      record.expected || '-',
      record.installed || '-',
      colorFn(record.status || 'unknown')
    ]);
  });
  
  // Print title and table
  console.log(chalk.bold.underline(`\n${title}`));
  console.log(`Total dependencies: ${records.length}`);
  console.log(`Issues found: ${recordsToShow.length}\n`);
  console.log(table.toString());
  
  // Write JSON file if requested
  if (json) {
    await fs.writeJson(jsonFile, { records: sortedRecords }, { spaces: 2 });
    console.log(chalk.green(`\nReport saved to ${jsonFile}`));
  }
}

/**
 * Generate a summary of drift records
 * @param {Array} records - Array of dependency records
 * @returns {Object} Summary object
 */
function generateDriftSummary(records) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return {
      total: 0,
      issues: 0,
      statusCounts: {}
    };
  }
  
  const summary = {
    total: records.length,
    issues: 0,
    statusCounts: {}
  };
  
  // Count by status
  records.forEach(record => {
    const status = (record.status || 'unknown').toLowerCase();
    
    // Increment status count
    summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
    
    // Count as issue if not safe/none/optional-missing
    if (!['safe', 'none', 'optional-missing'].includes(status)) {
      summary.issues++;
    }
  });
  
  return summary;
}

/**
 * Save drift report to file
 * @param {Array} records - Drift records
 * @param {string} filePath - Path to save report
 * @param {Object} options - Report options
 * @returns {Promise<void>}
 */
async function saveDriftReport(records, filePath, options = {}) {
  const { format = 'json' } = options;
  
  try {
    if (format === 'json') {
      await fs.writeJson(filePath, { records }, { spaces: 2 });
    } else {
      // For future support of other formats
      throw new Error(`Unsupported report format: ${format}`);
    }
  } catch (error) {
    throw new Error(`Failed to save drift report: ${error.message}`);
  }
}

module.exports = {
  reportDrift,
  generateDriftSummary,
  saveDriftReport,
  getStatusColor
}; 