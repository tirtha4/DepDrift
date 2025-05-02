# DepDrift

> **Most developers don't update dependencies until something breaks.
That's when you lose days firefighting builds, bugs, or CVEs.**

**DepDrift tells you what's getting risky—before it hurts you.**

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Author](https://img.shields.io/badge/author-Tirtha%20Sarker-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## What is Dependency Drift?

Dependency drift occurs when your project's dependencies fall behind the latest available versions. This can lead to:

- Missing security patches
- Missing bug fixes
- Missing new features
- Increased technical debt
- Harder upgrades in the future

DepDrift helps you analyze and understand the current state of your project's dependencies and how far they have drifted from the latest versions.

![DepDrift Sample Output](https://github.com/user-attachments/assets/0a0fbce6-5fc5-461d-a1a7-c5ba1119d7cd)


## Key Features

- **Enhanced Version Comparison**: Accurately handles complex semver ranges, pre-releases, and build metadata
- **Security Vulnerability Scanning**: Check dependencies against multiple security databases
- **Combined Drift & Security Analysis**: Get a comprehensive view of your dependency health
- **Detailed Update Status**: Clear distinction between "up-to-date" and "last updated"
- **Intelligent Recommendations**: Prioritized recommendations for updating dependencies
- **Multiple Output Formats**: View results as tables, JSON, or text
- **Comprehensive Output**: Table or JSON output with detailed drift information

## How DepDrift Compares

| Feature | npm audit | npm outdated | Renovate | DepDrift |
|---------|-----------|-------------|----------|----------|
| Version drift detection | ❌ | ✅ | ✅ | ✅ |
| Time-based staleness | ❌ | ❌ | ❌ | ✅ |
| Security integration | ✅ | ❌ | Limited | ✅ (multi-source) |
| Monorepo/workspace aware | ❌ | Limited | ✅ | ✅ |
| Drift scoring | ❌ | ❌ | ❌ | ✅ |
| Update recommendations | ❌ | ❌ | ✅ | ✅ |
| Customizable reporting | ❌ | ❌ | Limited | ✅ |

## Installation

### Global installation

```bash
npm install -g depdrift
```

### Local installation

```bash
npm install --save-dev depdrift
```

### Requirements

- **Node.js**: v12.20.0 or higher (v14+ recommended for optimal performance)
- **npm**: v6.0.0 or higher

## Usage

### Basic usage

Run in your project directory:

```bash
depdrift analyze
```

### Command Line Options

```
Usage: depdrift [command] [options]

Commands:
  depdrift          Show version information
  depdrift analyze  Analyze dependency drift
  depdrift help     Display detailed help information

Options:
  -p, --path <path>             Path to package.json file
                                Default: current directory

  -f, --format <format>         Output format
                                Options: table, text, json
                                Default: table

  -a, --show-all <boolean>      Show all dependencies, not just outdated ones
                                Default: true

  -s, --sort-by <field>         Sort dependencies by field
                                Options: name, driftLevel, daysBehind, security
                                Default: driftLevel

  -d, --sort-direction <dir>    Sort direction
                                Options: asc, desc
                                Default: desc

  --no-security <boolean>       Skip security vulnerability checks
                                Default: false
                                
  --security-sources <sources>  Security sources to check
                                Options: NPM_AUDIT,SNYK,GITHUB,OSSI
                                Default: NPM_AUDIT
```

## Output Formats

### Table Format (Default)

The table format provides a comprehensive view of your dependencies with color-coded drift levels:

```
┌───────────────┬──────────┬──────────┬───────────────┬──────────────┬─────────────┬─────────┐
│ Package       │ Current  │ Latest   │ Update Status │ Last Published │ Days Behind │ Drift   │
├───────────────┼──────────┼──────────┼───────────────┼──────────────┼─────────────┼─────────┤
│ axios         │ 0.21.1   │ 1.6.7    │ Outdated      │ 30 days ago  │ 30          │ CRITICAL│
│ chalk         │ 4.1.2    │ 5.3.0    │ Outdated      │ 180 days ago │ 180         │ HIGH    │
│ express       │ 4.17.1   │ 4.18.2   │ Outdated      │ 90 days ago  │ 90          │ MEDIUM  │
│ lodash        │ 4.17.21  │ 4.17.21  │ Up to date    │ 365 days ago │ 0           │ NONE    │
└───────────────┴──────────┴──────────┴───────────────┴──────────────┴─────────────┴─────────┘

Security findings: 2 vulnerabilities detected
  • HIGH: axios (1)
  • MEDIUM: express (1)

Recommendations:
 1. Update axios (CRITICAL drift): Major version update needed
 2. Update express (MEDIUM drift): Minor version update + security fix
```

What to look for:
- **CRITICAL/HIGH drift**: These need immediate attention
- **Security findings**: Any non-zero count warrants investigation
- **Days Behind**: Higher numbers indicate maintenance risk

### JSON Format

For integration with CI/CD pipelines or other tools:

```bash
depdrift analyze --format json
```

Example output:
```json
{
  "projectName": "my-project",
  "projectVersion": "1.0.0",
  "dependencies": [
    {
      "name": "axios",
      "currentVersion": "0.21.1",
      "latestVersion": "1.6.7",
      "driftLevel": "critical",
      "daysBehind": 30,
      "updateStatus": "outdated",
      "security": {
        "vulnerable": true,
        "highestSeverity": "high",
        "vulnerabilities": [
          {
            "id": "CVE-2023-45857",
            "severity": "high",
            "title": "Server-Side Request Forgery",
            "patchedIn": "1.5.0"
          }
        ]
      }
    }
    // ... more dependencies
  ],
  "summary": {
    "total": 15,
    "outdated": 8,
    "vulnerable": 2,
    "criticalDrift": 1,
    "highDrift": 2,
    "mediumDrift": 3,
    "lowDrift": 2
  },
  "recommendations": [
    {
      "dependencyName": "axios",
      "currentVersion": "0.21.1",
      "recommendedVersion": "1.6.7",
      "reason": "security vulnerability + critical drift",
      "priority": "high"
    }
    // ... more recommendations
  ]
}
```

## Security Source Configuration

DepDrift supports multiple security data sources to check for vulnerabilities:

1. **NPM Audit** (Default): Uses the built-in npm audit command
   - No setup required
   - Works out of the box

2. **Snyk**: Checks the Snyk vulnerability database
   - Requires a Snyk API key
   - Set environment variable: `SNYK_API_KEY=your-api-key`

3. **GitHub Security Advisories**: Checks GitHub Advisory Database
   - Requires a GitHub personal access token
   - Set environment variable: `GITHUB_TOKEN=your-github-token`

4. **OSSI** (Open Source Security Index): Checks the OSSI database
   - No setup required
   - Free public API

### Configuring Multiple Sources

Specify which security sources to use with the `--security-sources` option:

```bash
# Use npm audit (default)
depdrift analyze

# Use Snyk (requires SNYK_API_KEY environment variable)
depdrift analyze --security-sources SNYK

# Use multiple sources
depdrift analyze --security-sources NPM_AUDIT,GITHUB,OSSI
```

### Environment Variable Setup

```bash
# For Snyk integration
export SNYK_API_KEY=your-snyk-api-key

# For GitHub integration
export GITHUB_TOKEN=your-github-personal-access-token
```

## Implementation Details

### ES Modules Support

DepDrift is implemented using ES Modules, which means:

- It supports modern JavaScript features
- It's compatible with Node.js versions that support ES Modules (Node.js 12+)
- It can be imported using `import` statements in your code

If you want to use DepDrift programmatically in your code:

```javascript
// ES Modules (recommended)
import { assessDependencies } from 'depdrift';

// CommonJS (using dynamic import)
const depdrift = await import('depdrift');
const { assessDependencies } = depdrift;
```

## Drift Levels

DepDrift categorizes dependencies into different drift levels based on how outdated they are:

| Drift Level | Description | When Applied |
|-------------|-------------|-------------|
| **none** | Package is up to date | Using latest version |
| **low** | Minor drift | Patch updates or <14 days behind |
| **medium** | Moderate drift | Minor versions or 14-30 days behind |
| **high** | Significant drift | Major version or 30-180 days behind |
| **critical** | Severe drift | Multiple major versions or 180+ days behind |

## Examples

```bash
# Basic analysis of current directory
depdrift analyze

# Analyze a specific package.json file
depdrift analyze --path /path/to/package.json

# Show only outdated dependencies
depdrift analyze --show-all false

# Sort by security vulnerabilities
depdrift analyze --sort-by security

# Sort alphabetically by package name
depdrift analyze --sort-by name --sort-direction asc

# Output in JSON format
depdrift analyze --format json

# Use multiple security sources
depdrift analyze --security-sources NPM_AUDIT,GITHUB
```

## Real-world Use Cases

### 1. Pre-Sprint Dependency Health Check
Run DepDrift before planning sprints to identify technical debt that should be addressed:
```bash
depdrift analyze --sort-by driftLevel > drift-report.txt
```

### 2. CI/CD Integration
Add dependency checks to your CI pipeline to catch outdated or vulnerable dependencies:
```bash
if depdrift analyze --format json | jq -e '.summary.vulnerable > 0'; then
  echo "Security vulnerabilities found!"
  exit 1
fi
```

### 3. Security Audit Preparation
Generate comprehensive security reports with multiple data sources:
```bash
depdrift analyze --security-sources NPM_AUDIT,GITHUB,SNYK --format json > security-audit.json
```

## Interpreting Results

- **Drift Level**: Indicates how far behind a package is from its latest version
  considering both semantic version differences and time since latest release

- **Update Status**: Shows whether you need to update a package
  - Up to date: You have the latest version, even if that version is old
  - Needs update: A newer version is available

- **Last Published**: When the latest version was published
  - A package can be "Up to date" but still show "Last Published: 1 year ago"
  - This means you have the latest version, but that version itself is old

- **Security**: Whether the package has known security vulnerabilities
  - none: No known vulnerabilities
  - HIGH, MEDIUM, etc.: Security severity with count

## License

MIT

## Repository

For more information, visit the project repository:
[https://github.com/tirtha4/DepDrift](https://github.com/tirtha4/DepDrift)
