/**
 * Utility functions for error handling
 * @module utils/errorHandler
 */

/**
 * Handle errors with standard formatting
 * @param {Error} error - The error object
 * @param {string} message - Optional message to prefix the error
 */
export function handleError(error, message = 'Error') {
  console.error(`${message}: ${error.message}`);
}

/**
 * Handle warnings with standard formatting
 * @param {string} message - Warning message
 */
export function handleWarning(message) {
  console.warn(`Warning: ${message}`);
} 