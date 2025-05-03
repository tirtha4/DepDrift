/**
 * Edge case tests for the lockFileDetector module
 * 
 * These tests verify the lockFileDetector module's behavior in unusual
 * or edge case scenarios such as file system errors, unusual paths, etc.
 */

import { jest, describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Import dependencies
import fs from 'fs';
import path from 'path';

// Import the module under test
import { detectLockFiles, getPrimaryPackageManager } from '../../../src/core/lockFileDetector.js';

describe('LockFileDetector Module - Edge Cases', () => {
  // Set up common test paths
  const TEST_PROJECT_ROOT = '/path/to/test-project';
  const PACKAGE_LOCK_PATH = path.join(TEST_PROJECT_ROOT, 'package-lock.json');
  const YARN_LOCK_PATH = path.join(TEST_PROJECT_ROOT, 'yarn.lock');
  const PNPM_LOCK_PATH = path.join(TEST_PROJECT_ROOT, 'pnpm-lock.yaml');
  
  // Store original implementations
  let originalExistsSync;
  
  // Set up before tests
  beforeAll(() => {
    // Store original function references
    originalExistsSync = fs.existsSync;
  });
  
  // Reset mocks before each test
  beforeEach(() => {
    // Restore original function before each test to ensure clean state
    fs.existsSync = originalExistsSync;
    
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  // Restore originals after each test
  afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();
    
    // Explicitly restore fs.existsSync to original
    fs.existsSync = originalExistsSync;
  });
  
  // Restore all original functions after all tests
  afterAll(() => {
    // Ensure fs functions are restored to original implementations
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle fs errors gracefully for package-lock.json', () => {
    // Set up mock to throw an error for package-lock.json
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      if (filepath === PACKAGE_LOCK_PATH) {
        throw new Error('EACCES: permission denied');
      }
      return false;
    });
    
    // Function should not throw but handle the error
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify the result indicates no npm lock file
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(false);
    expect(result.pnpm).toBe(false);
    
    // Verify fs.existsSync was called for each lock file
    expect(existsSyncSpy).toHaveBeenCalledWith(PACKAGE_LOCK_PATH);
    expect(existsSyncSpy).toHaveBeenCalledWith(YARN_LOCK_PATH);
    expect(existsSyncSpy).toHaveBeenCalledWith(PNPM_LOCK_PATH);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle fs errors gracefully for yarn.lock', () => {
    // Set up mock to throw an error for yarn.lock
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      if (filepath === YARN_LOCK_PATH) {
        throw new Error('EACCES: permission denied');
      }
      return false;
    });
    
    // Function should not throw but handle the error
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify the result indicates no yarn lock file
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(false);
    expect(result.pnpm).toBe(false);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle fs errors gracefully for pnpm-lock.yaml', () => {
    // Set up mock to throw an error for pnpm-lock.yaml
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      if (filepath === PNPM_LOCK_PATH) {
        throw new Error('EACCES: permission denied');
      }
      return false;
    });
    
    // Function should not throw but handle the error
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify the result indicates no pnpm lock file
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(false);
    expect(result.pnpm).toBe(false);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle fs errors in getPrimaryPackageManager gracefully', () => {
    // Set up mock to throw errors for all lock files
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    
    // Function should not throw but handle the error
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify null is returned when errors occur
    expect(result).toBe(null);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle empty project root path', () => {
    // Call with empty string
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    const result = detectLockFiles('');
    
    // Verify the function still processes the paths
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(false);
    expect(result.pnpm).toBe(false);
    
    // Verify fs.existsSync was called for each lock file with empty path
    expect(existsSyncSpy).toHaveBeenCalledWith(path.join('', 'package-lock.json'));
    expect(existsSyncSpy).toHaveBeenCalledWith(path.join('', 'yarn.lock'));
    expect(existsSyncSpy).toHaveBeenCalledWith(path.join('', 'pnpm-lock.yaml'));
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle null project root path', () => {
    // Calling with null should not throw but may have unexpected behavior
    // This test checks if the function handles this gracefully
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    try {
      const result = detectLockFiles(null);
      
      // If it doesn't throw, verify the structure of the result
      expect(result).toHaveProperty('npm');
      expect(result).toHaveProperty('yarn');
      expect(result).toHaveProperty('pnpm');
    } catch (error) {
      // If it throws, fail the test
      fail('detectLockFiles should handle null project root gracefully');
    }
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle undefined project root path', () => {
    // Calling with undefined should not throw but may have unexpected behavior
    // This test checks if the function handles this gracefully
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    try {
      const result = detectLockFiles(undefined);
      
      // If it doesn't throw, verify the structure of the result
      expect(result).toHaveProperty('npm');
      expect(result).toHaveProperty('yarn');
      expect(result).toHaveProperty('pnpm');
    } catch (error) {
      // If it throws, fail the test
      fail('detectLockFiles should handle undefined project root gracefully');
    }
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle partial filesystem access issues', () => {
    // Set up mock to throw an error for only package-lock.json
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      if (filepath === PACKAGE_LOCK_PATH) {
        throw new Error('EACCES: permission denied');
      }
      return filepath === YARN_LOCK_PATH; // only yarn.lock exists
    });
    
    // Function should not throw and still detect yarn.lock
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify the result indicates yarn lock file but no npm or pnpm
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(true);
    expect(result.pnpm).toBe(false);
    
    // Verify getPrimaryPackageManager still works with partial errors
    const primaryPM = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    expect(primaryPM).toBe('yarn');
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should handle path with unusual characters', () => {
    const unusualPath = '/path/with spaces/and#special@chars/';
    const packageLockPath = path.join(unusualPath, 'package-lock.json');
    const yarnLockPath = path.join(unusualPath, 'yarn.lock');
    const pnpmLockPath = path.join(unusualPath, 'pnpm-lock.yaml');
    
    // Set up mock to have yarn.lock in the unusual path
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === yarnLockPath;
    });
    
    // Function should handle the path normally
    const result = detectLockFiles(unusualPath);
    
    // Verify the result indicates yarn lock file
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(true);
    expect(result.pnpm).toBe(false);
    
    // Verify fs.existsSync was called for each lock file with the unusual path
    expect(existsSyncSpy).toHaveBeenCalledWith(packageLockPath);
    expect(existsSyncSpy).toHaveBeenCalledWith(yarnLockPath);
    expect(existsSyncSpy).toHaveBeenCalledWith(pnpmLockPath);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
}); 