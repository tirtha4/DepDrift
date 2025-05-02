#!/usr/bin/env node

/**
 * DepDrift Help Command
 * 
 * This script displays the detailed help for the DepDrift CLI.
 */

import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version from package.json
function getVersion() {
  try {
    const packageJsonPath = resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch (err) {
    return '0.1.0'; // Fallback version
  }
}

// Display detailed help
function showDetailedHelp() {
  const version = getVersion();
  const logo = `
${chalk.blue('  ____             ____       _  __ _   ')}
${chalk.blue(' |  _ \\  ___ _ __ |  _ \\ _ __(_)/ _| |_ ')}
${chalk.cyan(' | | | |/ _ \\ \'_ \\| | | | \'__| | |_| __|')}
${chalk.cyan(' | |_| |  __/ |_) | |_| | |  | |  _| |_ ')}
${chalk.green(' |____/ \\___| .__/|____/|_|  |_|_|  \\__|')}
${chalk.green('            |_|                         ')}
${chalk.yellow('           >>> Keep Your Dependencies In Check <<<')}
`;

  const helpText = `${logo}

${chalk.bold.cyan('DepDrift - Dependency Drift Analysis Tool')}
${chalk.cyan('Version:')} ${chalk.white(version)}
${chalk.cyan('Author:')} ${chalk.white('Tirtha Sarker')}

${chalk.bold.white('DESCRIPTION')}
  DepDrift analyzes your package.json dependencies to identify drift from latest versions
  and security vulnerabilities, helping you maintain up-to-date and secure dependencies.

${chalk.bold.white('COMMANDS')}
  ${chalk.cyan('depdrift')}                      Display version
  ${chalk.cyan('depdrift analyze')}              Analyze dependencies (default command)
  ${chalk.cyan('depdrift help')}                 Display this help information

${chalk.bold.white('ANALYZE OPTIONS')}
  ${chalk.cyan('-p, --path')} <path>             Path to package.json file
                              Default: current directory

  ${chalk.cyan('-f, --format')} <format>         Output format
                              Options: table, text, json
                              Default: table

  ${chalk.cyan('-a, --show-all')} <boolean>      Show all dependencies, not just outdated ones
                              Default: true

  ${chalk.cyan('-s, --sort-by')} <field>         Sort dependencies by field
                              Options: name, driftLevel, daysBehind, security
                              Default: driftLevel

  ${chalk.cyan('-d, --sort-direction')} <dir>    Sort direction
                              Options: asc, desc
                              Default: desc

  ${chalk.cyan('--no-security')} <boolean>       Skip security vulnerability checks
                              Default: false

${chalk.bold.white('OUTPUT FORMATS')}
  ${chalk.cyan('table')}                         Detailed tabular output with color highlighting
                              Shows dependencies, versions, drift level, and security info

  ${chalk.cyan('text')}                          Simple text output showing dependencies
                              Good for logs or further processing

  ${chalk.cyan('json')}                          Structured JSON output
                              Best for integration with other tools or automation

${chalk.bold.white('DRIFT LEVELS')}
  ${chalk.green('none')}                         Package is up to date
  ${chalk.blue('low')}                          Minor drift, typically patch versions or recent updates
  ${chalk.yellow('medium')}                       Moderate drift, typically minor versions
  ${chalk.red('high')}                          Significant drift, typically major versions
  ${chalk.bgRed.white('critical')}                     Severe drift, multiple major versions or very old

${chalk.bold.white('EXAMPLES')}
  # Basic analysis of current directory
  ${chalk.cyan('depdrift analyze')}

  # Analyze a specific package.json file
  ${chalk.cyan('depdrift analyze --path /path/to/package.json')}

  # Show only outdated dependencies
  ${chalk.cyan('depdrift analyze --show-all false')}

  # Sort by security vulnerabilities
  ${chalk.cyan('depdrift analyze --sort-by security')}

  # Sort alphabetically by package name
  ${chalk.cyan('depdrift analyze --sort-by name --sort-direction asc')}

  # Output in JSON format
  ${chalk.cyan('depdrift analyze --format json')}

${chalk.bold.white('INTERPRETING RESULTS')}
  * ${chalk.bold('Drift Level')}: Indicates how far behind a package is from its latest version
    considering both semantic version differences and time since latest release

  * ${chalk.bold('Update Status')}: Shows whether you need to update a package
    - ${chalk.green('Up to date')}: You have the latest version, even if that version is old
    - ${chalk.yellow('Needs update')}: A newer version is available

  * ${chalk.bold('Last Published')}: When the latest version was published
    - A package can be ${chalk.green('Up to date')} but still show ${chalk.yellow('Last Published: 1 year ago')}
    - This means you have the latest version, but that version itself is old

  * ${chalk.bold('Security')}: Whether the package has known security vulnerabilities
    - ${chalk.green('none')}: No known vulnerabilities
    - ${chalk.red('HIGH')}, ${chalk.yellow('MEDIUM')}, etc.: Security severity with count

${chalk.bold.white('ADDITIONAL INFORMATION')}
  For more information, visit the project repository:
  https://github.com/tirtha4/DepDrift

  ${chalk.bold('Author:')} Tirtha Sarker
`;

  console.log(helpText);
}

// Display the help
showDetailedHelp(); 