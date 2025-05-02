/**
 * Manual mock for @npmcli/arborist
 */

// Default tree structure
const defaultTree = {
  name: 'test-project',
  version: '1.0.0',
  edgesOut: {
    'dependency-1': {
      name: 'dependency-1',
      spec: '^1.0.0',
      type: 'dependencies',
      to: {
        name: 'dependency-1',
        version: '1.0.0',
        edgesOut: {}
      }
    }
  }
};

// Configuration options
const config = {
  shouldSucceed: true,
  errorMessage: 'Arborist failure',
  idealTree: { ...defaultTree },
  actualTree: { ...defaultTree }
};

// The Arborist class
class Arborist {
  constructor(options = {}) {
    this.options = options;
    this.path = options.path || '/test-project';
  }

  async loadVirtual() {
    if (!config.shouldSucceed) {
      throw new Error(config.errorMessage);
    }
    return config.idealTree;
  }

  async loadActual() {
    if (!config.shouldSucceed) {
      throw new Error(config.errorMessage);
    }
    return config.actualTree;
  }
}

// Mock configuration API
const arboristMock = {
  Arborist,
  
  // Configuration API
  __setConfig(options = {}) {
    Object.assign(config, options);
    return this;
  },
  
  // Reset to defaults
  __resetConfig() {
    config.shouldSucceed = true;
    config.errorMessage = 'Arborist failure';
    config.idealTree = { ...defaultTree };
    config.actualTree = { ...defaultTree };
    return this;
  }
};

// Reset to defaults on load
arboristMock.__resetConfig();

// Support both ESM and CommonJS
module.exports = arboristMock;
export default arboristMock; 