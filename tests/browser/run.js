#!/usr/bin/env node

/**
 * Browser Test Runner
 *
 * Usage:
 *   node run.js <scenario>
 *   node run.js chat          # Run chat test
 *   node run.js --list        # List available scenarios
 *
 * Options:
 *   HEADLESS=false    Show browser window
 *   SLOW_MO=100       Slow down actions (ms)
 *   FRONTEND_URL=...  Override frontend URL
 */

const fs = require('fs');
const path = require('path');

const SCENARIOS_DIR = path.join(__dirname, 'scenarios');

// Available scenarios
const SCENARIOS = {
  'chat': {
    file: 'chat-test.js',
    description: 'Test the AI chat feature with various queries',
    run: 'runChatTest'
  },
  'streaming': {
    file: 'streaming-test.js',
    description: 'Test Phase 2 SSE streaming and tool visualization',
    run: 'runStreamingTest'
  }
  // Add more scenarios here as needed:
  // 'cases': { file: 'cases-test.js', description: 'Test case management' },
};

function printHelp() {
  console.log(`
Browser Test Runner
===================

Usage:
  node run.js <scenario>    Run a specific test scenario
  node run.js --list        List available scenarios
  node run.js --help        Show this help

Available Scenarios:
`);

  for (const [name, info] of Object.entries(SCENARIOS)) {
    console.log(`  ${name.padEnd(15)} ${info.description}`);
  }

  console.log(`
Environment Variables:
  HEADLESS=false       Show browser window (default: true)
  SLOW_MO=100          Slow down actions by N ms (default: 0)
  FRONTEND_URL=...     Override frontend URL (default: http://localhost:3000)
  AUTH_USERNAME=...    Login username (default: admin)
  AUTH_PASSWORD=...    Login password (default: devpassword123)

Examples:
  node run.js chat                    # Run chat test headless
  HEADLESS=false node run.js chat     # Run chat test with visible browser
  SLOW_MO=50 node run.js chat         # Run with slowed-down actions
`);
}

function listScenarios() {
  console.log('\nAvailable Test Scenarios:\n');
  for (const [name, info] of Object.entries(SCENARIOS)) {
    console.log(`  ${name}`);
    console.log(`    ${info.description}`);
    console.log(`    File: scenarios/${info.file}\n`);
  }
}

async function runScenario(name) {
  const scenario = SCENARIOS[name];

  if (!scenario) {
    console.error(`Unknown scenario: ${name}`);
    console.log('\nUse --list to see available scenarios');
    process.exit(1);
  }

  const scenarioPath = path.join(SCENARIOS_DIR, scenario.file);

  if (!fs.existsSync(scenarioPath)) {
    console.error(`Scenario file not found: ${scenarioPath}`);
    process.exit(1);
  }

  console.log(`Running scenario: ${name}`);
  console.log(`File: ${scenario.file}`);
  console.log('');

  const scenarioModule = require(scenarioPath);
  const runFn = scenarioModule[scenario.run] || scenarioModule.runChatTest;
  return await runFn();
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  listScenarios();
  process.exit(0);
}

const scenarioName = args[0];

runScenario(scenarioName)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
