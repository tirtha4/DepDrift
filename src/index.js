/**
 * DepDrift Main Entry Point
 *
 * This file exports the main functionality of DepDrift for programmatic use.
 *
 * @module depdrift
 */

'use strict';

// Core functionality
const { assessDependencies, generateRecommendations } = require('./core/assessor');

// Analyzers
const { analyzePackage } = require('./analyzers/packageAnalyzer');
const { analyzeSecurity } = require('./analyzers/securityAnalyzer');
const { flattenTree, classifyVersionDifference } = require('./analyzers/driftAnalyzer');

// Utilities
const { summarizeDriftLevels } = require('./utils/driftUtils');

/**
 * Main exports for programmatic use
 */
module.exports = {
  // Core assessment functions
  assessDependencies,
  generateRecommendations,

  // Individual analyzers
  analyzePackage,
  analyzeSecurity,

  // Utility functions
  flattenTree,
  classifyVersionDifference,
  summarizeDriftLevels,

  // Version information
  version: require('../package.json').version
};
