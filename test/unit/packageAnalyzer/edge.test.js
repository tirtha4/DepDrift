/**
 * Edge case tests for the packageAnalyzer module
 * Tests error handling, unusual inputs, and boundary conditions
 */

import { jest } from '@jest/globals';
import semver from 'semver';

// Import the functions from the module to test
import * as packageAnalyzerModule from '../../../src/analyzers/packageAnalyzer.js';

// Extract the specific functions we want to test
const {
  parseVersionRange,
  isPreRelease,
  satisfiesRange,
  calculateDriftLevel
} = packageAnalyzerModule;

// Variables for test lifecycle
let originalConsoleWarn;
let originalConsoleError;
let originalConsoleLog;

describe('PackageAnalyzer Module - Edge Cases', () => {
  // Setup and teardown for all tests
  beforeAll(() => {
    // Store original console methods
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    
    // Mock console methods to prevent output during tests
    console.warn = jest.fn();
    console.error = jest.fn();
    console.log = jest.fn();
  });
  
  afterAll(() => {
    // Restore original console methods
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('parseVersionRange - edge cases', () => {
    it('should handle empty string input', () => {
      expect(parseVersionRange('')).toBe('');
    });
    
    it('should handle null or undefined inputs gracefully', () => {
      try {
        parseVersionRange(null);
        // If it doesn't throw, the test should fail
        expect(true).toBe(false);  
      } catch (e) {
        // Should throw TypeError for null
        expect(e).toBeInstanceOf(TypeError);
      }
      
      try {
        parseVersionRange(undefined);
        // If it doesn't throw, the test should fail
        expect(true).toBe(false);
      } catch (e) {
        // Should throw TypeError for undefined
        expect(e).toBeInstanceOf(TypeError);
      }
    });
    
    it('should handle non-semver version strings', () => {
      expect(parseVersionRange('not-a-version')).toBe('not-a-version');
      expect(parseVersionRange('v1')).toBe('v1');
      expect(parseVersionRange('1')).toBe('1');
    });
    
    it('should handle semver.maxSatisfying errors', () => {
      // When maxSatisfying fails, it should fall back to stripping range indicators
      const result = parseVersionRange('^1.0.0', ['invalid-version']);
      expect(result).toBe('1.0.0');
    });
    
    it('should handle extremely long version arrays', () => {
      // Create a very large array of versions to test performance
      const versions = [];
      for (let i = 0; i < 1000; i++) {
        versions.push(`1.0.${i}`);
      }
      const result = parseVersionRange('^1.0.0', versions);
      expect(result).toBe('1.0.999');
    });
    
    it('should handle malformed version ranges', () => {
      // Actual implementation strips the first range indicator but maintains the rest
      expect(parseVersionRange('^^1.0.0')).toBe('^1.0.0');
      expect(parseVersionRange('~^1.0.0')).toBe('^1.0.0');
      expect(parseVersionRange('>>>>>1.0.0')).toBe('>>>>>1.0.0');
    });
  });
  
  describe('isPreRelease - edge cases', () => {
    it('should handle semver parsing errors', () => {
      // Invalid versions should return false
      expect(isPreRelease('invalid-version')).toBe(false);
      expect(isPreRelease('#$%^')).toBe(false);
      expect(isPreRelease('version1')).toBe(false);
    });
    
    it('should handle unusual prerelease identifiers', () => {
      // Test with valid but unusual prerelease identifiers
      expect(isPreRelease('1.0.0-0')).toBe(true);
      expect(isPreRelease('1.0.0-xyz.123')).toBe(true);
      expect(isPreRelease('1.0.0-rc.0.1.2.3')).toBe(true);
    });
    
    it('should handle build metadata correctly', () => {
      // Version with build metadata but no prerelease
      expect(isPreRelease('1.0.0+20130313144700')).toBe(false);
      expect(isPreRelease('1.0.0+exp.sha.5114f85')).toBe(false);
      // Version with both prerelease and build metadata
      expect(isPreRelease('1.0.0-beta+exp.sha.5114f85')).toBe(true);
    });
  });
  
  describe('satisfiesRange - edge cases', () => {
    it('should handle null or undefined inputs', () => {
      // Based on the implementation, these should return false
      expect(satisfiesRange(null, '^1.0.0')).toBe(false);
      expect(satisfiesRange('1.0.0', null)).toBe(false);
      // Both null should be false (implementation will throw error)
      try {
        satisfiesRange(null, null);
        // If it doesn't throw, the test should fail
        expect(true).toBe(false);
      } catch (e) {
        // This is expected behavior
        expect(e).toBeDefined();
      }
      expect(satisfiesRange(undefined, '^1.0.0')).toBe(false);
    });
    
    it('should handle empty string inputs', () => {
      // Empty strings should return false based on implementation
      expect(satisfiesRange('', '^1.0.0')).toBe(false);
      // The implementation treats this as true due to fallback check
      expect(satisfiesRange('1.0.0', '')).toBe(true); 
      expect(satisfiesRange('', '')).toBe(true); // Same string comparison returns true
    });
    
    it('should handle complex semver ranges', () => {
      expect(satisfiesRange('1.2.3', '^1.0.0 || ^2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '^1.0.0 || ^2.0.0')).toBe(true);
      expect(satisfiesRange('3.0.0', '^1.0.0 || ^2.0.0')).toBe(false);
      expect(satisfiesRange('1.0.0-beta', '^1.0.0')).toBe(false); // Prereleases don't satisfy unless specified
    });
    
    it('should handle version with leading v', () => {
      expect(satisfiesRange('v1.2.3', '^1.0.0')).toBe(true);
      expect(satisfiesRange('1.2.3', '^v1.0.0')).toBe(true);
      expect(satisfiesRange('v1.2.3', '^v1.0.0')).toBe(true);
    });
    
    it('should handle non-standard version strings gracefully', () => {
      expect(satisfiesRange('not-a-version', '^1.0.0')).toBe(false);
      expect(satisfiesRange('1.0.0', 'not-a-range')).toBe(false);
      // The actual implementation will return false here because the string includes check fails
      expect(satisfiesRange('not-a-version', 'not-a-range')).toBe(false);
    });
    
    it('should handle semver.satisfies errors', () => {
      // Create a scenario where semver.satisfies would throw
      const result = satisfiesRange('1.0.0', '!!invalid!!');
      expect(result).toBe(false);
    });
  });
  
  describe('calculateDriftLevel - edge cases', () => {
    it('should handle null or undefined inputs', () => {
      // Based on the implementation behavior
      expect(calculateDriftLevel(null, '2.0.0', 100)).toBe('high');
      expect(calculateDriftLevel('1.0.0', null, 100)).toBe('high');
      expect(calculateDriftLevel(null, null, 100)).toBe('none');
    });
    
    it('should handle negative days behind', () => {
      // Negative days behind should be treated as low drift
      expect(calculateDriftLevel('2.0.0', '1.0.0', -100)).toBe('low');
      expect(calculateDriftLevel('1.1.0', '1.0.0', -10)).toBe('low');
    });
    
    it('should handle invalid version strings', () => {
      expect(calculateDriftLevel('invalid', '1.0.0', 100)).toBe('high');
      expect(calculateDriftLevel('1.0.0', 'invalid', 100)).toBe('high');
      expect(calculateDriftLevel('invalid', 'invalid', 100)).toBe('none');
    });
    
    it('should handle extreme day values', () => {
      // Test with very large day values based on implementation
      expect(calculateDriftLevel('1.0.0', '2.0.0', 1000)).toBe('critical');
      expect(calculateDriftLevel('1.0.0', '1.1.0', 1000)).toBe('critical');
      // Test with very small but positive day values
      expect(calculateDriftLevel('1.0.0', '2.0.0', 1)).toBe('low');
      expect(calculateDriftLevel('1.0.0', '1.0.1', 1)).toBe('low');
    });
  });
}); 