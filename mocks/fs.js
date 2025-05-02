/**
 * Manual mock for Node's fs module
 */

// Storage for mock data
const mockData = {
  files: new Map(),
  directories: new Set(),
  timestamps: new Map(),
  writtenFiles: new Map()
};

// Mock implementation of fs
const fs = {
  // Reset all mock data to defaults
  __resetMockData() {
    mockData.files.clear();
    mockData.directories.clear();
    mockData.timestamps.clear();
    mockData.writtenFiles.clear();
    
    // Add defaults
    this.addMockFile('/path/to/test-project/package.json', JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'dependency-1': '^1.0.0'
      }
    }));
    
    this.addMockDirectory('/path/to/test-project');
    this.addMockDirectory('/path/to/test-project/node_modules');
  },
  
  // Helper to add a mock file with content
  addMockFile(filePath, content, timestamp = Date.now() - 1000) {
    mockData.files.set(filePath, content);
    mockData.timestamps.set(filePath, timestamp);
    return this;
  },
  
  // Helper to add a mock directory
  addMockDirectory(dirPath, timestamp = Date.now() - 1000) {
    mockData.directories.add(dirPath);
    mockData.timestamps.set(dirPath, timestamp);
    return this;
  },
  
  // Helper to simulate a missing file/directory
  removeMockPath(path) {
    mockData.files.delete(path);
    mockData.directories.delete(path);
    mockData.timestamps.delete(path);
    return this;
  },
  
  // Mock fs.existsSync
  existsSync: jest.fn(function(path) {
    return mockData.files.has(path) || mockData.directories.has(path);
  }),
  
  // Mock fs.readFileSync
  readFileSync: jest.fn(function(path, options) {
    if (mockData.files.has(path)) {
      return mockData.files.get(path);
    }
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  }),
  
  // Mock fs.writeFileSync
  writeFileSync: jest.fn(function(path, data, options) {
    mockData.writtenFiles.set(path, data);
    return undefined;
  }),
  
  // Mock fs.statSync
  statSync: jest.fn(function(path) {
    const isDir = mockData.directories.has(path);
    const isFile = mockData.files.has(path);
    
    if (!isDir && !isFile) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    
    const timestamp = mockData.timestamps.get(path) || Date.now();
    
    return {
      isDirectory: () => isDir,
      isFile: () => isFile,
      mtime: {
        getTime: () => timestamp
      }
    };
  }),
  
  // Mock fs.readdirSync
  readdirSync: jest.fn(function(path) {
    if (!mockData.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, readdir '${path}'`);
    }
    
    // Get files that are directly under this directory
    const regex = new RegExp(`^${path}/[^/]+$`);
    const results = new Set();
    
    // Check all files
    for (const filePath of mockData.files.keys()) {
      if (regex.test(filePath)) {
        const parts = filePath.split('/');
        results.add(parts[parts.length - 1]);
      }
    }
    
    // Check all directories
    for (const dirPath of mockData.directories) {
      if (regex.test(dirPath)) {
        const parts = dirPath.split('/');
        results.add(parts[parts.length - 1]);
      }
    }
    
    return Array.from(results);
  })
};

// Reset to defaults on load
fs.__resetMockData();

module.exports = fs; 