function generateJsonReport(results) {
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      totalPackages: results.packages.length,
      averageDrift: calculateAverageDrift(results.packages),
      totalSecurityIssues: calculateTotalSecurityIssues(results.packages)
    },
    packages: results.packages.map(pkg => ({
      name: pkg.name,
      currentVersion: pkg.currentVersion,
      expectedVersion: pkg.expectedVersion,
      driftLevel: pkg.driftLevel,
      securityIssues: pkg.vulnerabilities?.length || 0,
      vulnerabilities: pkg.vulnerabilities || []
    }))
  };
}

function calculateAverageDrift(packages) {
  const driftLevels = packages
    .map(pkg => pkg.driftLevel)
    .filter(level => typeof level === 'number');
  
  if (driftLevels.length === 0) return null;
  
  return driftLevels.reduce((sum, level) => sum + level, 0) / driftLevels.length;
}

function calculateTotalSecurityIssues(packages) {
  return packages.reduce((sum, pkg) => sum + (pkg.vulnerabilities?.length || 0), 0);
}

module.exports = {
  generateJsonReport
}; 