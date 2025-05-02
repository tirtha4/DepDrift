/**
 * Mock for Node's fs module (ESM version)
 */

// Storage for mock data
const mockData = {
  files: new Map(),
  directories: new Set(),
  timestamps: new Map(),
  writtenFiles: new Map()
};

// Mock implementations
const existsSync = jest.fn(path => 
  mockData.files.has(path) || mockData.directories.has(path)
);

const readFileSync = jest.fn((path, options) => {
  if (mockData.files.has(path)) {
    return mockData.files.get(path);
  }
  throw new Error(`ENOENT: no such file or directory, open '${path}'`);
});

const writeFileSync = jest.fn((path, data, options) => {
  mockData.writtenFiles.set(path, data);
  return undefined;
});

const statSync = jest.fn(path => {
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
});

const readdirSync = jest.fn(path => {
  if (!mockData.directories.has(path)) {
    throw new Error(`ENOENT: no such file or directory, readdir '${path}'`);
  }
  
  const regex = new RegExp(`^${path}/[^/]+$`);
  const results = new Set();
  
  // Check files
  for (const filePath of mockData.files.keys()) {
    if (regex.test(filePath)) {
      const parts = filePath.split('/');
      results.add(parts[parts.length - 1]);
    }
  }
  
  // Check directories
  for (const dirPath of mockData.directories) {
    if (regex.test(dirPath)) {
      const parts = dirPath.split('/');
      results.add(parts[parts.length - 1]);
    }
  }
  
  return Array.from(results);
});

// Helper functions
const addMockFile = (filePath, content, timestamp = Date.now() - 1000) => {
  mockData.files.set(filePath, content);
  mockData.timestamps.set(filePath, timestamp);
};

const addMockDirectory = (dirPath, timestamp = Date.now() - 1000) => {
  mockData.directories.add(dirPath);
  mockData.timestamps.set(dirPath, timestamp);
};

const removeMockPath = (path) => {
  mockData.files.delete(path);
  mockData.directories.delete(path);
  mockData.timestamps.delete(path);
};

const __resetAllMocks = () => {
  mockData.files.clear();
  mockData.directories.clear();
  mockData.timestamps.clear();
  mockData.writtenFiles.clear();
  
  // Add default test data
  addMockFile('/path/to/test-project/package.json', JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      'dependency-1': '^1.0.0'
    }
  }));
  
  addMockDirectory('/path/to/test-project');
  addMockDirectory('/path/to/test-project/node_modules');
  
  // Reset all function mocks
  existsSync.mockClear();
  readFileSync.mockClear();
  writeFileSync.mockClear();
  statSync.mockClear();
  readdirSync.mockClear();
};

// Initialize default mock data
__resetAllMocks();

// Export all the mock functions
export {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
  addMockFile,
  addMockDirectory,
  removeMockPath,
  __resetAllMocks
};

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
  addMockFile,
  addMockDirectory,
  removeMockPath,
  __resetAllMocks
}; 