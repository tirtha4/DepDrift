/**
 * Registry interface module for accessing npm package metadata
 * @module core/registry
 */

const axios = require('axios');
const semver = require('semver');
const { initCache, getCachedPackageInfo, cachePackageInfo } = require('./cache');

// Default registry URL
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

// Registry instance cache
let npmRegistryInstance = null;

/**
 * Creates a registry interface for accessing package information
 * @param {Object} [options={}] - Registry configuration options
 * @param {string} [options.registryUrl=DEFAULT_REGISTRY] - The npm registry URL to use
 * @param {boolean} [options.useCache=true] - Whether to use a cache for package information to reduce network requests
 * @param {number} [options.cacheTTL=3600000] - Cache time-to-live in milliseconds (default: 1 hour)
 * @returns {Object} Registry interface object with methods for fetching package data
 */
function createRegistry (options = {}) {
  const {
    registryUrl = DEFAULT_REGISTRY,
    useCache = true,
    cacheTTL = 3600000 // 1 hour
  } = options;

  // Initialize cache if using it
  if (useCache) {
    initCache({ ttl: cacheTTL });
  }

  return {
    /**
     * Gets complete package information from the registry
     * @param {string} packageName - Package name to fetch
     * @returns {Promise<Object>} Package information including versions, dist-tags, and metadata
     * @throws {Error} If package is not found or request fails
     */
    async getPackageInfo (packageName) {
      // Check cache first if enabled
      if (useCache) {
        const cachedInfo = getCachedPackageInfo(packageName);
        if (cachedInfo) {
          return cachedInfo;
        }
      }

      try {
        // Encode package name for URL safety
        const encodedPackageName = encodeURIComponent(packageName);

        // Make the registry request
        const response = await axios.get(`${registryUrl}/${encodedPackageName}`);

        // Cache the result if caching is enabled
        if (useCache && response.data) {
          cachePackageInfo(packageName, response.data);
        }

        return response.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          throw new Error(`Package '${packageName}' not found in registry`);
        }
        throw new Error(`Failed to fetch package info: ${error.message}`);
      }
    },

    /**
     * Gets all available versions for a package
     * @param {string} packageName - Package name
     * @returns {Promise<Array<string>>} List of all available version strings
     * @throws {Error} If package info cannot be retrieved
     */
    async getPackageVersions (packageName) {
      const info = await this.getPackageInfo(packageName);
      return Object.keys(info.versions || {});
    },

    /**
     * Gets the latest version of a package
     * @param {string} packageName - Package name
     * @returns {Promise<string>} Latest version string
     * @throws {Error} If package info cannot be retrieved
     */
    async getLatestVersion (packageName) {
      const info = await this.getPackageInfo(packageName);
      return info['dist-tags']?.latest;
    },

    /**
     * Finds the highest version that satisfies a semver range
     * @param {string} packageName - Package name
     * @param {string} versionRange - Semver range (e.g., '^1.0.0', '>=2.0.0 <3.0.0')
     * @returns {Promise<string|null>} Highest matching version or null if none satisfies
     * @throws {Error} If package info cannot be retrieved
     */
    async getHighestMatchingVersion (packageName, versionRange) {
      const versions = await this.getPackageVersions(packageName);
      return semver.maxSatisfying(versions, versionRange);
    },

    /**
     * Gets the publication time for a specific version
     * @param {string} packageName - Package name
     * @param {string} version - Specific package version
     * @returns {Promise<Date>} The publication timestamp as a Date object
     * @throws {Error} If publication time is not found or package info cannot be retrieved
     */
    async getVersionTime (packageName, version) {
      const info = await this.getPackageInfo(packageName);
      const timeStr = info.time?.[version];

      if (!timeStr) {
        throw new Error(`Publication time not found for ${packageName}@${version}`);
      }

      return new Date(timeStr);
    }
  };
}

/**
 * Gets the default npm registry instance (singleton)
 * Creates a new instance if one doesn't already exist
 * @returns {Object} Default npm registry interface with standard configuration
 */
function getNpmRegistry () {
  if (!npmRegistryInstance) {
    npmRegistryInstance = createRegistry();
  }
  return npmRegistryInstance;
}

module.exports = {
  createRegistry,
  getNpmRegistry,
  DEFAULT_REGISTRY
};
