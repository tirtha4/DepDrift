/**
 * Mock for lockFileDetector module
 */

// Default lock file detection result
let lockFileDetectionResult = {
  exists: false,
  type: null
};

// Mock function
const detectLockFile = jest.fn(() => lockFileDetectionResult);

// Helper to reset mock
function __resetMock() {
  lockFileDetectionResult = {
    exists: false,
    type: null
  };
}

// Helper to set lock file detection result
function __setLockFileDetection(result) {
  lockFileDetectionResult = { ...result };
}

// Export mock functions
module.exports = {
  detectLockFile,
  __resetMock,
  __setLockFileDetection
}; 