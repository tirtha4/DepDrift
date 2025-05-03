#!/usr/bin/env node

import { reportDrift } from '../../src/reporter.js';

// Sample drift records for testing
const testRecords = [
  {
    package: 'chalk',
    expected: '4.0.0',
    installed: '4.1.2',
    status: 'minor'
  },
  {
    package: 'axios',
    expected: '1.0.0',
    installed: '0.27.2',
    status: 'major'
  },
  {
    package: 'lodash',
    expected: '4.17.21',
    installed: '4.17.21',
    status: 'safe'
  },
  {
    package: 'react',
    expected: '18.2.0',
    installed: null,
    status: 'missing'
  },
  {
    package: 'typescript',
    expected: '4.8.0',
    installed: '5.2.2',
    status: 'extra'
  }
];

// Test the console reporter
async function testReporter() {
  try {
    console.log('Testing console report:');
    await reportDrift(testRecords);
    
    console.log('\nTesting JSON report:');
    await reportDrift(testRecords, {
      json: true,
      jsonFile: '../fixtures/test-report.json'
    });
    
    console.log('\nTesting empty records:');
    await reportDrift([]);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
testReporter(); 