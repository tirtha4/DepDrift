/**
 * DepDrift Main Entry Point
 *
 * This file exports the main functionality of DepDrift for programmatic use.
 *
 * @module depdrift
 */

// Core functionality
import { assessDependencies, generateRecommendations } from './core/assessor.js';

// Analyzers
import { analyzePackage } from './analyzers/packageAnalyzer.js';
import { analyzeSecurity } from './analyzers/securityAnalyzer.js';
import { flattenTree, classifyVersionDifference } from './analyzers/driftAnalyzer.js';

// Utilities
import { summarizeDriftLevels } from './utils/driftUtils.js';

// Formatters
import {
  generateHtmlReport,
  saveHtmlReport,
  generateJsonReport,
  createDependencyTable,
  createSummaryTable,
  formatAnalysisAsTables,
  reportAnalysis
} from './formatters/index.js';

// Package version info - using ESM-friendly approach
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package version synchronously (to avoid top-level await)
let _version;
try {
  const packageJsonPath = resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  _version = packageJson.version;
} catch (err) {
  _version = 'unknown';
  console.error('Could not read package version:', err);
}

/**
 * Main exports for programmatic use
 */
export {
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

  // Formatters
  generateHtmlReport,
  saveHtmlReport,
  generateJsonReport,
  createDependencyTable,
  createSummaryTable,
  formatAnalysisAsTables,
  reportAnalysis
};

// Export version information
export const version = _version;
