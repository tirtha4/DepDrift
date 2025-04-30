/**
 * DepDrift Analyzers Module
 * 
 * This module exports the dependency analyzers that form the core functionality
 * of DepDrift.
 * 
 * @module analyzers
 */

'use strict';

// Import from local files in the analyzers directory
const { 
  analyzePackage, 
  calculateDriftLevel, 
  analyzeDependency, 
  fetchNpmPackageInfo,
  parseVersionRange,
  isPreRelease,
  satisfiesRange
} = require('./packageAnalyzer');

const { 
  checkVulnerabilities, 
  analyzeSecurity, 
  VULNERABILITY_SOURCES 
} = require('./securityAnalyzer');

const { 
  analyzeDrift, 
  flattenTree, 
  classifyVersionDifference 
} = require('./driftAnalyzer');

/**
 * Analyze a package for dependency drift and security issues
 * 
 * @param {Object} packageInfo - The parsed package.json object
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeDependencies(packageInfo, options = {}) {
  // This wrapper function combines drift and security analysis
  const { includeSecurity = true, ...restOptions } = options;
  
  // Get drift analysis
  const driftResults = await analyzePackage(packageInfo, restOptions);
  
  if (!includeSecurity) {
    return driftResults;
  }
  
  // Add security analysis
  const securityResults = await analyzeSecurity(driftResults, {
    sources: options.securitySources || ['NPM_AUDIT'],
    useCache: options.useCache !== false,
    maxConcurrent: options.maxConcurrent || 5
  });
  
  // Merge the results
  return {
    ...driftResults,
    security: securityResults
  };
}

module.exports = {
  // Main analysis functions
  analyzePackage,
  analyzeDrift,
  analyzeSecurity,
  analyzeDependencies,
  
  // Utility functions
  checkVulnerabilities,
  calculateDriftLevel,
  analyzeDependency,
  fetchNpmPackageInfo,
  flattenTree,
  classifyVersionDifference,
  parseVersionRange,
  isPreRelease,
  satisfiesRange,
  
  // Constants
  VULNERABILITY_SOURCES
}; 