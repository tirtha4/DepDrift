/**
 * Smoke tests for CLI functionality
 * 
 * These tests verify the basic functionality of the CLI module
 * without mocking all the dependencies.
 */

import * as cli from '../../../src/cli.js';

describe('CLI Module - Smoke Tests', () => {
  // Test utility functions first (pure functions with no dependencies)
  describe('parseExcludeTypes', () => {
    it('should parse exclude flags correctly', () => {
      const result = cli.parseExcludeTypes('dev,peer');
      
      expect(result).toEqual({
        excludeDev: true,
        excludePeer: true,
        excludeOptional: false
      });
    });
    
    it('should handle empty exclude string', () => {
      const result = cli.parseExcludeTypes('');
      
      expect(result).toEqual({
        excludeDev: false,
        excludePeer: false,
        excludeOptional: false
      });
    });
    
    it('should handle all exclude types', () => {
      const result = cli.parseExcludeTypes('dev,peer,optional');
      
      expect(result).toEqual({
        excludeDev: true,
        excludePeer: true,
        excludeOptional: true
      });
    });
  });

  describe('parseSecuritySources', () => {
    it('should parse security sources correctly', () => {
      const result = cli.parseSecuritySources('npm_audit,ossindex');
      
      expect(result).toContain('NPM_AUDIT');
      expect(result).toContain('OSSINDEX');
      expect(result.length).toBe(2);
    });
    
    it('should handle empty sources string', () => {
      const result = cli.parseSecuritySources('');
      
      expect(result).toEqual([]);
    });
  });

  describe('formatDriftLevel', () => {
    it('should format drift levels appropriately', () => {
      const criticalResult = cli.formatDriftLevel('critical');
      const lowResult = cli.formatDriftLevel('low');
      const noneResult = cli.formatDriftLevel('none');
      const unknownResult = cli.formatDriftLevel('unknown');
      const nullResult = cli.formatDriftLevel(null);
      const undefinedResult = cli.formatDriftLevel(undefined);
      const numberResult = cli.formatDriftLevel(123);
      
      // Just check that we get a string output without errors
      expect(typeof criticalResult).toBe('string');
      expect(typeof lowResult).toBe('string');
      expect(typeof noneResult).toBe('string');
      expect(typeof unknownResult).toBe('string');
      expect(typeof nullResult).toBe('string');
      expect(typeof undefinedResult).toBe('string');
      expect(typeof numberResult).toBe('string');
    });
  });

  describe('formatTimeAgo', () => {
    it('should format days correctly', () => {
      expect(cli.formatTimeAgo(0)).toContain('Today');
      expect(cli.formatTimeAgo(1)).toContain('1 day ago');
      expect(cli.formatTimeAgo(2)).toContain('2 days ago');
      expect(cli.formatTimeAgo(30)).toContain('30 days ago');
      expect(cli.formatTimeAgo(90)).toContain('90 days ago');
      
      // Just check that year formatting works
      const yearResult = cli.formatTimeAgo(370);
      expect(yearResult).toContain('year');
    });
    
    it('should handle edge cases', () => {
      expect(cli.formatTimeAgo(-1)).toContain('Today');
      expect(cli.formatTimeAgo(null)).toContain('NaN');
      expect(cli.formatTimeAgo(undefined)).toContain('NaN');
      expect(cli.formatTimeAgo('not a number')).toContain('NaN');
      expect(cli.formatTimeAgo('30')).toContain('30 days ago');
    });
  });
}); 