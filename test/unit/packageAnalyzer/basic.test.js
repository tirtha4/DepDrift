/**
 * Basic tests for the packageAnalyzer module
 * Tests core functionality of version parsing, dependency analysis and drift level calculation
 */

import { jest } from '@jest/globals';
import semver from 'semver';

// Import package analyzer functions
import * as packageAnalyzerModule from '../../../src/analyzers/packageAnalyzer.js';

// Extract the specific functions we want to test
const {
  parseVersionRange,
  isPreRelease,
  satisfiesRange,
  calculateDriftLevel,
} = packageAnalyzerModule;

// Variables for test lifecycle
let originalConsoleWarn;
let originalConsoleError;
let originalConsoleLog;

describe('PackageAnalyzer Module - Basic Tests', () => {
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
  
  describe('parseVersionRange', () => {
    it('should extract version from simple range', () => {
      const result = parseVersionRange('^1.0.0');
      expect(result).toBe('1.0.0');
    });
    
    it('should handle exact versions', () => {
      const result = parseVersionRange('1.0.0');
      expect(result).toBe('1.0.0');
    });
    
    it('should handle ranges with ~', () => {
      const result = parseVersionRange('~1.0.0');
      expect(result).toBe('1.0.0');
    });
    
    it('should use semver.maxSatisfying when versions are provided', () => {
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];
      const result = parseVersionRange('^1.0.0', versions);
      expect(result).toBe('1.2.0'); // The highest version that satisfies ^1.0.0
    });
    
    it('should handle complex ranges', () => {
      // Based on actual implementation, complex ranges are returned as-is if no versions provided
      const result = parseVersionRange('>=1.0.0 <2.0.0');
      expect(result).toBe('>=1.0.0 <2.0.0');
    });
  });
  
  describe('isPreRelease', () => {
    it('should identify prerelease versions', () => {
      expect(isPreRelease('1.0.0-beta')).toBe(true);
      expect(isPreRelease('1.0.0-alpha.1')).toBe(true);
      expect(isPreRelease('1.0.0-rc.2')).toBe(true);
    });
    
    it('should identify regular versions', () => {
      expect(isPreRelease('1.0.0')).toBe(false);
      expect(isPreRelease('2.1.3')).toBe(false);
    });
    
    it('should handle invalid version strings', () => {
      expect(isPreRelease('not-a-version')).toBe(false);
      expect(isPreRelease('')).toBe(false);
    });
  });
  
  describe('satisfiesRange', () => {
    it('should check if a version satisfies a range', () => {
      expect(satisfiesRange('1.2.0', '^1.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
    });
    
    it('should handle exact version matches', () => {
      expect(satisfiesRange('1.0.0', '1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.1', '1.0.0')).toBe(false);
    });
    
    it('should handle version with v prefix', () => {
      expect(satisfiesRange('v1.2.0', '^1.0.0')).toBe(true);
    });
  });
  
  describe('calculateDriftLevel', () => {
    it('should calculate drift level based on version difference', () => {
      expect(calculateDriftLevel('1.0.0', '1.0.1', 10)).toBe('low');
      expect(calculateDriftLevel('1.0.0', '1.1.0', 30)).toBe('medium');
      expect(calculateDriftLevel('1.0.0', '2.0.0', 90)).toBe('high');
      expect(calculateDriftLevel('1.0.0', '2.0.0', 365)).toBe('critical');
    });
    
    it('should return "none" for same versions', () => {
      expect(calculateDriftLevel('1.0.0', '1.0.0', 0)).toBe('none');
    });
    
    it('should handle non-semver version strings', () => {
      // Based on actual implementation, non-semver versions are handled as 'low' drift
      expect(calculateDriftLevel('latest', '1.0.0', 10)).toBe('low');
      expect(calculateDriftLevel('1.0.0', 'latest', 10)).toBe('low');
    });
  });
}); 