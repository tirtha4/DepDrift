/**
 * Workspace detection and handling for monorepos
 * @module core/workspace
 * @description Provides utilities for detecting and working with monorepo workspace configurations
 * including npm workspaces, pnpm workspaces, and Lerna projects.
 */
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

/**
 * Detect workspace configuration in the project
 * @param {string} projectPath - Path to the project root directory
 * @returns {Promise<Object>} Workspace configuration object
 * @property {boolean} isWorkspace - Whether the project is a workspace
 * @property {string} [type] - Workspace type ('npm', 'pnpm', or 'lerna') if isWorkspace is true
 * @property {Array<string>} [patterns] - Glob patterns for workspace packages if isWorkspace is true
 * @property {string} [error] - Error message if detection failed
 * @throws {Error} If filesystem operations fail
 * @public
 */
async function detectWorkspace (projectPath) {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (!await fs.pathExists(packageJsonPath)) {
    return { isWorkspace: false };
  }

  try {
    const packageJson = await fs.readJson(packageJsonPath);

    // Check for npm workspaces
    if (packageJson.workspaces) {
      return {
        isWorkspace: true,
        type: 'npm',
        patterns: Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces.packages || []
      };
    }

    // Check for pnpm workspace
    const pnpmWorkspacePath = path.join(projectPath, 'pnpm-workspace.yaml');
    if (await fs.pathExists(pnpmWorkspacePath)) {
      const content = await fs.readFile(pnpmWorkspacePath, 'utf8');
      const packages = content
        .split('\n')
        .filter(line => line.trim().startsWith('- '))
        .map(line => line.replace(/^-\s+/, '').trim());

      return {
        isWorkspace: true,
        type: 'pnpm',
        patterns: packages
      };
    }

    // Check for yarn workspace
    const lernaCfgPath = path.join(projectPath, 'lerna.json');
    if (await fs.pathExists(lernaCfgPath)) {
      const lernaCfg = await fs.readJson(lernaCfgPath);
      return {
        isWorkspace: true,
        type: 'lerna',
        patterns: lernaCfg.packages || ['packages/*']
      };
    }

    return { isWorkspace: false };
  } catch (error) {
    console.error(`Error detecting workspace: ${error.message}`);
    return { isWorkspace: false, error: error.message };
  }
}

/**
 * Find all package.json files in workspace
 * @param {string} rootPath - Root path of the workspace
 * @param {string[]} patterns - Glob patterns for workspace packages
 * @returns {Promise<string[]>} Array of absolute paths to package.json files
 * @throws {Error} If filesystem operations fail
 * @public
 * @example
 * // Find all package.json files in a workspace
 * const packagePaths = await findWorkspacePackages('/path/to/project', ['packages/*']);
 */
async function findWorkspacePackages (rootPath, patterns) {
  const packagePaths = [];

  // Process each pattern
  for (const pattern of patterns) {
    // Find directories matching the pattern
    const matches = glob.sync(pattern, {
      cwd: rootPath,
      absolute: true
    });

    // For each matched directory, check if package.json exists
    for (const match of matches) {
      const stats = await fs.stat(match);

      if (stats.isDirectory()) {
        const packageJsonPath = path.join(match, 'package.json');

        if (await fs.pathExists(packageJsonPath)) {
          packagePaths.push(packageJsonPath);
        }
      }
    }
  }

  // Add root package.json as well
  const rootPackagePath = path.join(rootPath, 'package.json');
  if (await fs.pathExists(rootPackagePath) && !packagePaths.includes(rootPackagePath)) {
    packagePaths.push(rootPackagePath);
  }

  return packagePaths;
}

/**
 * Load package info from all workspace packages
 * @param {string} rootPath - Root path of the workspace
 * @param {Object} workspace - Workspace configuration from detectWorkspace()
 * @param {boolean} workspace.isWorkspace - Whether the project is a workspace
 * @param {Array<string>} [workspace.patterns] - Glob patterns for workspace packages
 * @returns {Promise<Array<Object>>} Array of package info objects
 * @property {string} path - Absolute path to the package.json file
 * @property {Object} packageJson - Parsed package.json content
 * @property {string} [relativePath] - Path relative to workspace root
 * @throws {Error} If filesystem operations fail
 * @public
 */
async function loadWorkspacePackages (rootPath, workspace) {
  if (!workspace.isWorkspace) {
    // If not a workspace, just return the root package
    const rootPackagePath = path.join(rootPath, 'package.json');
    if (await fs.pathExists(rootPackagePath)) {
      try {
        const packageJson = await fs.readJson(rootPackagePath);
        return [{ path: rootPackagePath, packageJson }];
      } catch (error) {
        console.error(`Error reading package.json: ${error.message}`);
        return [];
      }
    }
    return [];
  }

  // Find all package.json files in the workspace
  const packagePaths = await findWorkspacePackages(rootPath, workspace.patterns);

  // Load each package.json
  const packages = [];

  for (const packagePath of packagePaths) {
    try {
      const packageJson = await fs.readJson(packagePath);
      packages.push({
        path: packagePath,
        packageJson,
        relativePath: path.relative(rootPath, path.dirname(packagePath))
      });
    } catch (error) {
      console.error(`Error reading ${packagePath}: ${error.message}`);
    }
  }

  return packages;
}

/**
 * Get internal dependencies (dependencies that are other workspace packages)
 * @param {Array<Object>} packages - Array of workspace packages from loadWorkspacePackages()
 * @param {Object} packages[].packageJson - Parsed package.json for a workspace package
 * @param {string} [packages[].relativePath] - Path relative to workspace root
 * @returns {Object} Map of package names to their workspace paths
 * @public
 * @example
 * // Get a map of internal dependencies
 * const packages = await loadWorkspacePackages('/path/to/project', workspace);
 * const internalDeps = getInternalDependencies(packages);
 * // Result: { '@org/pkg1': 'packages/pkg1', '@org/pkg2': 'packages/pkg2' }
 */
function getInternalDependencies (packages) {
  const internalDeps = {};

  // First, collect all package names with their paths
  packages.forEach(pkg => {
    if (pkg.packageJson.name) {
      internalDeps[pkg.packageJson.name] = pkg.relativePath || '.';
    }
  });

  return internalDeps;
}

module.exports = {
  detectWorkspace,
  findWorkspacePackages,
  loadWorkspacePackages,
  getInternalDependencies
};
