/**
 * Core module for dependency assessment
 * @module core/assessor
 */
import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';
import axios from 'axios';

/**
 * Assess the dependencies of a project
 * @param {string} packageJsonPath - Path to the package.json file
 * @param {Object} options - Assessment options
 * @returns {Promise<Object>} Promise resolving to the assessment results
 */
async function assessDependencies(packageJsonPath, options = {}) {
  try {
    // Read and parse package.json
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Get project details
    const projectDir = path.dirname(packageJsonPath);
    const projectName = packageJson.name || path.basename(projectDir);
    const projectVersion = packageJson.version || '0.0.0';
    
    // Extract dependencies
    const dependencies = {};
    
    // Regular dependencies
    if (packageJson.dependencies && !options.excludeDep) {
      Object.entries(packageJson.dependencies).forEach(([name, version]) => {
        dependencies[name] = { 
          version, 
          type: 'dependency'
        };
      });
    }
    
    // Dev dependencies
    if (packageJson.devDependencies && !options.excludeDev) {
      Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
        dependencies[name] = { 
          version, 
          type: 'devDependency' 
        };
      });
    }
    
    // Peer dependencies
    if (packageJson.peerDependencies && !options.excludePeer) {
      Object.entries(packageJson.peerDependencies).forEach(([name, version]) => {
        dependencies[name] = { 
          version, 
          type: 'peerDependency' 
        };
      });
    }
    
    // Optional dependencies
    if (packageJson.optionalDependencies && !options.excludeOptional) {
      Object.entries(packageJson.optionalDependencies).forEach(([name, version]) => {
        dependencies[name] = { 
          version, 
          type: 'optionalDependency' 
        };
      });
    }
    
    // Convert to array and fetch latest versions
    const dependenciesArray = await Promise.all(
      Object.entries(dependencies).map(async ([name, info]) => {
        const currentVersion = semver.valid(semver.coerce(info.version)) || info.version;
        let latestVersion, publishedAt, daysBehind;
        
        try {
          // Fetch package info from npm registry
          const response = await axios.get(`https://registry.npmjs.org/${name}`);
          const npmData = response.data;
          
          // Get latest version
          latestVersion = npmData['dist-tags']?.latest || currentVersion;
          
          // Get publication date of latest version
          const timeData = npmData.time || {};
          publishedAt = timeData[latestVersion] || new Date().toISOString();
          
          // Calculate days behind
          const publishDate = new Date(publishedAt);
          const now = new Date();
          const diffTime = Math.abs(now - publishDate);
          daysBehind = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Calculate drift level
          let driftLevel = 'none';
          
          if (semver.valid(currentVersion) && semver.valid(latestVersion)) {
            if (semver.eq(currentVersion, latestVersion)) {
              driftLevel = 'none';
            } else if (semver.major(currentVersion) < semver.major(latestVersion)) {
              driftLevel = daysBehind > 180 ? 'critical' : 'high';
            } else if (semver.minor(currentVersion) < semver.minor(latestVersion)) {
              driftLevel = daysBehind > 30 ? 'medium' : 'low';
            } else if (semver.patch(currentVersion) < semver.patch(latestVersion)) {
              driftLevel = daysBehind > 14 ? 'low' : 'none';
            }
          } else {
            // If we can't parse versions properly, use days behind as a fallback
            if (daysBehind > 180) driftLevel = 'critical';
            else if (daysBehind > 90) driftLevel = 'high';
            else if (daysBehind > 30) driftLevel = 'medium';
            else if (daysBehind > 14) driftLevel = 'low';
            else driftLevel = 'none';
          }
          
          return {
            name,
            currentVersion,
            latestVersion,
            daysBehind,
            driftLevel,
            isDevDependency: info.type === 'devDependency',
            isPeerDependency: info.type === 'peerDependency',
            isOptionalDependency: info.type === 'optionalDependency',
            type: info.type,
            updateStatus: semver.eq(currentVersion, latestVersion) ? 'up-to-date' : 'outdated',
            lastPublished: publishedAt
          };
        } catch (error) {
          console.error(`Error fetching data for ${name}: ${error.message}`);
          return {
            name,
            currentVersion,
            latestVersion: 'unknown',
            daysBehind: 0,
            driftLevel: 'unknown',
            isDevDependency: info.type === 'devDependency',
            isPeerDependency: info.type === 'peerDependency',
            isOptionalDependency: info.type === 'optionalDependency',
            type: info.type,
            updateStatus: 'unknown',
            lastPublished: 'unknown'
          };
        }
      })
    );
    
    // Build summary
    const summary = {
      totalDependencies: dependenciesArray.length,
      driftLevels: {
        none: dependenciesArray.filter(d => d.driftLevel === 'none').length,
        low: dependenciesArray.filter(d => d.driftLevel === 'low').length,
        medium: dependenciesArray.filter(d => d.driftLevel === 'medium').length,
        high: dependenciesArray.filter(d => d.driftLevel === 'high').length,
        critical: dependenciesArray.filter(d => d.driftLevel === 'critical').length,
        unknown: dependenciesArray.filter(d => d.driftLevel === 'unknown').length
      },
      averageDaysBehind: dependenciesArray.reduce((sum, dep) => sum + (dep.daysBehind || 0), 0) / 
                         (dependenciesArray.length || 1),
      majorVersionsBehind: dependenciesArray.filter(d => 
        semver.valid(d.currentVersion) && 
        semver.valid(d.latestVersion) && 
        semver.major(d.currentVersion) < semver.major(d.latestVersion)
      ).length,
      minorVersionsBehind: dependenciesArray.filter(d => 
        semver.valid(d.currentVersion) && 
        semver.valid(d.latestVersion) && 
        semver.major(d.currentVersion) === semver.major(d.latestVersion) &&
        semver.minor(d.currentVersion) < semver.minor(d.latestVersion)
      ).length,
      patchVersionsBehind: dependenciesArray.filter(d => 
        semver.valid(d.currentVersion) && 
        semver.valid(d.latestVersion) && 
        semver.major(d.currentVersion) === semver.major(d.latestVersion) &&
        semver.minor(d.currentVersion) === semver.minor(d.latestVersion) &&
        semver.patch(d.currentVersion) < semver.patch(d.latestVersion)
      ).length
    };
    
    return {
      projectName,
      projectVersion,
      projectPath: projectDir,
      dependencies: dependenciesArray,
      summary,
      vulnerabilities: [], // Would be populated by security scanner
      recommendations: [], // Would be populated by recommendation generator
      timestamp: new Date().toISOString() // Add timestamp
    };
  } catch (error) {
    console.error(`Error in assessDependencies: ${error.message}`);
    throw error;
  }
}

/**
 * Generate recommendations based on dependency assessment
 * @param {Object} assessment - Assessment results
 * @param {Object} options - Recommendation options
 * @returns {Array} Array of recommendations
 */
function generateRecommendations(assessment, options = {}) {
  const maxRecommendations = options.maxRecommendations || 5;
  
  // Get outdated dependencies sorted by driftLevel priority
  const driftPriority = { critical: 0, high: 1, medium: 2, low: 3, none: 4, unknown: 5 };
  
  const outdatedDeps = assessment.dependencies
    .filter(dep => dep.driftLevel !== 'none' && dep.driftLevel !== 'unknown')
    .sort((a, b) => {
      // First by drift level
      const driftDiff = driftPriority[a.driftLevel] - driftPriority[b.driftLevel];
      if (driftDiff !== 0) return driftDiff;
      
      // Then by days behind
      return (b.daysBehind || 0) - (a.daysBehind || 0);
    });
  
  // Generate recommendations
  const recommendations = outdatedDeps.slice(0, maxRecommendations).map(dep => {
    const priorityMap = { critical: 'high', high: 'high', medium: 'medium', low: 'low' };
    
    let reason = '';
    if (dep.driftLevel === 'critical') {
      reason = `Critical drift: ${dep.daysBehind} days since latest release`;
    } else if (dep.driftLevel === 'high') {
      reason = `High drift: ${dep.daysBehind} days since latest release`;
    } else if (dep.driftLevel === 'medium') {
      reason = `Medium drift: ${dep.daysBehind} days since latest release`;
    } else {
      reason = `Low drift: ${dep.daysBehind} days since latest release`;
    }
    
    // Add version information to reason
    if (semver.valid(dep.currentVersion) && semver.valid(dep.latestVersion)) {
      if (semver.major(dep.currentVersion) < semver.major(dep.latestVersion)) {
        reason += " (Major version update needed)";
      } else if (semver.minor(dep.currentVersion) < semver.minor(dep.latestVersion)) {
        reason += " (Minor version update available)";
      } else if (semver.patch(dep.currentVersion) < semver.patch(dep.latestVersion)) {
        reason += " (Patch update available)";
      }
    }
    
    return {
      dependencyName: dep.name,
      name: dep.name,
      currentVersion: dep.currentVersion,
      recommendedVersion: dep.latestVersion,
      priority: priorityMap[dep.driftLevel] || 'low',
      reason: reason,
      details: reason
    };
  });
  
  return recommendations;
}

/**
 * Assess dependencies for multiple projects
 * @param {Array<string>} projectPaths - Paths to project directories
 * @param {Object} options - Assessment options
 * @returns {Promise<Array<Object>>} Promise resolving to an array of assessment results
 */
async function batchAssessDependencies(projectPaths, options = {}) {
  return Promise.all(
    projectPaths.map(path => assessDependencies(path, options))
  );
}

export {
  assessDependencies,
  generateRecommendations,
  batchAssessDependencies
};
