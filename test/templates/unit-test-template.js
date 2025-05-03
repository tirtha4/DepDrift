/**
 * Unit Test Template for ESM Modules
 * Copy this template when creating new unit tests and customize it for your module.
 */

// Import Jest test utilities
import { jest, describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// To mock modules for ESM, we recommend the following pattern:
// 1. Create mock implementations first
const mockDependency1Implementation = {
  method1: jest.fn().mockReturnValue('mocked-result'),
  method2: jest.fn().mockResolvedValue({ data: 'mock-data' })
};

const mockDependency2Implementation = {
  methodA: jest.fn(),
  methodB: jest.fn().mockImplementation((arg1, arg2) => arg1 + arg2)
};

// 2. Use jest.mock with virtual:true flag to mock ES modules
jest.mock('external-module-1', () => mockDependency1Implementation, { virtual: true });
jest.mock('external-module-2', () => mockDependency2Implementation, { virtual: true });

// 3. Import the module under test after mocks are setup
// For ESM, we need to use dynamic import to ensure mocks are ready
let functionToTest;

beforeAll(async () => {
  // Import the module after all mocks are configured
  const module = await import('../../src/path/to/module.js');
  functionToTest = module.functionToTest;
});

describe('Module Name Tests', () => {
  // 4. Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset any specific mock implementations
    mockDependency1Implementation.method1.mockClear();
    mockDependency1Implementation.method2.mockClear();
  });
  
  // 5. Optional: Clean up after all tests
  afterAll(() => {
    // Any cleanup code needed
  });
  
  // 6. Group tests logically
  describe('functionToTest', () => {
    test('should handle normal case', () => {
      // SETUP
      mockDependency1Implementation.method1.mockReturnValueOnce('specific-result');
      
      // EXECUTE
      const result = functionToTest('input');
      
      // VERIFY
      expect(result).toBe('expected-output');
      expect(mockDependency1Implementation.method1).toHaveBeenCalledWith('input');
      expect(mockDependency2Implementation.methodA).not.toHaveBeenCalled();
    });
    
    test('should handle error case', () => {
      // SETUP
      mockDependency1Implementation.method1.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      // EXECUTE & VERIFY
      expect(() => {
        functionToTest('input');
      }).toThrow('Test error');
    });
    
    test('should handle async operations', async () => {
      // SETUP
      mockDependency1Implementation.method2.mockResolvedValueOnce({ 
        data: 'custom-result' 
      });
      
      // EXECUTE
      const result = await functionToTest.asyncMethod('input');
      
      // VERIFY
      expect(result).toEqual(expect.objectContaining({
        data: 'custom-result'
      }));
      expect(mockDependency1Implementation.method2).toHaveBeenCalledWith('input');
    });
    
    test('should handle async errors', async () => {
      // SETUP
      mockDependency1Implementation.method2.mockRejectedValueOnce(
        new Error('Async test error')
      );
      
      // EXECUTE & VERIFY
      await expect(
        functionToTest.asyncMethod('input')
      ).rejects.toThrow('Async test error');
    });
  });
  
  // 7. Test other functions or aspects of the module
  describe('other function', () => {
    test('should work as expected', () => {
      // Test implementation
    });
  });
}); 