/**
 * CLI module for DepDrift
 *
 * This module provides the command-line interface for the dependency drift analysis tool.
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { handleError, handleWarning } from './utils/errorHandler.js';
import { assessDependencies, generateRecommendations } from './core/assessor.js';
import { 
  formatAnalysisText, 
  formatAnalysisJson, 
  formatAnalysisCSV 
} from './utils/formatters.js';
import { 
  formatAnalysisAsTables, 
  generateTable 
} from './formatters/tableFormatter.js';
import { 
  generateHtmlReport 
} from './formatters/htmlFormatter.js';
import { 
  displayRecommendations, 
  displayVulnerabilities 
} from './formatters/reporter.js';

/**
 * Find the nearest package.json file by traversing up directories
 * @param {string} startDir - Starting directory to search from
 * @param {number} [maxLevels=10] - Maximum directory levels to traverse up
 * @returns {string|null} Path to the found package.json or null if not found
 */
export function findPackageJson(startDir, maxLevels = 10) {
  try {
    let currentDir = startDir;
    let levelsUp = 0;
    
    while (levelsUp < maxLevels) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        return packageJsonPath;
      }
      
      const parentDir = path.dirname(currentDir);
      
      // If we've reached the root directory, stop searching
      if (parentDir === currentDir) {
        break;
      }
      
      currentDir = parentDir;
      levelsUp++;
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding package.json: ${error.message}`);
    return null;
  }
}

/**
 * Parse exclude-types option
 * @param {string} excludeTypesStr - Comma-separated list of dependency types to exclude
 * @returns {Object} Object with exclude flags
 */
export function parseExcludeTypes(excludeTypesStr) {
  // Default all to false
  const result = {
    excludeDev: false,
    excludePeer: false,
    excludeOptional: false
  };
  
  if (!excludeTypesStr) {
    return result;
  }
  
  // Split by comma, trim whitespace, and convert to lowercase
  const types = excludeTypesStr.split(',')
    .map(type => type.trim().toLowerCase());
  
  // Set flags based on types
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
 * Parse security-sources option
 * @param {string} sourcesStr - Comma-separated list of security sources
 * @returns {Array<string>} Array of uppercase security source identifiers
 */
export function parseSecuritySources(sourcesStr) {
  if (!sourcesStr) {
    return [];
  }
  
  // Split by comma, trim whitespace, and convert to uppercase
  return sourcesStr.split(',')
    .map(source => source.trim().toUpperCase());
}

/**
 * Format a drift level with appropriate color coding
 * @param {string} level - Drift level
 * @returns {string} Color-coded string
 */
export function formatDriftLevel(level) {
  if (level === null || level === undefined) {
    return chalk.gray('unknown');
  }

  try {
    switch (String(level).toLowerCase()) {
      case 'none':
        return chalk.green(level);
      case 'low':
        return chalk.blue(level);
      case 'medium':
        return chalk.yellow(level);
      case 'high':
        return chalk.red(level);
      case 'critical':
        return chalk.bgRed.white(level);
      default:
        return chalk.gray(String(level));
    }
  } catch (err) {
    return chalk.gray(String(level));
  }
}

/**
 * Format days ago as a human-readable string
 * @param {number} days - Number of days
 * @returns {string} Formatted string
 */
export function formatTimeAgo(days) {
  if (days === null || days === undefined) {
    return `NaN days ago`;
  }
  
  const numDays = Number(days);
  
  if (isNaN(numDays)) {
    return `NaN days ago`;
  }
  
  if (numDays <= 0) {
    return `Today`;
  } else if (numDays === 1) {
    return `1 day ago`;
  } else if (numDays < 100) {
    return `${numDays} days ago`;
  } else if (numDays < 365) {
    const months = Math.floor(numDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(numDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}

/**
 * Process and display/save analysis results
 * @param {Object} results - Analysis results
 * @param {Object} options - Processing options
 * @returns {Promise<void>}
 */
export async function processResults(results, options = {}) {
  try {
    const {
      format = 'text',
      output = null,
      showRecommendations = false,
      showVulnerabilities = false
    } = options;
    
    if (!results) {
      console.error('No analysis results to process');
      return;
    }
    
    if (results.dependencies && results.dependencies.length === 0) {
      console.warn('No dependencies found in analysis');
    }
    
    let formattedOutput;
    
    // Format results based on requested format
    switch (format.toLowerCase()) {
      case 'json':
        formattedOutput = formatAnalysisJson(results);
        break;
      case 'csv':
        formattedOutput = formatAnalysisCSV(results);
        break;
      case 'table':
        formattedOutput = formatAnalysisAsTables(results);
        break;
      case 'html':
        formattedOutput = generateHtmlReport(results);
        break;
      case 'text':
        formattedOutput = formatAnalysisText(results, { includeDetails: true });
        break;
      default:
        console.error(`Unsupported format: ${format}`);
        formattedOutput = formatAnalysisText(results);
    }
    
    // Display formatted output
    console.log(formattedOutput);
    
    // Save to file if requested
    if (output) {
      try {
        fs.writeFileSync(output, formattedOutput);
        console.log(`Results saved to ${output}`);
      } catch (error) {
        console.error(`Error writing results to ${output}: ${error.message}`);
      }
    }
    
    // Show recommendations if requested
    if (showRecommendations && results.recommendations) {
      displayRecommendations(results.recommendations);
    }
    
    // Show vulnerabilities if requested
    if (showVulnerabilities && results.vulnerabilities) {
      displayVulnerabilities(results.vulnerabilities);
    }
  } catch (error) {
    console.error(`Error processing results: ${error.message}`);
  }
}

/**
 * Main CLI function
 * @param {Object} argv - Command line arguments
 * @returns {Promise<void>}
 */
export async function main(argv) {
  try {
    // Check if a command is specified
    if (!argv._ || argv._.length === 0) {
      console.error('No command specified');
      process.exit(1);
    }
    
    const command = argv._[0];
    const projectPath = argv.path || process.cwd();
    
    // Validate project path
    try {
      const stats = fs.statSync(projectPath);
      if (!stats.isDirectory()) {
        console.error(`Path ${projectPath} is not a directory`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`An error occurred while running the analysis: ${error.message}`);
      process.exit(1);
    }
    
    // Find package.json
    const packageJsonPath = findPackageJson(projectPath);
    if (!packageJsonPath) {
      console.error(`No package.json found in ${projectPath} or its parent directories`);
      process.exit(1);
    }
    
    // Parse options
    const excludeOptions = parseExcludeTypes(argv['exclude-types']);
    const securitySources = parseSecuritySources(argv['security-sources']);
    
    // Set up analysis options
    const options = {
      ...excludeOptions,
      checkSecurity: argv.security !== false,
      securitySources,
      depth: argv.depth || 1,
      useCache: argv.cache !== false
    };
    
    let results;
    
    switch (command) {
      case 'analyze':
        // Run the core analysis
        try {
          results = await assessDependencies(packageJsonPath, options);
        } catch (error) {
          console.error(`Error analyzing dependencies: ${error.message}`);
          process.exit(1);
        }
        
        // Process and display results
        await processResults(results, {
          format: argv.format || 'text',
          output: argv.output,
          showRecommendations: argv.recommendations,
          showVulnerabilities: argv.vulnerabilities
        });
        break;
        
      case 'summary':
        // Run analysis and show summary
        try {
          results = await assessDependencies(packageJsonPath, options);
          console.log(`Analysis complete for ${results.projectName}`);
        } catch (error) {
          console.error(`Error analyzing dependencies: ${error.message}`);
          process.exit(1);
        }
        break;
        
      default:
        console.error(`Unrecognized command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    handleError(error, 'An error occurred');
    process.exit(1);
  }
}