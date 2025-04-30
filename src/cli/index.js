/**
 * DepDrift CLI Entry Point
 * 
 * This module serves as the main entry point for the DepDrift CLI.
 * It forwards to the actual CLI implementation to maintain backward compatibility
 * while allowing for a more structured codebase.
 */

'use strict';

// For now, simply delegate to the current CLI implementation
// In the future, we can refactor the CLI code here and maintain compatibility

module.exports = require('../cli'); 