/**
 * Mock for the lockFileDetector module
 */

import { jest } from '@jest/globals';

// Default result
const defaultResult = {
  exists: false,
  type: null
};

// Create mock function
const detectLockFile = jest.fn(() => ({ ...defaultResult }));

// Helper to set detection result
function __setLockFileDetection(result) {
  detectLockFile.mockImplementation(() => ({ ...defaultResult, ...result }));
}

// Helper to reset mock
function __resetMock() {
  detectLockFile.mockClear();
  detectLockFile.mockImplementation(() => ({ ...defaultResult }));
}

// Initialize
__resetMock();

export { detectLockFile, __setLockFileDetection, __resetMock };
export default { detectLockFile, __setLockFileDetection, __resetMock }; 