#!/usr/bin/env node

/**
 * Coverage threshold validation script
 * Checks if coverage meets minimum requirements defined in package.json
 */

const fs = require('fs');
const path = require('path');

// Default thresholds if not specified in package.json
const DEFAULT_THRESHOLDS = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80
};

function main() {
  try {
    console.log('🔍 Reading coverage data...');
    
    // Read package.json for threshold configuration
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Get thresholds from package.json or use defaults
    const thresholds = packageData.coverageThresholds || packageData.jest?.coverageThreshold?.global || DEFAULT_THRESHOLDS;
    
    // Read coverage summary
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    if (!fs.existsSync(coveragePath)) {
      console.error('❌ Coverage summary not found at:', coveragePath);
      console.log('💡 Make sure to run tests with coverage first: npm run test:coverage');
      process.exit(1);
    }
    
    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const totalCoverage = coverageData.total;
    
    console.log('\n📊 Coverage Report:');
    console.log('─'.repeat(50));
    
    // Check each metric
    let allPassed = true;
    const metrics = ['statements', 'branches', 'functions', 'lines'];
    
    metrics.forEach(metric => {
      const actual = totalCoverage[metric].pct;
      const threshold = thresholds[metric] || DEFAULT_THRESHOLDS[metric];
      const passed = actual >= threshold;
      
      const status = passed ? '✅' : '❌';
      const actualStr = `${actual.toFixed(1)}%`;
      const thresholdStr = `${threshold}%`;
      
      console.log(`${status} ${metric.padEnd(12)}: ${actualStr.padStart(6)} (min: ${thresholdStr})`);
      
      if (!passed) {
        allPassed = false;
      }
    });
    
    console.log('─'.repeat(50));
    
    if (allPassed) {
      console.log('✅ All coverage thresholds met!');
      process.exit(0);
    } else {
      console.log('❌ Coverage thresholds not met');
      console.log('\n💡 To improve coverage:');
      console.log('   - Add more unit tests');
      console.log('   - Test edge cases and error paths');
      console.log('   - Remove unused code');
      console.log('\n📈 View detailed coverage: open coverage/lcov-report/index.html');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error checking coverage:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };