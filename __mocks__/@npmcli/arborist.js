/**
 * Mock for @npmcli/arborist module (ESM version)
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
let config = {
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
const __setConfig = (options = {}) => {
  Object.assign(config, options);
};

// Reset to defaults
const __resetConfig = () => {
  config = {
    shouldSucceed: true,
    errorMessage: 'Arborist failure',
    idealTree: { ...defaultTree },
    actualTree: { ...defaultTree }
  };
};

// Reset to defaults on load
__resetConfig();

// Export the mock
export { Arborist, __setConfig, __resetConfig };

// Default export
export default {
  Arborist,
  __setConfig,
  __resetConfig
}; 