/**
 * Test demonstrating mocking with jest.spyOn()
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';

describe('Using spyOn for mocking', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  it('should allow spying on path.join', () => {
    const spy = jest.spyOn(path, 'join');
    // Original implementation still works
    const result = path.join('a', 'b', 'c');
    
    expect(result).toBe('a/b/c');
    expect(spy).toHaveBeenCalledWith('a', 'b', 'c');
    
    spy.mockRestore();
  });
  
  it('should allow overriding implementation', () => {
    const spy = jest.spyOn(path, 'join').mockImplementation((...args) => {
      return args.join('-');
    });
    
    const result = path.join('x', 'y', 'z');
    
    expect(result).toBe('x-y-z');
    expect(spy).toHaveBeenCalledWith('x', 'y', 'z');
    
    spy.mockRestore();
  });
}); 