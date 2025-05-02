/**
 * DepDrift Formatters
 * Centralized export for all formatter modules
 * 
 * @module formatters
 */

// Import from HTML formatter
import { generateHtmlReport, saveHtmlReport } from './htmlFormatter.js';

// Import from JSON formatter
import { generateJsonReport } from './jsonFormatter.js';

// Import from Table formatter
import {
  createDependencyTable,
  createSummaryTable,
  createRecommendationsTable,
  formatAnalysisAsTables
} from './tableFormatter.js';

// Import from Reporter
import {
  reportAnalysis,
  generateSummary,
  saveReport,
  reportDrift
} from './reporter.js';

// Import from Text formatter
import {
  formatDriftLevel,
  formatDaysBehind,
  formatVersions,
  formatDate,
  formatSummary,
  formatDependency,
  formatDriftSummary,
  formatSecurityInfo,
  formatSecuritySeverity,
  formatAsJson,
  formatOutput,
  saveOutput
} from './textFormatter.js';

// Export all formatter functions
export {
  // HTML formatter functions
  generateHtmlReport,
  saveHtmlReport,
  
  // JSON formatter functions
  generateJsonReport,
  
  // Table formatter functions
  createDependencyTable,
  createSummaryTable,
  createRecommendationsTable,
  formatAnalysisAsTables,
  
  // Reporter functions
  reportAnalysis,
  generateSummary,
  saveReport,
  reportDrift,
  
  // Text formatter functions
  formatDriftLevel,
  formatDaysBehind,
  formatVersions,
  formatDate,
  formatSummary,
  formatDependency,
  formatDriftSummary,
  formatSecurityInfo,
  formatSecuritySeverity,
  formatAsJson,
  formatOutput,
  saveOutput
};
