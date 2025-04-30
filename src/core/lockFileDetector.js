/**
 * Lock file detector module
 * @module core/lockFileDetector
 */

const fs = require('fs');
const path = require('path');

/**
 * Detects which lock files are present in a project
 * @param {string} projectRoot - The root directory of the project
 * @returns {Object} Object with flags for each supported package manager
 * @property {boolean} npm - Whether package-lock.json was found
 * @property {boolean} yarn - Whether yarn.lock was found
 * @property {boolean} pnpm - Whether pnpm-lock.yaml was found
 */
function detectLockFiles (projectRoot) {
  const packageLock = path.join(projectRoot, 'package-lock.json');
  const yarnLock = path.join(projectRoot, 'yarn.lock');
  const pnpmLock = path.join(projectRoot, 'pnpm-lock.yaml');

  return {
    npm: fs.existsSync(packageLock),
    yarn: fs.existsSync(yarnLock),
    pnpm: fs.existsSync(pnpmLock)
  };
}

/**
 * Gets the primary package manager based on lock files
 * @param {string} projectRoot - The root directory of the project
 * @returns {string|null} The detected package manager (npm, yarn, pnpm) or null if none detected
 */
function getPrimaryPackageManager (projectRoot) {
  const lockFiles = detectLockFiles(projectRoot);

  // Priority: npm > yarn > pnpm
  if (lockFiles.npm) return 'npm';
  if (lockFiles.yarn) return 'yarn';
  if (lockFiles.pnpm) return 'pnpm';

  return null;
}

module.exports = {
  detectLockFiles,
  getPrimaryPackageManager
};
