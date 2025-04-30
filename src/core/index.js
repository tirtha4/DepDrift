/**
 * DepDrift Core Module
 * 
 * This module exports the core functionality of DepDrift, including
 * dependency assessment, cache management, and package registry access.
 * 
 * @module core
 */

'use strict';

// Import from local files in the core directory
const { assessDependencies, generateRecommendations, batchAssessDependencies } = require('./assessor');
const { buildGraphs } = require('./graphBuilder');
const { getNpmRegistry, createRegistry, DEFAULT_REGISTRY } = require('./registry');
const cacheUtils = require('./cache');

module.exports = {
  // Core functionality
  assessDependencies,
  generateRecommendations,
  batchAssessDependencies,
  buildGraphs,
  
  // Registry access
  registry: {
    getNpmRegistry,
    createRegistry,
    DEFAULT_REGISTRY
  },
  
  // Cache management
  cache: {
    ...cacheUtils
  }
}; 