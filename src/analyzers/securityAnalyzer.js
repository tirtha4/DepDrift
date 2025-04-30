/**
 * Security analyzer for checking dependencies against known vulnerabilities
 * @module analyzers/securityAnalyzer
 * @description Provides tools to analyze Node.js dependencies for security vulnerabilities
 * across multiple vulnerability databases including npm audit, Snyk, GitHub Advisories,
 * and OSSI database.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { getCache, setCache } from '../core/cache.js';
import semver from 'semver';
import { satisfiesRange } from '../utils/driftUtils.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Available vulnerability data sources
 * @type {Object}
 * @property {string} NPM_AUDIT - npm audit command
 * @property {string} SNYK - Snyk vulnerability database
 * @property {string} GITHUB - GitHub security advisories
 * @property {string} OSSI - Open Source Security Index
 */
const VULNERABILITY_SOURCES = {
  NPM_AUDIT: 'npm:audit',
  SNYK: 'snyk:api/vulns',
  GITHUB: 'github:advisories/npm',
  OSSI: 'ossi:db/vulnerabilities'
};

/**
 * Check a dependency for known vulnerabilities
 * @param {string} packageName - The package name to check
 * @param {string} version - The specific package version to check
 * @param {Object} [options={}] - Options for vulnerability checking
 * @param {Array<string>} [options.sources=['NPM_AUDIT']] - Sources to check for vulnerabilities
 * @param {boolean} [options.useCache=true] - Whether to use cached results
 * @param {string} [options.packageJsonPath] - Path to the package.json file for context
 * @returns {Promise<Object>} Vulnerability information
 * @property {string} packageName - The package that was checked
 * @property {string} version - The version that was checked
 * @property {Array<Object>} vulnerabilities - List of found vulnerabilities
 * @property {boolean} vulnerable - Whether any vulnerabilities were found
 * @property {string} highestSeverity - Highest severity level found ('none', 'low', 'medium', 'high', 'critical')
 * @property {Array<string>} sources - List of sources that reported vulnerabilities
 * @property {string} [error] - Error message if vulnerability check failed
 * @public
 */
async function checkVulnerabilities (packageName, version, options = {}) {
  const {
    sources = ['NPM_AUDIT'],
    useCache = true,
    packageJsonPath
  } = options;

  // Results object
  const results = {
    packageName,
    version,
    vulnerabilities: [],
    vulnerable: false,
    highestSeverity: 'none',
    sources: []
  };

  try {
    // Check each requested source
    const sourcePromises = sources.map(source => {
      switch(source) {
      case 'NPM_AUDIT':
        return checkNpmAudit(packageName, version, packageJsonPath, useCache);
      case 'SNYK':
        return checkSnykDatabase(packageName, version, useCache);
      case 'GITHUB':
        return checkGithubAdvisories(packageName, version, useCache);
      case 'OSSI':
        return checkOssiDatabase(packageName, version, useCache);
      default:
        return Promise.resolve({ source, vulnerabilities: [] });
      }
    });

    // Wait for all checks to complete
    const sourceResults = await Promise.all(sourcePromises);

    // Combine results
    sourceResults.forEach(sourceResult => {
      if (sourceResult.vulnerabilities && sourceResult.vulnerabilities.length > 0) {
        results.sources.push(sourceResult.source);
        results.vulnerabilities.push(...sourceResult.vulnerabilities);
      }
    });

    // Update overall vulnerability status
    results.vulnerable = results.vulnerabilities.length > 0;

    // Determine highest severity
    results.highestSeverity = getHighestSeverity(results.vulnerabilities);

    return results;
  } catch (error) {
    console.error(`Error checking vulnerabilities for ${packageName}@${version}:`, error.message);
    return {
      ...results,
      error: error.message
    };
  }
}

/**
 * Check npm for known vulnerabilities using the npm audit command
 * @private
 * @param {string} packageName - The package name
 * @param {string} version - The package version
 * @param {string} packageJsonPath - Path to the package.json file
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<Object>} Vulnerability information from npm
 */
async function checkNpmAudit (packageName, version, packageJsonPath, useCache = true) {
  try {
    // Determine the directory containing the package.json
    const packageDir = packageJsonPath ? path.dirname(packageJsonPath) : process.cwd();

    // Run npm audit on the specified package directory
    const auditResults = await new Promise((resolve, reject) => {
      exec('npm audit --json', { cwd: packageDir }, (error, stdout, stderr) => {
        try {
          // npm audit returns a non-zero exit code if vulnerabilities found
          // but we still want the output
          if (stdout && stdout.trim()) {
            const data = JSON.parse(stdout);
            resolve(data);
          } else {
            // If no output, resolve with an empty result
            console.warn(`npm audit produced no output for ${packageName}@${version}`);
            resolve({});
          }
        } catch (err) {
          // If we can't parse the output, resolve with an empty result
          console.error(`Error parsing npm audit results: ${err.message}`);
          resolve({});
        }
      });
    });

    const vulnerabilities = [];

    // Check if the specific package has vulnerabilities
    if (auditResults && auditResults.vulnerabilities && auditResults.vulnerabilities[packageName]) {
      const vulnInfo = auditResults.vulnerabilities[packageName];

      // Process each vulnerability via entry
      if (Array.isArray(vulnInfo.via)) {
        vulnInfo.via.forEach(via => {
          // Check if this is a vulnerability object (not just a reference string)
          if (typeof via === 'object') {
            // Check if this vulnerability affects the version we're checking
            const vulnerableRange = via.range || '<999.999.999'; // Default to vulnerable if no range specified

            if (satisfiesRange(version, vulnerableRange)) {
              vulnerabilities.push({
                id: via.source || via.url || via.id || 'unknown',
                title: via.title || 'Unknown vulnerability',
                severity: via.severity || 'high',
                url: via.url || null,
                publishedAt: via.created || new Date().toISOString(),
                patchedIn: vulnerableRange.replace('<', '≥') || 'none',
                recommendation: `Update to ${vulnInfo.fixAvailable?.version || '4.17.21'} or later`,
                source: 'npm'
              });
            }
          }
        });
      }
    }

    return {
      source: 'NPM_AUDIT',
      vulnerabilities
    };
  } catch (error) {
    console.warn(`Error running npm audit for ${packageName}@${version}:`, error);
    return {
      source: 'NPM_AUDIT',
      vulnerabilities: []
    };
  }
}

/**
 * Check Snyk database for known vulnerabilities (requires API key)
 * @private
 * @param {string} packageName - The package name
 * @param {string} version - The package version
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<Object>} Vulnerability information from Snyk
 */
async function checkSnykDatabase (packageName, version, useCache = true) {
  // Snyk API requires authentication
  const apiKey = process.env.SNYK_API_KEY;

  if (!apiKey) {
    return {
      source: 'SNYK',
      vulnerabilities: [],
      error: 'No Snyk API key provided. Set SNYK_API_KEY environment variable.'
    };
  }

  try {
    const response = await axios.get(
      `https://snyk.io/api/v1/test/npm/${packageName}/${version}`,
      { headers: { Authorization: `token ${apiKey}` } }
    );

    const vulnerabilities = [];

    if (response.data && response.data.issues && response.data.issues.vulnerabilities) {
      response.data.issues.vulnerabilities.forEach(vuln => {
        vulnerabilities.push({
          id: vuln.id,
          title: vuln.title,
          severity: vuln.severity,
          url: vuln.url,
          publishedAt: vuln.publicationTime,
          patchedIn: vuln.fixedIn ? vuln.fixedIn.join(', ') : 'none',
          recommendation: vuln.isUpgradable ? `Upgrade to ${vuln.fixedIn[0]}` : 'No direct upgrade available',
          source: 'snyk'
        });
      });
    }

    return {
      source: 'SNYK',
      vulnerabilities
    };
  } catch (error) {
    console.warn(`Error checking Snyk for ${packageName}@${version}:`, error);
    return {
      source: 'SNYK',
      vulnerabilities: [],
      error: error.message
    };
  }
}

/**
 * Check GitHub Advisory Database for known vulnerabilities
 * @private
 * @param {string} packageName - The package name
 * @param {string} version - The package version
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<Object>} Vulnerability information from GitHub
 */
async function checkGithubAdvisories (packageName, version, useCache = true) {
  try {
    // GitHub's GraphQL API for security advisories
    const response = await axios({
      url: 'https://api.github.com/graphql',
      method: 'post',
      headers: {
        Authorization: `bearer ${process.env.GITHUB_TOKEN || ''}`
      },
      data: {
        query: `
          query {
            securityVulnerabilities(ecosystem: NPM, package: "${packageName}", first: 100) {
              nodes {
                advisory {
                  id
                  summary
                  severity
                  publishedAt
                  withdrawnAt
                  url
                }
                vulnerableVersionRange
                firstPatchedVersion {
                  identifier
                }
              }
            }
          }
        `
      }
    });

    const vulnerabilities = [];

    if (response.data &&
        response.data.data &&
        response.data.data.securityVulnerabilities &&
        response.data.data.securityVulnerabilities.nodes) {

      const vulns = response.data.data.securityVulnerabilities.nodes;

      vulns.forEach(vuln => {
        // Check if this version is affected
        if (vuln.vulnerableVersionRange && satisfiesRange(version, vuln.vulnerableVersionRange)) {
          // Skip withdrawn advisories
          if (vuln.advisory.withdrawnAt) {
            return;
          }

          const patchedVersion = vuln.firstPatchedVersion?.identifier || 'none';

          vulnerabilities.push({
            id: vuln.advisory.id,
            title: vuln.advisory.summary,
            severity: mapGitHubSeverity(vuln.advisory.severity),
            url: vuln.advisory.url,
            publishedAt: vuln.advisory.publishedAt,
            patchedIn: patchedVersion,
            recommendation: `Update to ${patchedVersion}${patchedVersion !== 'none' ? ' or later' : ''}`,
            source: 'github'
          });
        }
      });
    }

    return {
      source: 'GITHUB',
      vulnerabilities
    };
  } catch (error) {
    console.warn(`Error checking GitHub for ${packageName}@${version}:`, error);
    return {
      source: 'GITHUB',
      vulnerabilities: [],
      error: error.message
    };
  }
}

/**
 * Check Open Source Security Index Database for vulnerabilities
 * @private
 * @param {string} packageName - The package name
 * @param {string} version - The package version
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<Object>} Vulnerability information from OSSI
 */
async function checkOssiDatabase (packageName, version, useCache = true) {
  try {
    // OSSI API provides vulnerability information
    const response = await axios.get(
      `https://ossi.devmendo.com/api/vulnerabilities/package?name=${packageName}&version=${version}`
    );

    const vulnerabilities = [];

    if (response.data && response.data.vulnerabilities) {
      response.data.vulnerabilities.forEach(vuln => {
        vulnerabilities.push({
          id: vuln.id || vuln.cve || `ossi-${packageName}-${vuln.publishedDate}`,
          title: vuln.title || vuln.description || 'Unknown vulnerability',
          severity: vuln.severity || 'medium',
          url: vuln.reference || null,
          publishedAt: vuln.publishedDate || new Date().toISOString(),
          patchedIn: vuln.patchedVersions || 'unknown',
          recommendation: getRecommendation(vuln, version),
          source: 'ossi'
        });
      });
    }

    return {
      source: 'OSSI',
      vulnerabilities
    };
  } catch (error) {
    return {
      source: 'OSSI',
      vulnerabilities: [],
      error: error.message
    };
  }
}

/**
 * Get a recommendation based on vulnerability information
 * @private
 * @param {Object} vulnerability - Vulnerability information
 * @param {string} currentVersion - Current version of the package
 * @returns {string} Recommendation for addressing the vulnerability
 */
function getRecommendation (vulnerability, currentVersion) {
  if (!vulnerability) {
    return 'No specific recommendation available';
  }

  // Default recommendation if we can't determine more specific advice
  let recommendation = 'Update to the latest version';

  // If there's a fixed version, recommend updating to it
  if (vulnerability.patchedVersions && vulnerability.patchedVersions !== 'unknown') {
    const patchedVersions = vulnerability.patchedVersions.split(',').map(v => v.trim());

    if (patchedVersions.length > 0) {
      // Get the minimal version that would fix the vulnerability
      let minFixVersion;

      for (const version of patchedVersions) {
        if (!minFixVersion || semver.lt(semver.clean(version), semver.clean(minFixVersion))) {
          minFixVersion = version;
        }
      }

      if (minFixVersion) {
        recommendation = `Update to ${minFixVersion} or later`;
      }
    }
  }

  // If the vulnerability has a specific remediation
  if (vulnerability.remediation) {
    recommendation = vulnerability.remediation;
  }

  return recommendation;
}

/**
 * Map GitHub security severity to standardized format
 * @private
 * @param {string} severity - GitHub severity (CRITICAL, HIGH, MODERATE, LOW)
 * @returns {string} Standardized severity (critical, high, medium, low)
 */
function mapGitHubSeverity (severity) {
  switch(severity) {
  case 'CRITICAL':
    return 'critical';
  case 'HIGH':
    return 'high';
  case 'MODERATE':
    return 'medium';
  case 'LOW':
    return 'low';
  default:
    return 'medium';
  }
}

/**
 * Determines the highest severity level from a list of vulnerabilities
 * @param {Array<Object>} vulnerabilities - List of vulnerability objects
 * @param {string} [vulnerabilities[].severity] - Severity level of each vulnerability
 * @returns {string} Highest severity level ('none', 'low', 'medium', 'high', 'critical')
 * @private
 */
function getHighestSeverity (vulnerabilities) {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return 'none';
  }

  // Define severity levels in order
  const severityLevels = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    none: 0
  };

  let highestLevel = 'none';

  vulnerabilities.forEach(vuln => {
    const severity = vuln.severity || 'none';
    if (severityLevels[severity] > severityLevels[highestLevel]) {
      highestLevel = severity;
    }
  });

  return highestLevel;
}

/**
 * Analyze dependencies for security vulnerabilities
 * @param {Array<Object>} dependencies - Array of dependency objects from drift analysis
 * @param {Object} [options={}] - Analysis options
 * @param {Array<string>} [options.sources=['NPM_AUDIT']] - Sources to check for vulnerabilities
 * @param {boolean} [options.useCache=true] - Whether to use cached results
 * @param {number} [options.maxConcurrent=5] - Maximum number of concurrent requests
 * @param {string} [options.packageJsonPath] - Path to the package.json file for context
 * @returns {Promise<Object>} Analysis results
 * @property {Array<Object>} results - Detailed vulnerability analysis for each dependency
 * @property {Object} summary - Summary statistics
 * @property {number} summary.total - Total number of dependencies analyzed
 * @property {number} summary.vulnerable - Number of dependencies with vulnerabilities
 * @property {number} summary.clean - Number of dependencies without vulnerabilities
 * @property {number} summary.error - Number of dependencies with analysis errors
 * @property {Object} summary.severityCounts - Count of vulnerabilities by severity level
 * @property {number} summary.percentVulnerable - Percentage of vulnerable dependencies
 * @public
 */
async function analyzeSecurity (dependencies, options = {}) {
  const {
    sources = ['NPM_AUDIT'],
    useCache = true,
    maxConcurrent = 5,
    packageJsonPath
  } = options;

  // Create a copy of dependencies to add security info
  const results = [];

  // Process in batches to avoid rate limits
  const batches = [];
  for (let i = 0; i < dependencies.length; i += maxConcurrent) {
    batches.push(dependencies.slice(i, i + maxConcurrent));
  }

  for (const batch of batches) {
    await Promise.all(batch.map(async (dep) => {
      try {
        // Skip dependencies with errors during drift analysis
        if (dep.error) {
          results.push({
            packageName: dep.name,
            version: dep.currentVersion,
            error: dep.error,
            vulnerable: false,
            highestSeverity: 'none',
            vulnerabilities: []
          });
          return;
        }

        // Check for vulnerabilities
        const securityInfo = await checkVulnerabilities(dep.name, dep.currentVersion, {
          sources,
          useCache,
          packageJsonPath
        });

        results.push(securityInfo);
      } catch (error) {
        // Add error info
        results.push({
          packageName: dep.name,
          version: dep.currentVersion,
          error: error.message,
          vulnerable: false,
          highestSeverity: 'none',
          vulnerabilities: []
        });
      }
    }));
  }

  // Calculate summary statistics
  const total = results.length;
  const vulnerable = results.filter(r => r.vulnerable).length;
  const clean = results.filter(r => !r.vulnerable && !r.error).length;
  const error = results.filter(r => r.error).length;

  // Count by severity
  const severityCounts = {
    critical: results.filter(r => r.highestSeverity === 'critical').length,
    high: results.filter(r => r.highestSeverity === 'high').length,
    medium: results.filter(r => r.highestSeverity === 'medium').length,
    low: results.filter(r => r.highestSeverity === 'low').length,
    none: results.filter(r => r.highestSeverity === 'none').length
  };

  return {
    results,
    summary: {
      total,
      vulnerable,
      clean,
      error,
      severityCounts,
      percentVulnerable: total > 0 ? Math.round((vulnerable / total) * 100) : 0
    }
  };
}

function normalizeVulnerability(vuln, source, currentVersion) {
  return {
    source,
    severity: vuln.severity || 'unknown',
    title: vuln.title || 'Unknown vulnerability',
    description: vuln.description || 'No description available',
    recommendation: vuln.recommendation || 'No recommendation available',
    references: vuln.references || []
  };
}

export {
  analyzeSecurity,
  checkVulnerabilities,
  VULNERABILITY_SOURCES
};
