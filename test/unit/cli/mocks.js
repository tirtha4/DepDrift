import { jest } from '@jest/globals';

/**
 * Mock analysis results for testing CLI output
 */
export const mockAnalysisResults = {
  projectName: 'test-project',
  projectPath: '/path/to/test-project',
  dependencies: [
    {
      name: 'test-dep-1',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      daysBehind: 100,
      driftLevel: 'medium',
      isDevDependency: false
    },
    {
      name: 'test-dep-2',
      currentVersion: '1.0.0',
      latestVersion: '3.0.0',
      daysBehind: 365,
      driftLevel: 'critical',
      isDevDependency: false
    },
    {
      name: 'dev-dep-1',
      currentVersion: '1.5.0',
      latestVersion: '1.5.2',
      daysBehind: 30,
      driftLevel: 'low',
      isDevDependency: true
    },
    {
      name: 'up-to-date-dep',
      currentVersion: '2.0.0',
      latestVersion: '2.0.0',
      daysBehind: 0,
      driftLevel: 'none',
      isDevDependency: false
    }
  ],
  summary: {
    totalDependencies: 4,
    driftLevels: {
      none: 1,
      low: 1,
      medium: 1,
      high: 0,
      critical: 1
    },
    averageDaysBehind: 123.75,
    majorVersionsBehind: 2,
    minorVersionsBehind: 1,
    patchVersionsBehind: 1
  },
  vulnerabilities: [
    {
      name: 'test-dep-2',
      severity: 'high',
      details: 'Known security vulnerability CVE-2023-12345',
      version: '1.0.0',
      fixedIn: '1.0.1'
    }
  ],
  recommendations: [
    {
      name: 'test-dep-2',
      currentVersion: '1.0.0',
      recommendedVersion: '3.0.0',
      priority: 'high',
      reason: 'Critical drift and security vulnerability'
    },
    {
      name: 'test-dep-1',
      currentVersion: '1.0.0',
      recommendedVersion: '2.0.0',
      priority: 'medium',
      reason: 'Medium drift level'
    }
  ]
};

/**
 * Mock file system implementation
 */
export const mockFs = {
  existsSync: jest.fn().mockImplementation(path => {
    if (path.includes('package.json')) {
      return true;
    }
    return false;
  }),
  readFileSync: jest.fn().mockImplementation(path => {
    if (path.includes('package.json')) {
      return JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'test-dep-1': '^1.0.0',
          'test-dep-2': '^1.0.0',
          'up-to-date-dep': '^2.0.0'
        },
        devDependencies: {
          'dev-dep-1': '^1.5.0'
        }
      });
    }
    throw new Error(`File not found: ${path}`);
  }),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  statSync: jest.fn().mockImplementation(path => ({
    isDirectory: () => !path.includes('.')
  }))
};

/**
 * Mock assessor module implementation
 */
export const mockAssessor = {
  assessDependencies: jest.fn().mockResolvedValue(mockAnalysisResults),
  generateRecommendations: jest.fn().mockResolvedValue(mockAnalysisResults.recommendations)
};

/**
 * Mock formatters implementation
 */
export const mockFormatters = {
  formatAnalysisText: jest.fn().mockReturnValue('Formatted text output'),
  formatAnalysisJson: jest.fn().mockReturnValue(JSON.stringify(mockAnalysisResults, null, 2)),
  formatAnalysisCSV: jest.fn().mockReturnValue('name,currentVersion,latestVersion\ntest-dep-1,1.0.0,2.0.0'),
  formatAnalysisAsTables: jest.fn().mockReturnValue('Formatted table output'),
  generateTable: jest.fn().mockReturnValue({
    toString: () => 'Table string representation'
  }),
  generateHtmlReport: jest.fn().mockReturnValue('<html>Formatted HTML report</html>'),
  displayRecommendations: jest.fn(),
  displayVulnerabilities: jest.fn()
};

/**
 * Mock console methods
 */
export const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

/**
 * Mock process
 */
export const mockProcess = {
  exit: jest.fn(),
  stdout: {
    isTTY: true,
    columns: 80,
    write: jest.fn()
  },
  stderr: {
    write: jest.fn()
  }
};

/**
 * Setup console mocks
 */
export function setupConsoleMocks() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  
  console.log = mockConsole.log;
  console.error = mockConsole.error;
  console.warn = mockConsole.warn;
  console.info = mockConsole.info;
  
  return function restoreConsoleMocks() {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
  };
}

/**
 * Reset all mocks
 */
export function resetAllMocks() {
  jest.clearAllMocks();
  
  // Reset mock functions
  Object.values(mockFs).forEach(mockFn => {
    if (typeof mockFn.mockClear === 'function') {
      mockFn.mockClear();
    }
  });
  
  Object.values(mockAssessor).forEach(mockFn => {
    if (typeof mockFn.mockClear === 'function') {
      mockFn.mockClear();
    }
  });
  
  Object.values(mockFormatters).forEach(mockFn => {
    if (typeof mockFn.mockClear === 'function') {
      mockFn.mockClear();
    }
  });
  
  Object.values(mockConsole).forEach(mockFn => {
    if (typeof mockFn.mockClear === 'function') {
      mockFn.mockClear();
    }
  });
} 