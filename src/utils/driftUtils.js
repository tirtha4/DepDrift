/**
 * Utility functions for dependency drift analysis
 * @module utils/driftUtils
 */

const semver = require('semver');

/**
 * Calculate days between two dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date 
 * @returns {number} Number of days between dates
 */
function daysBetween(date1, date2) {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  
  // Convert to UTC to avoid timezone issues
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  
  // Calculate days (86400000 ms in a day)
  return Math.floor((utc2 - utc1) / 86400000);
}

/**
 * Calculate drift level based on version difference and time
 * @param {string} currentVersion - Current version string
 * @param {string} latestVersion - Latest version string
 * @param {number} daysBehind - Days behind latest version
 * @returns {string} Drift level (none, low, medium, high, critical)
 */
function calculateDriftLevel(currentVersion, latestVersion, daysBehind) {
  // No drift if versions match
  if (currentVersion === latestVersion) {
    return 'none';
  }
  
  try {
    // Clean versions for semantic comparison
    const current = semver.valid(semver.coerce(currentVersion));
    const latest = semver.valid(semver.coerce(latestVersion));
    
    if (!current || !latest) {
      // Fallback to days-based calculation if semver parsing fails
      return calculateDriftLevelByDays(daysBehind);
    }
    
    // Semantic version differences have priority over time-based drift:
    // - Major version differences are high/critical (depending on how many major versions behind)
    // - Minor version differences are medium/high 
    // - Patch version differences are low/medium and capped at medium regardless of time
    // This ensures a more meaningful drift classification that focuses on 
    // compatibility risks (major versions) rather than just time elapsed.
    
    // Compare using semantic versioning rules
    if (semver.major(latest) > semver.major(current)) {
      // Major version difference
      const majorDiff = semver.major(latest) - semver.major(current);
      if (majorDiff >= 2) {
        return 'critical';
      }
      return 'high';
    } 
    
    if (semver.minor(latest) > semver.minor(current)) {
      // Minor version difference
      const minorDiff = semver.minor(latest) - semver.minor(current);
      if (minorDiff >= 5) {
        return 'high';
      }
      return 'medium';
    }
    
    if (semver.patch(latest) > semver.patch(current)) {
      // Patch version difference - cap at medium regardless of time
      const patchDiff = semver.patch(latest) - semver.patch(current);
      if (patchDiff >= 10) {
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
    
    // If version comparison is inconclusive (e.g., pre-release versions)
    // Use time-based calculation but cap appropriately
    const timeBased = calculateDriftLevelByDays(daysBehind);
    if (timeBased === 'critical' || timeBased === 'high') {
      return 'medium';
    }
    return timeBased;
    
  } catch (error) {
    // Fallback to days-based calculation if any error occurs
    return calculateDriftLevelByDays(daysBehind);
  }
}

/**
 * Calculate drift level based only on days behind
 * @param {number} days - Days behind latest version
 * @returns {string} Drift level (none, low, medium, high, critical)
 */
function calculateDriftLevelByDays(days) {
  if (days <= 0) {
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
 * Parse a version range string into its components
 * @param {string} versionRange - Version range string (e.g., "^1.2.3")
 * @param {Array<string>} [availableVersions=[]] - List of available versions
 * @returns {Object} Parsed version components
 */
function parseVersionRange(versionRange, availableVersions = []) {
  if (!versionRange) {
    return { type: 'unknown', version: null };
  }
  
  // Handle exact version
  if (semver.valid(versionRange)) {
    return { type: 'exact', version: versionRange };
  }
  
  // Handle caret range (^)
  if (versionRange.startsWith('^')) {
    const version = versionRange.substring(1);
    return { type: 'caret', version };
  }
  
  // Handle tilde range (~)
  if (versionRange.startsWith('~')) {
    const version = versionRange.substring(1);
    return { type: 'tilde', version };
  }
  
  // Handle complex ranges
  if (versionRange.includes(' ') || versionRange.includes('||')) {
    // Find max satisfying version if available
    if (availableVersions.length > 0) {
      const maxVersion = semver.maxSatisfying(availableVersions, versionRange);
      if (maxVersion) {
        return { type: 'complex', version: maxVersion };
      }
    }
    
    // Try to extract a base version from the range
    try {
      const coerced = semver.coerce(versionRange);
      if (coerced) {
        return { type: 'complex', version: coerced.version };
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  // Handle greater than/less than ranges
  if (versionRange.startsWith('>') || versionRange.startsWith('<')) {
    // Use the first available version that satisfies the range
    if (availableVersions.length > 0) {
      const satisfyingVersion = availableVersions.find(v => semver.satisfies(v, versionRange));
      if (satisfyingVersion) {
        return { type: 'comparison', version: satisfyingVersion };
      }
    }
    
    // If no satisfying version found, try to extract a numeric version
    const match = versionRange.match(/\d+\.\d+\.\d+/);
    if (match) {
      return { type: 'comparison', version: match[0] };
    }
  }
  
  // Last resort, try to coerce to a version
  try {
    const coerced = semver.coerce(versionRange);
    if (coerced) {
      return { type: 'coerced', version: coerced.version };
    }
  } catch (error) {
    // Ignore errors
  }
  
  // If all else fails
  return { type: 'unknown', version: versionRange };
}

/**
 * Check if a version is a pre-release version
 * @param {string} version - Version string to check
 * @returns {boolean} True if the version is a pre-release
 */
function isPreRelease(version) {
  if (!version) return false;
  
  try {
    const parsed = semver.parse(version);
    return parsed ? parsed.prerelease.length > 0 : false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if an installed version satisfies a version range
 * @param {string} installedVersion - Installed version
 * @param {string} versionRange - Version range to check against
 * @returns {boolean} True if the installed version satisfies the range
 */
function satisfiesRange(installedVersion, versionRange) {
  if (!installedVersion || !versionRange) {
    return false;
  }
  
  try {
    // Clean up the installed version for comparison
    const cleanVersion = semver.clean(installedVersion) || installedVersion;
    
    // Check if it satisfies the range
    return semver.satisfies(cleanVersion, versionRange, { includePrerelease: true });
  } catch (error) {
    return false;
  }
}

/**
 * Classify the drift status based on version difference
 * @param {string} currentVersion - Current version
 * @param {string} latestVersion - Latest version
 * @returns {string} Drift status (safe, minor, major)
 */
function classifyVersionDrift(currentVersion, latestVersion) {
  if (!currentVersion || !latestVersion) {
    return 'major';
  }
  
  try {
    // Get clean versions
    const current = semver.coerce(currentVersion);
    const latest = semver.coerce(latestVersion);
    
    if (!current || !latest) {
      return 'major';
    }
    
    // Compare major/minor versions
    if (latest.major > current.major) {
      return 'major';
    }
    
    if (latest.minor > current.minor) {
      return 'minor';
    }
    
    // If only patch version differs, consider it safe
    return 'safe';
  } catch (error) {
    return 'major';
  }
}

/**
 * Generate a summary of drift levels in a project
 * @param {Array<Object>} dependencies - Array of analyzed dependencies
 * @returns {Object} Summary of drift levels
 */
function summarizeDriftLevels(dependencies) {
  const summary = {
    total: dependencies.length,
    levels: {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      unknown: 0
    },
    types: {
      regular: 0,
      dev: 0,
      peer: 0,
      optional: 0
    }
  };
  
  dependencies.forEach(dep => {
    // Count by drift level
    summary.levels[dep.driftLevel || 'unknown']++;
    
    // Count by dependency type
    if (dep.isDevDependency) {
      summary.types.dev++;
    } else if (dep.isPeerDependency) {
      summary.types.peer++;
    } else if (dep.isOptionalDependency) {
      summary.types.optional++;
    } else {
      summary.types.regular++;
    }
  });
  
  return summary;
}

module.exports = {
  daysBetween,
  calculateDriftLevel,
  calculateDriftLevelByDays,
  parseVersionRange,
  isPreRelease,
  satisfiesRange,
  classifyVersionDrift,
  summarizeDriftLevels
}; 