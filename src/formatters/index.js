/**
 * DepDrift Formatters Module
 * 
 * This module exports the output formatters for the DepDrift analysis results.
 * 
 * @module formatters
 */

'use strict';

// Import formatters
const { 
  formatAnalysisText, 
  formatAnalysisJson, 
  formatAnalysisCSV 
} = require('../utils/formatters');
const tableFormatter = require('./tableFormatter');
const textFormatter = require('./textFormatter');
const { generateHtmlReport, saveHtmlReport } = require('./htmlFormatter');
const reporter = require('./reporter');

/**
 * Format analysis results as a table
 * @param {Object} results - Analysis results
 * @param {Object} options - Formatting options
 * @returns {string} Formatted table
 */
function formatTable(results, options = {}) {
  return tableFormatter.formatAnalysisAsTables(results, options);
}

/**
 * Format analysis results as HTML
 * @param {Object} results - Analysis results
 * @param {Object} options - Formatting options
 * @returns {string} Formatted HTML
 */
function formatHtml(results, options = {}) {
  return generateHtmlReport(results, options);
}

/**
 * Unified function to report analysis results in any format
 * @param {Object} results - Analysis results
 * @param {Object} options - Formatting and reporting options
 * @returns {Promise<string>} The formatted output
 */
async function report(results, options = {}) {
  return reporter.reportAnalysis(results, options);
}

// Export formatters
module.exports = {
  // Main formatting functions
  formatText: formatAnalysisText,
  formatJson: formatAnalysisJson,
  formatCsv: formatAnalysisCSV,
  formatTable,
  formatHtml,
  
  // Reporting functions
  report,
  saveReport: reporter.saveReport,
  generateSummary: reporter.generateSummary,
  
  // File output functions
  saveHtmlReport,
  
  // For backward compatibility
  formatAnalysisText,
  formatAnalysisJson,
  formatAnalysisCSV,
  generateHtmlReport,
  
  // Reporter exports
  reporter,
  
  // Export original formatters for compatibility
  ...tableFormatter,
  ...textFormatter
}; 