/**
 * Manual mock for the lockFileDetector module
 */

const mockLockFileDetector = {
  detectLockFile: jest.fn().mockReturnValue({
    exists: false,
    type: null
  }),
  
  // Helper to configure the mock
  __setLockFileDetection(options = {}) {
    const {
      exists = false,
      type = null
    } = options;
    
    this.detectLockFile.mockReturnValue({ exists, type });
    return this;
  },
  
  // Reset to default behavior
  __resetMock() {
    this.detectLockFile.mockReset();
    this.detectLockFile.mockReturnValue({
      exists: false,
      type: null
    });
    return this;
  }
};

// Support both ESM and CommonJS
module.exports = mockLockFileDetector;
export default mockLockFileDetector; 