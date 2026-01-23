/**
 * Phase 2 Streaming Test Scenario
 *
 * Tests the SSE streaming functionality and tool visualization.
 * Focus areas:
 * - Real-time text streaming (text appears incrementally)
 * - Tool call indicators (shows "running" state with spinner)
 * - Tool completion with timing information
 */

const TestRunner = require('../lib/TestRunner');
const PdfGenerator = require('../lib/PdfGenerator');

// Test configuration
const CONFIG = {
  baseUrl: process.env.FRONTEND_URL || 'http://localhost:8000',
  username: process.env.AUTH_USERNAME || 'admin',
  password: process.env.AUTH_PASSWORD || 'devpassword123',
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO) || 0
};

// Streaming test queries - chosen to trigger tool usage
const STREAMING_TESTS = [
  {
    message: 'How many cases do we have?',
    description: 'Simple query with tool - watch for streaming text and tool indicator',
    expectsTool: true,
    toolName: 'list_cases or get_dashboard_stats',
    capturesDuring: true, // Try to capture mid-stream
    waitTime: 8000
  },
  {
    message: 'Search for all cases with status Discovery',
    description: 'Search query - should show tool running then results',
    expectsTool: true,
    toolName: 'search_cases',
    capturesDuring: true,
    waitTime: 10000
  },
  {
    message: 'What is the Martinez case about? Give me a detailed summary.',
    description: 'Detail query - longer streaming response after tool',
    expectsTool: true,
    toolName: 'get_case',
    capturesDuring: true,
    waitTime: 15000
  }
];

async function runStreamingTest() {
  console.log('\n========================================');
  console.log('  Phase 2: Streaming & Tool Visualization Test');
  console.log('========================================\n');
  console.log(`Config: ${CONFIG.baseUrl} | Headless: ${CONFIG.headless}`);
  console.log('');

  const runner = new TestRunner({
    baseUrl: CONFIG.baseUrl,
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    testName: 'streaming_test',
    viewport: { width: 1400, height: 900 }
  });

  try {
    console.log('Starting browser...');
    await runner.init();

    // Login
    console.log('\n[1] Logging in...');
    await runner.goto('/login');
    await runner.wait(500);
    await runner.screenshot('Login page');

    await runner.type('#username', CONFIG.username);
    await runner.type('#password', CONFIG.password);
    await runner.click('button[type="submit"]');
    await runner.wait(2000);
    await runner.screenshot('Dashboard after login');

    // Open chat
    console.log('\n[2] Opening chat panel...');
    await runner.waitFor('button[aria-label="Open chat"]');
    await runner.click('button[aria-label="Open chat"]');
    await runner.wait(500);
    await runner.screenshot('Chat panel opened - ready for streaming tests');

    // Run streaming tests
    console.log('\n[3] Running streaming tests...\n');

    for (let i = 0; i < STREAMING_TESTS.length; i++) {
      const test = STREAMING_TESTS[i];
      console.log(`  Test ${i + 1}/${STREAMING_TESTS.length}: "${test.message}"`);
      console.log(`    Expects tool: ${test.toolName}`);

      // Clear previous conversation for clean test
      if (i > 0) {
        const cleared = await runner.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const newChatBtn = buttons.find(btn => btn.textContent.includes('New chat'));
          if (newChatBtn) {
            newChatBtn.click();
            return true;
          }
          return false;
        });
        if (cleared) {
          await runner.wait(500);
        }
      }

      // Type and send message
      await runner.type('textarea[placeholder="Type a message..."]', test.message, { clear: true });
      await runner.screenshot(`Test ${i + 1}: Query ready - "${test.message.substring(0, 40)}..."`);

      // Send the message
      await runner.press('Enter');

      // Capture mid-stream if requested
      if (test.capturesDuring) {
        // Wait a short time then capture - should catch streaming in progress
        await runner.wait(1500);
        await runner.screenshot(`Test ${i + 1}: STREAMING IN PROGRESS - checking for tool indicator`);

        // Check for tool indicator element
        const hasToolIndicator = await runner.evaluate(() => {
          // Look for any element that might indicate tool execution
          const toolIndicators = document.querySelectorAll('[class*="tool"], [class*="Tool"]');
          const spinners = document.querySelectorAll('[class*="animate-spin"]');
          const runningText = document.body.innerText.includes('running') ||
                             document.body.innerText.includes('Searching') ||
                             document.body.innerText.includes('Getting');
          return {
            hasToolIndicators: toolIndicators.length > 0,
            hasSpinners: spinners.length > 0,
            hasRunningText: runningText
          };
        });

        runner.addStep(`Streaming check for: "${test.message}"`, {
          hasToolIndicators: hasToolIndicator.hasToolIndicators,
          hasSpinners: hasToolIndicator.hasSpinners,
          hasRunningText: hasToolIndicator.hasRunningText,
          note: 'Captured mid-stream to verify streaming UI'
        });

        console.log(`    Mid-stream check: indicators=${hasToolIndicator.hasToolIndicators}, spinners=${hasToolIndicator.hasSpinners}`);
      }

      // Wait for completion
      console.log(`    Waiting for response to complete...`);
      await runner.wait(test.waitTime);

      // Scroll to see full response
      await runner.evaluate(() => {
        const messageList = document.querySelector('[class*="overflow-y-auto"]');
        if (messageList) {
          messageList.scrollTop = messageList.scrollHeight;
        }
      });
      await runner.wait(500);

      // Capture final result
      await runner.screenshot(`Test ${i + 1}: COMPLETED - ${test.description}`);

      // Check for tool call display in final result
      const toolCallInfo = await runner.evaluate(() => {
        const toolElements = document.querySelectorAll('[class*="font-mono"]');
        const durationElements = Array.from(document.querySelectorAll('*')).filter(
          el => el.textContent && el.textContent.match(/\d+ms/)
        );
        return {
          toolNames: Array.from(toolElements).map(el => el.textContent).slice(0, 5),
          hasDuration: durationElements.length > 0,
          durationTexts: durationElements.map(el => el.textContent).slice(0, 3)
        };
      });

      runner.addStep(`Result for: "${test.message}"`, {
        toolsFound: toolCallInfo.toolNames.join(', ') || 'none visible',
        hasDurationInfo: toolCallInfo.hasDuration,
        note: test.description
      });

      console.log(`    Tools shown: ${toolCallInfo.toolNames.join(', ') || 'none'}`);
      console.log(`    Duration info: ${toolCallInfo.hasDuration ? 'yes' : 'no'}`);
      console.log(`    Done.\n`);
    }

    // Test 4: Verify tool indicator expansion (if clickable)
    console.log('[4] Testing tool indicator details...');

    // Try to find and click a tool indicator to expand it
    const expanded = await runner.evaluate(() => {
      // Look for clickable tool elements
      const toolElements = document.querySelectorAll('button[class*="tool"], div[class*="cursor-pointer"]');
      for (const el of toolElements) {
        if (el.textContent && (el.textContent.includes('get_') || el.textContent.includes('search_') || el.textContent.includes('list_'))) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (expanded) {
      await runner.wait(300);
      await runner.screenshot('Tool indicator expanded - showing arguments/result');
    }

    // Close chat
    console.log('\n[5] Closing chat...');
    await runner.click('button[aria-label="Close chat"]');
    await runner.wait(500);
    await runner.screenshot('Test complete - chat closed');

    console.log('\n========================================');
    console.log('  Generating PDF Report...');
    console.log('========================================\n');

    // Generate PDF report
    const pdfGen = new PdfGenerator({ outputDir: runner.outputDir });
    const pdfPath = await pdfGen.generate({
      title: 'Phase 2: Streaming Test Report',
      subtitle: 'SSE Streaming & Tool Visualization',
      description: `Testing Phase 2 features:
• Real-time SSE streaming (text appears incrementally)
• Tool execution indicators with spinner animation
• Tool completion with timing information (duration in ms)
• Expandable tool details showing arguments and results

Test captures include mid-stream screenshots to verify streaming behavior.`,
      steps: runner.getSteps(),
      outputFilename: `streaming_test_report_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`,
      metadata: {
        phase: 'Phase 2: Streaming & Tool Visualization',
        baseUrl: CONFIG.baseUrl,
        testCount: STREAMING_TESTS.length,
        features: ['SSE Streaming', 'Tool Indicators', 'Duration Timing']
      }
    });

    console.log(`\nPDF Report: ${pdfPath}`);
    console.log(`Screenshots: ${runner.outputDir}`);

    return { success: true, pdfPath, steps: runner.getSteps() };

  } catch (error) {
    console.error('\nTest failed:', error.message);
    try {
      await runner.screenshot('ERROR - Streaming test failure');
    } catch (e) {
      // Ignore
    }
    throw error;
  } finally {
    await runner.close();
  }
}

// Run if executed directly
if (require.main === module) {
  runStreamingTest()
    .then(result => {
      console.log('\nStreaming test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nStreaming test failed:', error);
      process.exit(1);
    });
}

module.exports = { runStreamingTest, CONFIG, STREAMING_TESTS };
