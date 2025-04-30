/**
 * DepDrift HTML Formatter
 * Formats dependency analysis results as HTML
 * 
 * @module formatters/htmlFormatter
 */

'use strict';

/**
 * Format analysis results as HTML
 * @param {Object} results - Analysis results
 * @param {Object} options - Formatting options
 * @returns {string} HTML report
 */
function generateHtmlReport(results, options = {}) {
  // Start with HTML structure
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dependency Analysis: ${results.projectName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #fafafa;
    }
    h1, h2, h3 {
      color: #0366d6;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 20px 0;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      border-radius: 6px;
      overflow: hidden;
    }
    th {
      background-color: #24292e;
      color: white;
      text-align: left;
      padding: 12px 15px;
      font-weight: 600;
      position: sticky;
      top: 0;
    }
    td {
      padding: 10px 15px;
      border-bottom: 1px solid #eaecef;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background-color: #f6f8fa;
    }
    tr:hover {
      background-color: #f0f4f8;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .summary {
      background-color: white;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .status {
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    .excellent { background-color: #28a745; color: white; }
    .good { background-color: #34d058; color: white; }
    .fair { background-color: #ffcc00; color: #24292e; }
    .poor { background-color: #d73a49; color: white; }
    .critical { background-color: #d73a49; color: white; }
    .high { background-color: #ea4a5a; color: white; }
    .medium { background-color: #ffcc00; color: #24292e; }
    .low { background-color: #28a745; color: white; }
    .none { color: #6a737d; }
    .drift-critical { color: #d73a49; font-weight: bold; }
    .drift-high { color: #ea4a5a; font-weight: bold; }
    .drift-medium { color: #ffcc00; }
    .drift-low { color: #28a745; }
    .drift-none { color: #6a737d; }
    .security { 
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
      font-weight: bold;
    }
    .security.high { 
      background-color: #d73a49; 
      color: white;
    }
    .security.medium { 
      background-color: #ffcc00; 
      color: #24292e;
    }
    .security.low { 
      background-color: #28a745; 
      color: white;
    }
    .security.none { 
      background-color: #eaecef; 
      color: #6a737d;
    }
    .updates-needed {
      color: #d73a49;
    }
    .up-to-date {
      color: #28a745;
    }
    .explanation {
      background-color: white;
      border-radius: 6px;
      padding: 20px;
      margin-top: 30px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .vulnerabilities {
      margin-top: 30px;
    }
    .vuln-item {
      background-color: #fff8f8;
      border: 1px solid #d73a49;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    .vuln-title {
      font-weight: bold;
      color: #d73a49;
      margin-bottom: 10px;
      font-size: 1.1em;
    }
    .last-updated-recent { color: #28a745; }
    .last-updated-medium { color: #ffcc00; }
    .last-updated-old { color: #d73a49; }
    .days-count {
      text-align: right;
      font-family: monospace;
    }
    .package-name {
      font-weight: bold;
    }
    .package-dev {
      font-style: italic;
      color: #6a737d;
      font-size: 0.9em;
      margin-left: 6px;
    }
    .version {
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1>Dependency Analysis Report</h1>
  <div class="summary">
    <h2>${results.projectName}@${results.projectVersion}</h2>
    <p>Path: ${results.packageJsonPath || results.projectPath}</p>
    <p>Analysis date: ${new Date(results.timestamp).toLocaleString()}</p>
    <p>Overall status: <span class="status ${results.overallAssessment?.status?.toLowerCase() || 'unknown'}">${results.overallAssessment?.status || 'Unknown'}</span></p>
    <p>Outdated dependencies: ${results.overallAssessment?.outdatedDependencies || 0} of ${results.overallAssessment?.totalDependencies || results.dependencies?.length || 0}</p>
    <p>Vulnerable dependencies: ${results.securitySummary?.vulnerable || 0} of ${results.securitySummary?.total || results.dependencies?.length || 0}</p>
  </div>

  <h2>Dependencies</h2>
  <table>
    <thead>
      <tr>
        <th>Package</th>
        <th>Current</th>
        <th>Latest</th>
        <th>Update Status</th>
        <th>Last Updated</th>
        <th>Drift</th>
        <th>Security</th>
      </tr>
    </thead>
    <tbody>
`;

  // Sort dependencies by drift level (most severe first)
  const dependencies = [...(results.dependencies || [])];
  dependencies.sort((a, b) => {
    const driftOrder = { 'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'none': 1, undefined: 0 };
    const securityOrder = { 'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'none': 1, undefined: 0 };
    
    // First compare by security severity
    const securityDiff = (securityOrder[b.security?.highestSeverity] || 0) - (securityOrder[a.security?.highestSeverity] || 0);
    if (securityDiff !== 0) return securityDiff;
    
    // Then compare by drift level
    return (driftOrder[b.driftLevel] || 0) - (driftOrder[a.driftLevel] || 0);
  });

  // Add each dependency row
  dependencies.forEach(dep => {
    const hasVulnerabilities = dep.security && dep.security.vulnerable;
    
    // Prepare update status text and class
    let updateStatusHtml = '';
    if (dep.currentVersion === dep.latestVersion) {
      updateStatusHtml = '<span class="up-to-date">Up to date</span>';
    } else {
      const daysBehind = dep.daysBehind || 0;
      updateStatusHtml = `<span class="updates-needed">Needs update${daysBehind > 0 ? ' (' + daysBehind + ' days behind)' : ''}</span>`;
    }
    
    // Determine the last updated class
    let lastUpdatedClass = '';
    let lastUpdatedText = 'Unknown';
    
    if (dep.lastUpdated) {
      const lastUpdated = new Date(dep.lastUpdated);
      const now = new Date();
      const monthsAgo = (now - lastUpdated) / (1000 * 60 * 60 * 24 * 30.5);
      
      if (monthsAgo <= 1) {
        lastUpdatedClass = 'last-updated-recent';
        lastUpdatedText = 'Recent';
      } else if (monthsAgo <= 6) {
        lastUpdatedClass = 'last-updated-medium';
        const months = Math.round(monthsAgo);
        lastUpdatedText = `${months} ${months === 1 ? 'month' : 'months'} ago`;
      } else {
        lastUpdatedClass = 'last-updated-old';
        const months = Math.round(monthsAgo);
        if (months < 12) {
          lastUpdatedText = `${months} months ago`;
        } else {
          const years = Math.round(monthsAgo / 12);
          lastUpdatedText = `${years} ${years === 1 ? 'year' : 'years'} ago`;
        }
      }
    }

    // Prepare security info
    let securityHtml = `<span class="security ${dep.security?.highestSeverity || 'none'}">${dep.security?.highestSeverity || 'none'}</span>`;
    
    if (hasVulnerabilities) {
      const vulnCount = dep.security.vulnerabilities.length;
      securityHtml = `<span class="security ${dep.security?.highestSeverity || 'none'}">${dep.security?.highestSeverity || 'none'} (${vulnCount})</span>`;
    }

    html += `
      <tr>
        <td><span class="package-name">${dep.name}</span>${dep.isDev || dep.isDevDependency ? '<span class="package-dev">[dev]</span>' : ''}</td>
        <td class="version">${dep.currentVersion}</td>
        <td class="version">${dep.latestVersion}</td>
        <td>${updateStatusHtml}</td>
        <td class="${lastUpdatedClass}">${lastUpdatedText}</td>
        <td class="drift-${dep.driftLevel || 'none'}">${dep.driftLevel || 'none'}</td>
        <td>${securityHtml}</td>
      </tr>
    `;
  });

  html += `
    </tbody>
  </table>

  <div class="explanation">
    <h3>Understanding the Table:</h3>
    <ul>
      <li><strong>Package</strong>: Dependency name and type</li>
      <li><strong>Current</strong>: The version you currently have installed</li>
      <li><strong>Latest</strong>: The latest version available</li>
      <li><strong>Update Status</strong>: Whether you need to update the package
        <ul>
          <li><em>Up to date</em>: You have the latest version (even if that version is old)</li>
          <li><em>Needs update</em>: A newer version is available</li>
        </ul>
      </li>
      <li><strong>Last Updated</strong>: When the latest version was published
        <ul>
          <li>A package can be <em>Up to date</em> but still show <em>Last Updated: 1 year ago</em></li>
          <li>This means you have the latest version, but that version itself is old</li>
        </ul>
      </li>
      <li><strong>Drift</strong>: The version drift level calculated from version difference and time since update</li>
      <li><strong>Security</strong>: Whether the package has security vulnerabilities</li>
    </ul>
  </div>
  `;

  // Add vulnerability details if any
  if (results.securitySummary && results.securitySummary.vulnerable > 0) {
    html += `
    <div class="vulnerabilities">
      <h2>Security Vulnerabilities</h2>
    `;

    dependencies.forEach(dep => {
      if (dep.security && dep.security.vulnerable) {
        html += `<h3>${dep.name}@${dep.currentVersion}</h3>`;
        
        dep.security.vulnerabilities.forEach((vuln, index) => {
          html += `
          <div class="vuln-item">
            <div class="vuln-title">${vuln.title} (${vuln.severity})</div>
            <p><strong>ID:</strong> ${vuln.id}</p>
            <p><strong>URL:</strong> <a href="${vuln.url || '#'}" target="_blank">${vuln.url || 'N/A'}</a></p>
            <p><strong>Patched in:</strong> ${vuln.patchedIn}</p>
            <p><strong>Recommendation:</strong> ${vuln.recommendation}</p>
          </div>
          `;
        });
      }
    });

    html += `</div>`;
  }

  html += `
  </body>
  </html>
  `;

  return html;
}

/**
 * Save HTML report to file
 * @param {Object} results - Analysis results
 * @param {string} filePath - Path to save the HTML report
 * @returns {Promise<void>}
 */
async function saveHtmlReport(results, filePath) {
  const fs = require('fs-extra');
  const html = generateHtmlReport(results);
  await fs.writeFile(filePath, html, 'utf8');
}

// Export functions
module.exports = {
  generateHtmlReport,
  saveHtmlReport
}; 