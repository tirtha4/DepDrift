/**
 * Manual mock for @npmcli/arborist
 */

// Default config
let mockConfig = {
  shouldSucceed: true,
  errorMessage: 'Unknown error in Arborist',
  idealTree: null,
  actualTree: null
};

// Mock Edge object
class Edge {
  constructor(name, type, spec, from, to) {
    this.name = name;
    this.type = type || 'dependencies';
    this.spec = spec || '^1.0.0';
    this.from = from;
    this.to = to;
  }
}

// Mock Node object
class Node {
  constructor(options = {}) {
    this.name = options.name || 'test-project';
    this.version = options.version || '1.0.0';
    this.path = options.path || '/path/to/test-project';
    this.edgesOut = options.edgesOut || {};
    
    // Add other properties as needed for tests
    if (options.dependencies) {
      Object.entries(options.dependencies).forEach(([name, version]) => {
        if (!this.edgesOut) this.edgesOut = {};
        this.edgesOut[name] = new Edge(name, 'dependencies', version, this);
      });
    }
    
    if (options.devDependencies) {
      Object.entries(options.devDependencies).forEach(([name, version]) => {
        if (!this.edgesOut) this.edgesOut = {};
        this.edgesOut[name] = new Edge(name, 'devDependencies', version, this);
      });
    }
  }
}

// Mock Arborist class
class Arborist {
  constructor(options = {}) {
    this.options = options;
    this.path = options.path || '/path/to/test-project';
  }
  
  async loadVirtual() {
    if (!mockConfig.shouldSucceed) {
      throw new Error(mockConfig.errorMessage);
    }
    
    // Create default ideal tree if not specified
    if (!mockConfig.idealTree) {
      mockConfig.idealTree = new Node({
        name: 'test-project',
        path: this.path,
        edgesOut: {
          'dependency-1': new Edge('dependency-1', 'dependencies', '^1.0.0'),
          'dev-dep': new Edge('dev-dep', 'devDependencies', '^2.0.0')
        }
      });
    }
    
    return mockConfig.idealTree;
  }
  
  async loadActual() {
    if (!mockConfig.shouldSucceed) {
      throw new Error(mockConfig.errorMessage);
    }
    
    // Create default actual tree if not specified
    if (!mockConfig.actualTree) {
      mockConfig.actualTree = new Node({
        name: 'test-project',
        path: this.path,
        edgesOut: {
          'dependency-1': new Edge('dependency-1', 'dependencies', '^1.0.0', null, 
            new Node({ name: 'dependency-1', version: '1.0.0' })),
          'dev-dep': new Edge('dev-dep', 'devDependencies', '^2.0.0', null,
            new Node({ name: 'dev-dep', version: '2.0.0' }))
        }
      });
    }
    
    return mockConfig.actualTree;
  }
}

// Helper to reset config
function __resetConfig() {
  mockConfig = {
    shouldSucceed: true,
    errorMessage: 'Unknown error in Arborist',
    idealTree: null,
    actualTree: null
  };
}

// Helper to set config
function __setConfig(config) {
  mockConfig = { ...mockConfig, ...config };
}

// Helper to get current config (for testing the mock)
function __getConfig() {
  return mockConfig;
}

// Add the helper methods to the mock
Arborist.__resetConfig = __resetConfig;
Arborist.__setConfig = __setConfig;
Arborist.__getConfig = __getConfig;

// Reset config on load
__resetConfig();

// Export the mock
module.exports = {
  Arborist
}; 