/**
 * Lock file detector module
 * @module core/lockFileDetector
 */

import fs from 'fs';
import path from 'path';

/**
 * Safely checks if a file exists, handling errors
 * @param {string} filePath - Path to the file to check
 * @returns {boolean} - Whether the file exists
 * @private
 */
function safeExistsSync(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    // Handle filesystem errors gracefully
    console.error(`Error checking if file exists (${filePath}):`, error.message);
    return false;
  }
}

/**
 * Detects which lock files are present in a project
 * @param {string} projectRoot - The root directory of the project
 * @returns {Object} Object with flags for each supported package manager
 * @property {boolean} npm - Whether package-lock.json was found
 * @property {boolean} yarn - Whether yarn.lock was found
 * @property {boolean} pnpm - Whether pnpm-lock.yaml was found
 */
export function detectLockFiles(projectRoot) {
  // Handle invalid inputs
  if (projectRoot === null || projectRoot === undefined) {
    projectRoot = '';
  }
  
  try {
    const packageLock = path.join(projectRoot, 'package-lock.json');
    const yarnLock = path.join(projectRoot, 'yarn.lock');
    const pnpmLock = path.join(projectRoot, 'pnpm-lock.yaml');

    return {
      npm: safeExistsSync(packageLock),
      yarn: safeExistsSync(yarnLock),
      pnpm: safeExistsSync(pnpmLock)
    };
  } catch (error) {
    // Handle any unexpected errors in path.join or other operations
    console.error(`Error detecting lock files:`, error.message);
    return {
      npm: false,
      yarn: false,
      pnpm: false
    };
  }
}

/**
 * Gets the primary package manager based on lock files
 * @param {string} projectRoot - The root directory of the project
 * @returns {string|null} The detected package manager (npm, yarn, pnpm) or null if none detected
 */
export function getPrimaryPackageManager(projectRoot) {
  try {
    const lockFiles = detectLockFiles(projectRoot);

    // Priority: npm > yarn > pnpm
    if (lockFiles.npm) return 'npm';
    if (lockFiles.yarn) return 'yarn';
    if (lockFiles.pnpm) return 'pnpm';

    return null;
  } catch (error) {
    // Handle any unexpected errors
    console.error(`Error getting primary package manager:`, error.message);
    return null;
  }
}
