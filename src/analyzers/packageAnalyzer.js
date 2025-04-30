/**
 * Package analyzer module for evaluating dependency drift and version differences
 * @module analyzers/packageAnalyzer
 * @description Analyzes package dependencies to determine how far behind latest versions they are,
 * calculates drift levels, and provides utilities for version comparison and range parsing.
 */

const path = require('path');
const fs = require('fs-extra');
const { getNpmRegistry } = require('../core/registry');
const semver = require('semver');
const axios = require('axios');
const { initCache } = require('../core/cache');
const { summarizeDriftLevels } = require('../utils/driftUtils');
const { exec } = require('child_process');
const { promisify } = require('util');
const { getCache, setCache } = require('../core/cache.js');

/**
 * Calculate days between two dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number} Number of days between dates
 * @private
 */
function daysBetween (date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);

  // Convert to UTC to avoid timezone issues
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());

  // Calculate days (86400000 ms in a day)
  return Math.floor((utc2 - utc1) / 86400000);
}

/**
 * Determine the drift level based on days behind and semver difference
 * @param {number} daysBehind - Days behind latest version
 * @param {string} currentVersion - Current version
 * @param {string} latestVersion - Latest version
 * @returns {string} Drift level ('none', 'low', 'medium', 'high', 'critical')
 * @private
 */
function determineDriftLevel (daysBehind, currentVersion, latestVersion) {
  if (daysBehind === 0 || currentVersion === latestVersion) {
    return 'none';
  }

  // Parse versions
  const current = semver.parse(currentVersion);
  const latest = semver.parse(latestVersion);

  if (!current || !latest) {
    // If can't parse versions, use days as fallback
    return determineDriftLevelByDays(daysBehind);
  }

  // Prioritize semantic versioning differences over time-based drift
  // This ensures a patch update won't be marked as critical just because it's old
  // - Major version differences are high/critical based on compatibility risk
  // - Minor version differences are medium/high based on feature gap
  // - Patch versions are capped at medium severity regardless of time

  // Major version difference - highest priority
  if (latest.major > current.major) {
    // Multiple major versions behind is critical
    if (latest.major - current.major >= 2) {
      return 'critical';
    }
    // One major version behind is high, regardless of time
    return 'high';
  }

  // Minor version difference (same major)
  if (latest.minor > current.minor) {
    // Many minor versions behind is high
    if (latest.minor - current.minor >= 5) {
      return 'high';
    }
    // Fewer minor versions are medium, regardless of time
    return 'medium';
  }

  // Patch version difference (same major and minor)
  // For patch updates, we'll cap the severity to prevent marking them critical
  if (latest.patch > current.patch) {
    // Many patches behind should be medium at most
    if (latest.patch - current.patch >= 10) {
      return 'medium';
    }

    // For patch updates, consider time but cap at medium
    if (daysBehind > 180) {
      return 'medium';
    } else if (daysBehind > 90) {
      return 'low';
    }

    return 'low';
  }

  // If we get here, it's likely a prerelease version comparison that's tricky to parse
  // Apply time-based calculation but cap at medium for non-major/minor changes
  const timeBased = determineDriftLevelByDays(daysBehind);

  if (timeBased === 'critical' || timeBased === 'high') {
    return 'medium';
  }

  return timeBased;
}

/**
 * Determine drift level based only on days behind
 * @param {number} days - Days behind latest version
 * @returns {string} Drift level ('none', 'low', 'medium', 'high', 'critical')
 * @private
 */
function determineDriftLevelByDays (days) {
  if (days === 0) {
    return 'none';
  }
  if (days <= 60) {
    return 'low';
  }
  if (days <= 180) {
    return 'medium';
  }
  if (days <= 365) {
    return 'high';
  }
  return 'critical';
}

/**
 * Analyze a single dependency for drift
 * @param {string} name - Dependency name
 * @param {string} currentVersion - Current version or semver range
 * @param {boolean} [dev=false] - Whether this is a devDependency
 * @returns {Promise<Object>} Analysis result for the dependency
 * @property {string} name - Package name
 * @property {string} currentVersion - Current version without range indicators
 * @property {string|null} latestVersion - Latest version from registry
 * @property {number} daysBehind - Days behind latest version (-1 if unknown)
 * @property {string} driftLevel - Calculated drift level ('none', 'low', 'medium', 'high', 'critical', 'unknown')
 * @property {string|null} lastUpdated - ISO date string of latest version publication
 * @property {string|undefined} error - Error message if analysis failed
 * @property {boolean} isDevDependency - Whether this is a dev dependency
 * @public
 */
async function analyzeDependency (name, currentVersion, dev = false) {
  const registry = getNpmRegistry();
  let packageInfo;

  try {
    packageInfo = await registry.getPackageInfo(name);
  } catch (error) {
    return {
      name,
      currentVersion,
      latestVersion: null,
      daysBehind: -1,
      driftLevel: 'unknown',
      lastUpdated: null,
      error: error.message,
      isDevDependency: dev
    };
  }

  // Get latest version
  const latestVersion = packageInfo['dist-tags']?.latest;
  if (!latestVersion) {
    return {
      name,
      currentVersion,
      latestVersion: null,
      daysBehind: -1,
      driftLevel: 'unknown',
      lastUpdated: null,
      error: 'No latest version found',
      isDevDependency: dev
    };
  }

  // If currentVersion has range indicators (^~), clean it
  const cleanCurrentVersion = semver.clean(currentVersion) || currentVersion.replace(/[^\d.]/g, '');

  // Last updated date from the latest version
  const lastUpdated = packageInfo.time?.[latestVersion];
  const now = new Date();
  const daysBehind = lastUpdated ? daysBetween(lastUpdated, now) : -1;

  // Determine drift level
  const driftLevel = determineDriftLevel(daysBehind, cleanCurrentVersion, latestVersion);

  return {
    name,
    currentVersion: cleanCurrentVersion,
    latestVersion,
    daysBehind,
    driftLevel,
    lastUpdated,
    isDevDependency: dev
  };
}

/**
 * Analyze a package.json for dependency drift
 * @param {Object} packageInfo - The parsed package.json content
 * @param {Object} [options={}] - Analysis options
 * @param {boolean} [options.groupByLevel=false] - Group results by drift level
 * @param {boolean} [options.excludeProd=false] - Exclude production dependencies
 * @param {boolean} [options.excludeDev=false] - Exclude dev dependencies
 * @param {boolean} [options.excludePeer=false] - Exclude peer dependencies
 * @param {boolean} [options.excludeOptional=false] - Exclude optional dependencies
 * @param {number} [options.maxConcurrent=10] - Maximum concurrent requests
 * @returns {Promise<Object>} Analysis results
 * @property {Array<Object>} dependencies - List of analyzed dependencies
 * @property {Object} summary - Summary statistics of drift levels
 * @public
 */
async function analyzePackage (packageInfo, options = {}) {
  const {
    groupByLevel = false,
    excludeProd = false,
    excludeDev = false,
    excludePeer = false,
    excludeOptional = false,
    maxConcurrent = 10
  } = options;

  // Extract dependencies
  const prodDeps = excludeProd ? {} : (packageInfo.dependencies || {});
  const devDeps = excludeDev ? {} : (packageInfo.devDependencies || {});
  const peerDeps = excludePeer ? {} : (packageInfo.peerDependencies || {});
  const optionalDeps = excludeOptional ? {} : (packageInfo.optionalDependencies || {});

  // Combine dependencies
  const dependencies = [];

  // Process production dependencies
  for (const [name, version] of Object.entries(prodDeps)) {
    // Skip if it's also in optionalDependencies
    if (name in optionalDeps) continue;

    dependencies.push({
      name,
      currentVersion: version.replace(/^[\^~]/, ''),
      isDevDependency: false,
      isOptionalDependency: false,
      isPeerDependency: false,
      type: 'regular'
    });
  }

  // Process optional dependencies
  for (const [name, version] of Object.entries(optionalDeps)) {
    dependencies.push({
      name,
      currentVersion: version.replace(/^[\^~]/, ''),
      isDevDependency: false,
      isOptionalDependency: true,
      isPeerDependency: false,
      type: 'optional'
    });
  }

  // Process dev dependencies
  for (const [name, version] of Object.entries(devDeps)) {
    dependencies.push({
      name,
      currentVersion: version.replace(/^[\^~]/, ''),
      isDevDependency: true,
      isOptionalDependency: false,
      isPeerDependency: false,
      type: 'dev'
    });
  }

  // Process peer dependencies
  for (const [name, version] of Object.entries(peerDeps)) {
    dependencies.push({
      name,
      currentVersion: version.replace(/^[\^~]/, ''),
      isDevDependency: false,
      isOptionalDependency: false,
      isPeerDependency: true,
      type: 'peer'
    });
  }

  // Process in batches to avoid hammering the npm registry
  const batchSize = maxConcurrent;
  const batches = [];

  for (let i = 0; i < dependencies.length; i += batchSize) {
    batches.push(dependencies.slice(i, i + batchSize));
  }

  const results = [];

  // Process batches sequentially
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(async (dep) => {
      try {
        const npmInfo = await fetchNpmPackageInfo(dep.name);

        if (!npmInfo) {
          return {
            ...dep,
            error: 'Failed to fetch package info',
            driftLevel: 'unknown',
            daysBehind: -1
          };
        }

        const latestVersion = npmInfo['dist-tags']?.latest;

        if (!latestVersion) {
          return {
            ...dep,
            error: 'No latest version found',
            driftLevel: 'unknown',
            daysBehind: -1
          };
        }

        // Clean version (remove range indicators)
        const cleanCurrentVersion = semver.clean(dep.currentVersion) ||
          dep.currentVersion.replace(/[^\d.]/g, '');

        // Get publication date of latest version
        const lastUpdated = npmInfo.time?.[latestVersion];
        const now = new Date();
        const daysBehind = lastUpdated ? daysBetween(lastUpdated, now) : -1;

        // Calculate drift level
        const driftLevel = calculateDriftLevel(
          cleanCurrentVersion,
          latestVersion,
          daysBehind
        );

        return {
          ...dep,
          currentVersion: cleanCurrentVersion,
          latestVersion,
          daysBehind,
          driftLevel,
          lastUpdated
        };
      } catch (error) {
        return {
          ...dep,
          error: error.message,
          driftLevel: 'unknown',
          daysBehind: -1
        };
      }
    }));

    results.push(...batchResults);
  }

  // Generate summary statistics
  const summary = summarizeDriftLevels(results);

  // Create the result object
  const result = {
    dependencies: results,
    summary,
    timestamp: new Date().toISOString(),
    projectName: packageInfo.name || 'Unknown Project',
    projectVersion: packageInfo.version || '0.0.0'
  };

  // Group by level if requested
  if (groupByLevel) {
    result.byLevel = {
      critical: results.filter(d => d.driftLevel === 'critical'),
      high: results.filter(d => d.driftLevel === 'high'),
      medium: results.filter(d => d.driftLevel === 'medium'),
      low: results.filter(d => d.driftLevel === 'low'),
      none: results.filter(d => d.driftLevel === 'none'),
      unknown: results.filter(d => d.driftLevel === 'unknown'),
      'peer-missing': results.filter(d => d.driftLevel === 'peer-missing'),
      'optional-missing': results.filter(d => d.driftLevel === 'optional-missing')
    };
  }

  return result;
}

/**
 * Calculate the drift level based on version difference and days behind
 * @param {string} currentVersion - Current version
 * @param {string} latestVersion - Latest version
 * @param {number} daysBehind - Days behind latest version
 * @returns {string} Drift level ('none', 'low', 'medium', 'high', 'critical')
 * @public
 */
function calculateDriftLevel (currentVersion, latestVersion, daysBehind) {
  // If versions are the same, no drift
  if (currentVersion === latestVersion) {
    return 'none';
  }

  // Parse versions with semver
  const current = semver.parse(currentVersion);
  const latest = semver.parse(latestVersion);

  if (!current || !latest) {
    // If can't parse versions, use days as fallback
    return calculateDriftLevelByDays(daysBehind);
  }

  let driftLevel = 'low';

  // Major version difference
  if (latest.major > current.major) {
    const majorDiff = latest.major - current.major;
    driftLevel = majorDiff >= 2 ? 'critical' : 'high';
  }
  // Minor version difference (same major)
  else if (latest.minor > current.minor) {
    const minorDiff = latest.minor - current.minor;
    driftLevel = minorDiff >= 5 ? 'high' : 'medium';
  }
  // Patch version difference (same major and minor)
  else if (latest.patch > current.patch) {
    const patchDiff = latest.patch - current.patch;
    driftLevel = patchDiff >= 10 ? 'medium' : 'low';
  }

  // Also consider days behind
  const driftByDays = calculateDriftLevelByDays(daysBehind);

  // Return the more severe of the two levels
  const severityOrder = {
    'none': 0,
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };

  return severityOrder[driftByDays] > severityOrder[driftLevel]
    ? driftByDays
    : driftLevel;
}

/**
 * Calculate drift level based only on days behind
 * @param {number} days - Days behind latest version
 * @returns {string} Drift level ('none', 'low', 'medium', 'high', 'critical')
 * @public
 */
function calculateDriftLevelByDays (days) {
  if (days <= 0) {
    return 'none';
  }
  if (days <= 30) {
    return 'low';
  }
  if (days <= 90) {
    return 'medium';
  }
  if (days <= 180) {
    return 'high';
  }
  return 'critical';
}

/**
 * Fetch npm package information from the registry
 * @param {string} packageName - Package name to fetch information for
 * @param {Object} [options={}] - Fetch options
 * @param {boolean} [options.useCache=true] - Whether to use cached information if available
 * @returns {Promise<Object|null>} Package information object or null if not found/error
 * @public
 */
async function fetchNpmPackageInfo (packageName, options = {}) {
  const registry = getNpmRegistry();
  try {
    return await registry.getPackageInfo(packageName);
  } catch (error) {
    console.error(`Error fetching package info for ${packageName}: ${error.message}`);
    return null;
  }
}

/**
 * Parse a version range to get a specific version
 * @param {string} versionRange - Version range (e.g., ^1.2.3, ~2.0.0)
 * @param {Array<string>} [availableVersions=[]] - Available versions to select from
 * @returns {string} Specific version that satisfies the range, or cleaned version string
 * @public
 * @example
 * // Returns "1.2.3" given "^1.2.0" and ["1.0.0", "1.1.0", "1.2.3"]
 * parseVersionRange('^1.2.0', ['1.0.0', '1.1.0', '1.2.3']);
 */
function parseVersionRange (versionRange, availableVersions = []) {
  // If it's already a specific version, return it
  if (semver.valid(versionRange)) {
    return versionRange;
  }

  // If it has a range indicator, find the highest matching version
  if (availableVersions.length > 0) {
    try {
      // Filter out prerelease versions unless the range explicitly includes them
      const filteredVersions = versionRange.includes('-')
        ? availableVersions
        : availableVersions.filter(v => !isPreRelease(v));

      // Find the highest version that satisfies the range
      const highestMatching = semver.maxSatisfying(filteredVersions, versionRange);

      if (highestMatching) {
        return highestMatching;
      }
    } catch (error) {
      // If semver parsing fails, continue to fallback
    }
  }

  // Fallback: strip range indicators and return
  return versionRange.replace(/^[\^~]/, '');
}

/**
 * Check if a version is a prerelease version (alpha, beta, rc, etc.)
 * @param {string} version - Version to check
 * @returns {boolean} True if it's a prerelease version, false otherwise
 * @public
 */
function isPreRelease (version) {
  if (!version) return false;

  const parsed = semver.parse(version);
  if (!parsed) return false;

  return parsed.prerelease.length > 0;
}

/**
 * Check if an installed version satisfies a version range specification
 * @param {string} installedVersion - The installed version to check
 * @param {string} versionRange - The version range specification (e.g., ^1.0.0, ~2.0.0)
 * @returns {boolean} True if the installed version satisfies the range, false otherwise
 * @public
 * @example
 * // Returns true
 * satisfiesRange('1.2.3', '^1.0.0');
 *
 * // Returns false
 * satisfiesRange('1.2.3', '^2.0.0');
 */
function satisfiesRange (installedVersion, versionRange) {
  try {
    // Handle exact versions
    if (versionRange === installedVersion) {
      return true;
    }

    // Use semver to check if the installed version satisfies the range
    return semver.satisfies(installedVersion, versionRange);
  } catch (error) {
    // In case of parsing errors, fall back to string comparison
    return versionRange.includes(installedVersion);
  }
}

async function getPackageVersions(packageName) {
  try {
    // ... existing code ...
  } catch (err) {
    console.warn(`Error fetching versions for ${packageName}:`, err);
    return [];
  }
}

// Export functions
module.exports = {
  analyzePackage,
  analyzeDependency,
  determineDriftLevel,
  determineDriftLevelByDays,
  daysBetween,
  calculateDriftLevel,
  calculateDriftLevelByDays,
  fetchNpmPackageInfo,
  parseVersionRange,
  isPreRelease,
  satisfiesRange,
  getPackageVersions
};
