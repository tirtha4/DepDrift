/**
 * Simple test that imports a module to verify ESM imports work
 */

import { describe, it, expect, jest } from '@jest/globals';
import path from 'path';

describe('Module imports', () => {
  it('should handle importing a node module', () => {
    const result = path.join('a', 'b', 'c');
    expect(result).toBe('a/b/c');
  });
  
  it('should allow spying on module functions', () => {
    const spy = jest.spyOn(path, 'join');
    
    path.join('x', 'y', 'z');
    
    expect(spy).toHaveBeenCalledWith('x', 'y', 'z');
    
    spy.mockRestore();
  });
}); 