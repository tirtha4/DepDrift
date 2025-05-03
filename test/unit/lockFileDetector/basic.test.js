/**
 * Basic tests for the lockFileDetector module
 * 
 * These tests verify the core functionality of the lockFileDetector module
 * including detection of different lock files and determining the primary
 * package manager based on the detected lock files.
 */

import { jest, describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Import dependencies
import fs from 'fs';
import path from 'path';

// Import the module under test
import { detectLockFiles, getPrimaryPackageManager } from '../../../src/core/lockFileDetector.js';

describe('LockFileDetector Module - Basic Functionality', () => {
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
  
  test('should detect no lock files when none exist', () => {
    // Set up mock to return false for all lock files
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    // Call the function under test
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify no lock files are detected
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
  
  test('should detect npm lock file when only package-lock.json exists', () => {
    // Set up mock to return true only for package-lock.json
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === PACKAGE_LOCK_PATH;
    });
    
    // Call the function under test
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify only npm lock file is detected
    expect(result.npm).toBe(true);
    expect(result.yarn).toBe(false);
    expect(result.pnpm).toBe(false);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should detect yarn lock file when only yarn.lock exists', () => {
    // Set up mock to return true only for yarn.lock
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === YARN_LOCK_PATH;
    });
    
    // Call the function under test
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify only yarn lock file is detected
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(true);
    expect(result.pnpm).toBe(false);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should detect pnpm lock file when only pnpm-lock.yaml exists', () => {
    // Set up mock to return true only for pnpm-lock.yaml
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === PNPM_LOCK_PATH;
    });
    
    // Call the function under test
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify only pnpm lock file is detected
    expect(result.npm).toBe(false);
    expect(result.yarn).toBe(false);
    expect(result.pnpm).toBe(true);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should detect all lock files when all exist', () => {
    // Set up mock to return true for all lock files
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    
    // Call the function under test
    const result = detectLockFiles(TEST_PROJECT_ROOT);
    
    // Verify all lock files are detected
    expect(result.npm).toBe(true);
    expect(result.yarn).toBe(true);
    expect(result.pnpm).toBe(true);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should return npm as primary package manager when package-lock.json exists', () => {
    // Set up mock to return true only for package-lock.json
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === PACKAGE_LOCK_PATH;
    });
    
    // Call the function under test
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify npm is returned as primary package manager
    expect(result).toBe('npm');
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should return yarn as primary package manager when only yarn.lock exists', () => {
    // Set up mock to return true only for yarn.lock
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === YARN_LOCK_PATH;
    });
    
    // Call the function under test
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify yarn is returned as primary package manager
    expect(result).toBe('yarn');
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should return pnpm as primary package manager when only pnpm-lock.yaml exists', () => {
    // Set up mock to return true only for pnpm-lock.yaml
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === PNPM_LOCK_PATH;
    });
    
    // Call the function under test
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify pnpm is returned as primary package manager
    expect(result).toBe('pnpm');
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should prioritize npm when multiple lock files exist', () => {
    // Set up mock to return true for all lock files
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    
    // Call the function under test
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify npm is prioritized
    expect(result).toBe('npm');
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should prioritize yarn over pnpm when both exist', () => {
    // Set up mock to return true for yarn.lock and pnpm-lock.yaml
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(filepath => {
      return filepath === YARN_LOCK_PATH || filepath === PNPM_LOCK_PATH;
    });
    
    // Call the function under test
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify yarn is prioritized over pnpm
    expect(result).toBe('yarn');
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
  
  test('should return null when no lock files exist', () => {
    // Set up mock to return false for all lock files
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    // Call the function under test
    const result = getPrimaryPackageManager(TEST_PROJECT_ROOT);
    
    // Verify null is returned when no lock files exist
    expect(result).toBe(null);
    
    // Manually restore the spy
    existsSyncSpy.mockRestore();
    fs.existsSync = originalExistsSync;
  });
}); 