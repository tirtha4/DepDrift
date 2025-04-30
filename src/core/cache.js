/**
 * Cache module for storing package information and analysis results
 * @module core/cache
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Default cache directory
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.depdrift', 'cache');

// In-memory cache
const memoryCache = new Map();
const cacheTimestamps = new Map();
let cacheTTL = 24 * 60 * 60 * 1000; // 24 hours by default

/**
 * Initializes the cache module with custom configuration
 * @param {Object} [options={}] - Cache initialization options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Directory to store cache files
 * @param {number} [options.ttl=24*60*60*1000] - Cache time-to-live in milliseconds (default: 24 hours)
 * @returns {Object} Cache configuration including directory and TTL
 */
function initCache (options = {}) {
  const { cacheDir = DEFAULT_CACHE_DIR, ttl = 24 * 60 * 60 * 1000 } = options;

  // Ensure cache directory exists
  fs.ensureDirSync(cacheDir);

  // Set cache TTL
  cacheTTL = ttl;

  return {
    cacheDir,
    ttl: cacheTTL
  };
}

/**
 * Retrieves cached package information from memory or file cache
 * @param {string} packageName - Package name to retrieve from cache
 * @param {Object} [options={}] - Cache retrieval options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Cache directory to check
 * @param {number} [options.maxAge=cacheTTL] - Maximum age of cache entry in milliseconds
 * @returns {Object|null} Cached package information or null if not found/expired
 */
function getCachedPackageInfo (packageName, options = {}) {
  const { cacheDir = DEFAULT_CACHE_DIR, maxAge = cacheTTL } = options;

  // Check memory cache first
  if (memoryCache.has(packageName)) {
    const timestamp = cacheTimestamps.get(packageName) || 0;
    const now = Date.now();

    if (now - timestamp < maxAge) {
      return memoryCache.get(packageName);
    }

    // Expired, remove from memory cache
    memoryCache.delete(packageName);
    cacheTimestamps.delete(packageName);
  }

  // Check file cache
  const cacheFile = getCacheFilePath(packageName, cacheDir);

  try {
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const now = Date.now();

      // Check if cache is still valid
      if (now - stats.mtimeMs < maxAge) {
        const cachedData = fs.readJsonSync(cacheFile);

        // Store in memory cache
        memoryCache.set(packageName, cachedData);
        cacheTimestamps.set(packageName, stats.mtimeMs);

        return cachedData;
      }

      // Cache expired, remove it
      fs.unlinkSync(cacheFile);
    }
  } catch (error) {
    // If reading fails, consider cache invalid
    console.warn(`Cache read failed for ${packageName}:`, error.message);
  }

  return null;
}

/**
 * Stores package information in both memory and file cache
 * @param {string} packageName - Package name to use as cache key
 * @param {Object} packageInfo - Package information to store in cache
 * @param {Object} [options={}] - Cache storage options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Directory to store cache files
 * @returns {void}
 */
function cachePackageInfo (packageName, packageInfo, options = {}) {
  const { cacheDir = DEFAULT_CACHE_DIR } = options;

  // Store in memory cache
  memoryCache.set(packageName, packageInfo);
  cacheTimestamps.set(packageName, Date.now());

  // Store in file cache
  const cacheFile = getCacheFilePath(packageName, cacheDir);

  try {
    fs.ensureDirSync(path.dirname(cacheFile));
    fs.writeJsonSync(cacheFile, packageInfo, { spaces: 2 });
  } catch (error) {
    console.warn(`Failed to write cache for ${packageName}:`, error.message);
  }
}

/**
 * Generates a safe file path for caching a package's information
 * @private
 * @param {string} packageName - Package name to generate path for
 * @param {string} cacheDir - Base cache directory
 * @returns {string} Full path to the cache file
 */
function getCacheFilePath (packageName, cacheDir) {
  // Handle scoped packages
  const safeName = packageName.replace(/\//g, '+');
  return path.join(cacheDir, `${safeName}.json`);
}

/**
 * Clears expired cache entries from both memory and file cache
 * @param {Object} [options={}] - Cache clearing options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Cache directory to clean
 * @param {number} [options.maxAge=cacheTTL] - Maximum age of entries to keep in milliseconds
 * @returns {number} Total number of cleared cache entries (memory + file)
 */
function clearExpiredCache (options = {}) {
  const { cacheDir = DEFAULT_CACHE_DIR, maxAge = cacheTTL } = options;
  let cleared = 0;

  // Clear expired memory cache
  const now = Date.now();
  for (const [packageName, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > maxAge) {
      memoryCache.delete(packageName);
      cacheTimestamps.delete(packageName);
      cleared++;
    }
  }

  // Clear expired file cache
  if (fs.existsSync(cacheDir)) {
    try {
      const files = fs.readdirSync(cacheDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(cacheDir, file);
          const stats = fs.statSync(filePath);

          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            cleared++;
          }
        }
      }
    } catch (error) {
      console.warn('Error clearing expired cache:', error.message);
    }
  }

  return cleared;
}

/**
 * Completely clears all cache entries from both memory and disk
 * @param {Object} [options={}] - Cache clearing options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Cache directory to empty
 * @returns {number} Total number of cleared cache entries (memory + file)
 */
function clearCache (options = {}) {
  const { cacheDir = DEFAULT_CACHE_DIR } = options;
  const memoryCount = memoryCache.size;

  // Clear memory cache
  memoryCache.clear();
  cacheTimestamps.clear();

  // Clear file cache
  let fileCount = 0;
  if (fs.existsSync(cacheDir)) {
    try {
      const files = fs.readdirSync(cacheDir).filter(file => file.endsWith('.json'));
      fileCount = files.length;

      // Remove all cache files
      files.forEach(file => {
        fs.unlinkSync(path.join(cacheDir, file));
      });
    } catch (error) {
      console.warn('Error clearing cache:', error.message);
    }
  }

  return memoryCount + fileCount;
}

/**
 * Generates a unique cache key for a package based on name, scope, and registry
 * @param {string} packageName - Package name to generate a cache key for
 * @param {Object} [options={}] - Options for key generation
 * @param {string} [options.scope='npm'] - Package scope or ecosystem identifier
 * @param {string} [options.registry='https://registry.npmjs.org'] - Registry URL
 * @returns {string} A unique cache key combining package name and hash
 * @private
 */
function getCacheKey (packageName, options = {}) {
  const { scope = 'npm', registry = 'https://registry.npmjs.org' } = options;

  // Create a hash of the package name, scope, and registry
  const hash = crypto
    .createHash('md5')
    .update(`${scope}:${registry}:${packageName}`)
    .digest('hex');

  return `${packageName.replace('/', '_')}-${hash.substring(0, 8)}`;
}

/**
 * Retrieves a cached analysis result for a package if available and valid
 * @param {string} packagePath - Path to the package.json file that was analyzed
 * @param {Object} [options={}] - Cache retrieval options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Directory where cache files are stored
 * @param {number} [options.maxAge=24*60*60*1000] - Maximum age of cache in milliseconds (default: 24 hours)
 * @param {boolean} [options.ignoreIfChanged=true] - Whether to ignore cache if package.json or lock files have changed
 * @returns {Promise<Object|null>} Cached analysis data or null if not found, expired, or invalid
 * @throws {Error} If filesystem operations fail
 * @public
 * @example
 * // Get cached analysis if available
 * const cachedResult = await getCachedAnalysis('/path/to/package.json');
 * if (cachedResult) {
 *   // Use cached result
 * } else {
 *   // Perform fresh analysis
 * }
 */
async function getCachedAnalysis (packagePath, options = {}) {
  const {
    cacheDir = DEFAULT_CACHE_DIR,
    maxAge = 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    ignoreIfChanged = true
  } = options;

  const packageDir = path.dirname(packagePath);
  const packageFile = path.basename(packagePath);

  // Create unique key for this package
  const hash = crypto
    .createHash('md5')
    .update(packagePath)
    .digest('hex');

  const cacheFileName = `analysis-${hash}.json`;
  const cachePath = path.join(cacheDir, cacheFileName);

  try {
    // Check if cache file exists
    if (!await fs.pathExists(cachePath)) {
      return null;
    }

    // Read cache file
    const cacheEntry = await fs.readJson(cachePath);

    // Check if cache is expired
    const now = Date.now();
    if (now - cacheEntry.timestamp > maxAge) {
      return null;
    }

    // If we should check if files have changed
    if (ignoreIfChanged) {
      // Get last modified time of package.json
      const packageStats = await fs.stat(packagePath);
      const packageMtime = packageStats.mtimeMs;

      // Check for lock files
      const lockFiles = [
        path.join(packageDir, 'package-lock.json'),
        path.join(packageDir, 'yarn.lock'),
        path.join(packageDir, 'pnpm-lock.yaml')
      ];

      // Check if any lock file is newer than the cache
      for (const lockFile of lockFiles) {
        if (await fs.pathExists(lockFile)) {
          const lockStats = await fs.stat(lockFile);
          if (lockStats.mtimeMs > cacheEntry.timestamp) {
            return null; // Lock file is newer than cache
          }
        }
      }

      // Check if package.json is newer than cache
      if (packageMtime > cacheEntry.timestamp) {
        return null; // Package.json is newer than cache
      }
    }

    // Return cached data
    return cacheEntry.data;
  } catch (error) {
    console.error(`Error reading analysis cache: ${error.message}`);
    return null;
  }
}

/**
 * Stores analysis results in a cache file for later retrieval
 * @param {string} packagePath - Path to the package.json file that was analyzed
 * @param {Object} analysisData - Analysis results to cache
 * @param {Object} [options={}] - Caching options
 * @param {string} [options.cacheDir=DEFAULT_CACHE_DIR] - Directory to store cache files
 * @returns {Promise<boolean>} Whether the caching operation was successful
 * @throws {Error} If filesystem operations fail
 * @public
 * @example
 * // Cache analysis results
 * const success = await cacheAnalysisResult(
 *   '/path/to/package.json',
 *   analysisResults
 * );
 */
async function cacheAnalysisResult (packagePath, analysisData, options = {}) {
  const { cacheDir = DEFAULT_CACHE_DIR } = options;

  // Create unique key for this package
  const hash = crypto
    .createHash('md5')
    .update(packagePath)
    .digest('hex');

  const cacheFileName = `analysis-${hash}.json`;
  const cachePath = path.join(cacheDir, cacheFileName);

  try {
    // Save cache entry
    await fs.writeJson(cachePath, {
      timestamp: Date.now(),
      packagePath,
      data: analysisData
    });

    return true;
  } catch (error) {
    console.error(`Error writing analysis cache: ${error.message}`);
    return false;
  }
}

/**
 * General purpose cache getter
 * @param {string} key - Cache key
 * @param {Object} [options={}] - Cache options
 * @returns {Object|null} Cached data or null if not found
 */
function getCache(key, options = {}) {
  return getCachedPackageInfo(key, options);
}

/**
 * General purpose cache setter
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {Object} [options={}] - Cache options
 */
function setCache(key, data, options = {}) {
  cachePackageInfo(key, data, options);
}

export {
  initCache,
  getCachedPackageInfo,
  cachePackageInfo,
  clearExpiredCache,
  clearCache,
  DEFAULT_CACHE_DIR,
  getCacheKey,
  getCachedAnalysis,
  cacheAnalysisResult,
  getCache,
  setCache
};
