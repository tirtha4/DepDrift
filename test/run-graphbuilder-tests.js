#!/usr/bin/env node

/**
 * Test runner script for GraphBuilder tests
 * 
 * This script runs all GraphBuilder tests in sequence, with proper reporting.
 * Usage: 
 *   node test/run-graphbuilder-tests.js [--unit|--integration|--performance|--all]
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test groups
const TEST_GROUPS = {
  unit: [
    'test/unit/graphBuilder/basic.test.js',
    'test/unit/graphBuilder/cache.test.js',
    'test/unit/graphBuilder/fallback.test.js',
    'test/unit/graphBuilder/edge.test.js'
  ],
  integration: [
    'test/integration/graphBuilder.integration.test.js'
  ],
  performance: [
    'test/unit/graphBuilder/performance.test.js'
  ]
};

// Parse command line arguments
const args = process.argv.slice(2);
let testTypes = [];

if (args.includes('--unit') || args.includes('-u')) {
  testTypes.push('unit');
}
if (args.includes('--integration') || args.includes('-i')) {
  testTypes.push('integration');
}
if (args.includes('--performance') || args.includes('-p')) {
  testTypes.push('performance');
}
if (args.includes('--all') || args.includes('-a') || testTypes.length === 0) {
  testTypes = ['unit', 'integration', 'performance'];
}

// Determine if verbose mode is enabled
const verbose = args.includes('--verbose') || args.includes('-v');

// Determine if coverage should be reported
const coverage = args.includes('--coverage') || args.includes('-c');

// Settings
const JEST_OPTIONS = [
  '--colors',
  verbose ? '--verbose' : '',
  coverage ? '--coverage' : '',
].filter(Boolean).join(' ');

// Validate test file paths
const allTests = [];
for (const type of testTypes) {
  const files = TEST_GROUPS[type];
  for (const file of files) {
    if (fs.existsSync(file)) {
      allTests.push(file);
    } else {
      console.warn(`Warning: Test file not found: ${file}`);
    }
  }
}

if (allTests.length === 0) {
  console.error('No test files found to run!');
  process.exit(1);
}

// Print test plan
console.log('\n🧪 GraphBuilder Test Suite Runner');
console.log('================================');
console.log(`Running ${allTests.length} test files`);
console.log(`Test types: ${testTypes.join(', ')}`);
console.log(`Options: ${JEST_OPTIONS || 'none'}`);
console.log('--------------------------------');

// Run tests
let exitCode = 0;
let results = {
  success: 0,
  failed: 0, 
  skipped: 0
};

for (const testFile of allTests) {
  const relativePath = path.relative(process.cwd(), testFile);
  console.log(`\n🔶 Running test: ${relativePath}`);
  
  try {
    const command = `NODE_OPTIONS=--experimental-vm-modules npx jest ${testFile} ${JEST_OPTIONS}`;
    execSync(command, { stdio: 'inherit' });
    results.success++;
    console.log(`✅ Passed: ${relativePath}`);
  } catch (error) {
    results.failed++;
    console.error(`❌ Failed: ${relativePath}`);
    exitCode = 1;
  }
}

// Print summary
console.log('\n--------------------------------');
console.log('📊 Test Summary:');
console.log(`  Total files: ${allTests.length}`);
console.log(`  Successful: ${results.success}`);
console.log(`  Failed: ${results.failed}`);
if (results.skipped > 0) {
  console.log(`  Skipped: ${results.skipped}`);
}
console.log('--------------------------------\n');

// Exit with appropriate code
process.exit(exitCode); 