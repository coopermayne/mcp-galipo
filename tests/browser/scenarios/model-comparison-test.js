/**
 * Model Comparison Test - Compare Sonnet vs Haiku response times
 *
 * Runs the same queries multiple times against each model and compares results.
 */

const { chromium } = require('playwright');

const CONFIG = {
  baseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  username: process.env.AUTH_USERNAME || 'asdf',
  password: process.env.AUTH_PASSWORD || 'asdf',
  headless: process.env.HEADLESS !== 'false'
};

// Same queries for both models
const QUERIES = [
  { message: 'Hello!', maxWait: 45000 },
  { message: 'How many cases are there?', maxWait: 90000 },
  { message: 'List all the tasks', maxWait: 90000 }
];

async function runSingleTest(page, testNum) {
  const results = [];
  console.log(`\n  --- Test Run ${testNum} ---`);

  // Clear any existing conversation
  const newChatBtn = await page.$('button:has-text("New chat")');
  if (newChatBtn) {
    await newChatBtn.click();
    await page.waitForTimeout(500);
  }

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    console.log(`    Query ${i + 1}: "${query.message}"`);

    // Get initial message count
    const initialMsgCount = await page.evaluate(() => {
      return document.querySelectorAll('[class*="rounded-2xl"][class*="px-"]').length;
    });

    // Type and send
    await page.fill('textarea[placeholder="Type a message..."]', query.message);
    const sendStart = Date.now();
    await page.press('textarea[placeholder="Type a message..."]', 'Enter');

    // Poll for completion
    let responseReceived = false;
    let elapsed = 0;
    const pollInterval = 500;

    while (!responseReceived && elapsed < query.maxWait) {
      await page.waitForTimeout(pollInterval);
      elapsed += pollInterval;

      const state = await page.evaluate(() => {
        const streamingCursor = document.querySelector('[class*="animate-pulse"]');
        const isStreaming = !!streamingCursor;
        const bouncingDots = document.querySelectorAll('[class*="animate-bounce"]');
        const isTypingIndicator = bouncingDots.length >= 3;
        const messageContainer = document.querySelector('[class*="overflow-y-auto"][class*="p-"]');
        const messageItems = messageContainer ? messageContainer.querySelectorAll(':scope > div[class*="flex"][class*="items-start"]') : [];
        const msgCount = messageItems.length;
        const allBubbles = document.querySelectorAll('[class*="rounded-2xl"]');
        let lastAssistantContent = '';
        for (const bubble of allBubbles) {
          const classes = bubble.className;
          if (classes.includes('rounded-tl-sm') && !classes.includes('bg-blue-600')) {
            lastAssistantContent = bubble.textContent || '';
          }
        }
        return {
          isStreaming,
          isTypingIndicator,
          msgCount,
          hasContent: lastAssistantContent.length > 10
        };
      });

      if (!state.isStreaming && !state.isTypingIndicator && state.msgCount > initialMsgCount && state.hasContent) {
        await page.waitForTimeout(300);
        const recheck = await page.evaluate(() => {
          const streamingCursor = document.querySelector('[class*="animate-pulse"][class*="bg-slate"]');
          const bouncingDots = document.querySelectorAll('[class*="animate-bounce"]');
          return !!streamingCursor || bouncingDots.length >= 3;
        });
        if (!recheck) {
          responseReceived = true;
        }
      }
    }

    const totalTime = Date.now() - sendStart;
    const status = responseReceived ? '✓' : '✗';
    console.log(`      ${status} ${(totalTime / 1000).toFixed(2)}s`);

    // Get response preview
    const preview = await page.evaluate(() => {
      const allBubbles = document.querySelectorAll('[class*="rounded-2xl"]');
      let lastAssistantContent = '';
      for (const bubble of allBubbles) {
        const classes = bubble.className;
        if (classes.includes('rounded-tl-sm') && !classes.includes('bg-blue-600')) {
          lastAssistantContent = bubble.textContent || '';
        }
      }
      return lastAssistantContent.substring(0, 200) || 'No response';
    });

    results.push({
      query: query.message,
      responseTimeMs: totalTime,
      success: responseReceived,
      preview: preview.substring(0, 100)
    });

    // Clear conversation before next query
    const clearBtn = await page.$('button:has-text("New chat")');
    if (clearBtn) {
      await clearBtn.click();
      await page.waitForTimeout(500);
    }
  }

  return results;
}

async function setupBrowser() {
  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#username');
  await page.fill('#username', CONFIG.username);
  await page.fill('#password', CONFIG.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/*', { waitUntil: 'networkidle' });

  // Open chat
  await page.waitForSelector('button[aria-label="Open chat"]', { timeout: 10000 });
  await page.click('button[aria-label="Open chat"]');
  await page.waitForTimeout(500);

  return { browser, page };
}

async function runModelTests(modelName, numRuns = 3) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Testing ${modelName.toUpperCase()}`);
  console.log(`${'='.repeat(50)}`);

  const allResults = [];
  const { browser, page } = await setupBrowser();

  try {
    for (let run = 1; run <= numRuns; run++) {
      const results = await runSingleTest(page, run);
      allResults.push(results);
    }
  } finally {
    await browser.close();
  }

  return allResults;
}

function analyzeResults(modelName, allResults) {
  const analysis = {
    model: modelName,
    runs: allResults.length,
    queries: {}
  };

  // Analyze each query across all runs
  for (let q = 0; q < QUERIES.length; q++) {
    const queryText = QUERIES[q].message;
    const times = allResults.map(run => run[q].responseTimeMs);
    const successes = allResults.filter(run => run[q].success).length;
    const previews = allResults.map(run => run[q].preview);

    analysis.queries[queryText] = {
      times: times,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: `${successes}/${allResults.length}`,
      sampleResponses: previews
    };
  }

  // Overall average
  const allTimes = allResults.flat().map(r => r.responseTimeMs);
  analysis.overallAvg = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;

  return analysis;
}

function printComparison(sonnetAnalysis, haikuAnalysis) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(70));

  console.log('\n--- Response Times (seconds) ---\n');
  console.log('| Query                          | Sonnet (avg) | Haiku (avg) | Difference |');
  console.log('|--------------------------------|--------------|-------------|------------|');

  for (const query of Object.keys(sonnetAnalysis.queries)) {
    const sonnetAvg = sonnetAnalysis.queries[query].avgTime / 1000;
    const haikuAvg = haikuAnalysis.queries[query].avgTime / 1000;
    const diff = sonnetAvg - haikuAvg;
    const diffSign = diff > 0 ? '+' : '';
    const queryShort = query.length > 30 ? query.substring(0, 27) + '...' : query.padEnd(30);
    console.log(`| ${queryShort} | ${sonnetAvg.toFixed(2).padStart(12)} | ${haikuAvg.toFixed(2).padStart(11)} | ${diffSign}${diff.toFixed(2).padStart(9)}s |`);
  }

  console.log('|--------------------------------|--------------|-------------|------------|');
  const sonnetOverall = sonnetAnalysis.overallAvg / 1000;
  const haikuOverall = haikuAnalysis.overallAvg / 1000;
  const overallDiff = sonnetOverall - haikuOverall;
  const diffSign = overallDiff > 0 ? '+' : '';
  console.log(`| ${'OVERALL AVERAGE'.padEnd(30)} | ${sonnetOverall.toFixed(2).padStart(12)} | ${haikuOverall.toFixed(2).padStart(11)} | ${diffSign}${overallDiff.toFixed(2).padStart(9)}s |`);

  console.log('\n--- Detailed Times Per Run (seconds) ---\n');
  for (const query of Object.keys(sonnetAnalysis.queries)) {
    console.log(`"${query}":`);
    console.log(`  Sonnet: ${sonnetAnalysis.queries[query].times.map(t => (t/1000).toFixed(2)).join('s, ')}s`);
    console.log(`  Haiku:  ${haikuAnalysis.queries[query].times.map(t => (t/1000).toFixed(2)).join('s, ')}s`);
  }

  console.log('\n--- Response Quality Comparison ---\n');
  for (const query of Object.keys(sonnetAnalysis.queries)) {
    console.log(`"${query}":`);
    console.log(`  Sonnet sample: ${sonnetAnalysis.queries[query].sampleResponses[0]}...`);
    console.log(`  Haiku sample:  ${haikuAnalysis.queries[query].sampleResponses[0]}...`);
    console.log('');
  }

  // Speed comparison
  const speedup = ((sonnetOverall - haikuOverall) / sonnetOverall * 100).toFixed(1);
  if (overallDiff > 0) {
    console.log(`\n>>> Haiku is ${Math.abs(speedup)}% faster than Sonnet on average <<<`);
  } else {
    console.log(`\n>>> Sonnet is ${Math.abs(speedup)}% faster than Haiku on average <<<`);
  }
}

async function main() {
  const numRuns = parseInt(process.env.NUM_RUNS || '5', 10);
  const delayBetweenRuns = parseInt(process.env.DELAY_BETWEEN_RUNS || '15000', 10); // 15 seconds default
  console.log('\n=== Model Comparison Test ===');
  console.log(`Running ${numRuns} tests per model with ${QUERIES.length} queries each`);
  console.log(`URL: ${CONFIG.baseUrl}`);
  console.log(`Headless: ${CONFIG.headless}`);

  // Get current model from backend to know what we're testing
  const currentModel = process.env.CHAT_MODEL_TIER || 'unknown';
  console.log(`\nTesting model tier: ${currentModel}`);

  console.log(`Delay between runs: ${delayBetweenRuns / 1000}s`);

  const { browser, page } = await setupBrowser();
  const allResults = [];

  try {
    for (let run = 1; run <= numRuns; run++) {
      const results = await runSingleTest(page, run);
      allResults.push(results);

      // Add delay between runs to avoid rate limits
      if (run < numRuns) {
        console.log(`\n    Waiting ${delayBetweenRuns / 1000}s before next run to avoid rate limits...`);
        await page.waitForTimeout(delayBetweenRuns);
      }
    }
  } finally {
    await browser.close();
  }

  const analysis = analyzeResults(currentModel, allResults);

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log(`RESULTS FOR ${currentModel.toUpperCase()}`);
  console.log('='.repeat(50));

  console.log('\n--- Response Times Per Query ---\n');
  for (const [query, data] of Object.entries(analysis.queries)) {
    console.log(`"${query}":`);
    console.log(`  Times: ${data.times.map(t => (t/1000).toFixed(2)).join('s, ')}s`);
    console.log(`  Avg: ${(data.avgTime/1000).toFixed(2)}s | Min: ${(data.minTime/1000).toFixed(2)}s | Max: ${(data.maxTime/1000).toFixed(2)}s`);
    console.log(`  Success: ${data.successRate}`);
  }

  console.log(`\n>>> Overall Average: ${(analysis.overallAvg/1000).toFixed(2)}s <<<`);

  // Output JSON for comparison
  const outputFile = `/tmp/model-test-${currentModel}.json`;
  require('fs').writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);

  return analysis;
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\nTest completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { runModelTests, analyzeResults, printComparison, main };
