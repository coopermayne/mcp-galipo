/**
 * Chat Feature Test Scenario
 *
 * Tests the AI chat functionality with various queries and captures screenshots.
 */

const TestRunner = require('../lib/TestRunner');
const PdfGenerator = require('../lib/PdfGenerator');

// Test configuration
const CONFIG = {
  baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  username: process.env.AUTH_USERNAME || 'admin',
  password: process.env.AUTH_PASSWORD || 'devpassword123',
  headless: process.env.HEADLESS !== 'false', // default true, set HEADLESS=false to see browser
  slowMo: parseInt(process.env.SLOW_MO) || 0
};

// Chat test queries
const CHAT_QUERIES = [
  {
    message: 'Hello! What can you help me with?',
    description: 'Initial greeting - testing welcome response',
    waitTime: 8000
  },
  {
    message: 'Show me all the cases',
    description: 'List all cases - testing MCP tool integration',
    waitTime: 10000
  },
  {
    message: 'Tell me more about the Martinez case',
    description: 'Get case details - testing specific case lookup',
    waitTime: 12000
  },
  {
    message: 'What tasks are due this week?',
    description: 'Calendar/tasks query - testing deadline awareness',
    waitTime: 10000
  },
  {
    message: 'Find information about Dr. Wong',
    description: 'Person search - testing contact lookup',
    waitTime: 10000
  }
];

async function runChatTest() {
  console.log('\n========================================');
  console.log('  Chat Feature Browser Test');
  console.log('========================================\n');
  console.log(`Config: ${CONFIG.baseUrl} | Headless: ${CONFIG.headless}`);
  console.log('');

  const runner = new TestRunner({
    baseUrl: CONFIG.baseUrl,
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    testName: 'chat_test',
    viewport: { width: 1400, height: 900 }
  });

  try {
    // Initialize browser
    console.log('Starting browser...');
    await runner.init();

    // Step 1: Login
    console.log('\n[1] Logging in...');
    await runner.goto('/login');
    await runner.wait(500);
    await runner.screenshot('Login page');

    await runner.type('#username', CONFIG.username);
    await runner.type('#password', CONFIG.password);
    await runner.click('button[type="submit"]');
    await runner.wait(2000);
    await runner.screenshot('Dashboard after login');

    // Step 2: Open chat panel
    console.log('\n[2] Opening chat panel...');

    // Find and click the chat button (bottom right floating button)
    await runner.waitFor('button[aria-label="Open chat"]');
    await runner.click('button[aria-label="Open chat"]');
    await runner.wait(500);
    await runner.screenshot('Chat panel opened');

    // Step 3: Run through chat queries
    console.log('\n[3] Testing chat queries...\n');

    for (let i = 0; i < CHAT_QUERIES.length; i++) {
      const query = CHAT_QUERIES[i];
      console.log(`  Query ${i + 1}/${CHAT_QUERIES.length}: "${query.message}"`);

      // Type the message
      await runner.type('textarea[placeholder="Type a message..."]', query.message, { clear: true });
      await runner.wait(300);

      // Take screenshot before sending
      await runner.screenshot(`Query ${i + 1}: Before sending - "${query.message.substring(0, 30)}..."`);

      // Send the message (press Enter)
      await runner.press('Enter');

      // Wait for response (AI responses take time)
      console.log(`    Waiting for AI response...`);
      await runner.wait(query.waitTime);

      // Scroll to see full response if needed
      await runner.evaluate(() => {
        const messageList = document.querySelector('[class*="overflow-y-auto"]');
        if (messageList) {
          messageList.scrollTop = messageList.scrollHeight;
        }
      });
      await runner.wait(500);

      // Take screenshot of the response
      await runner.screenshot(`Query ${i + 1}: ${query.description}`);

      // Add a note about what we're testing
      runner.addStep(`Query: "${query.message}"`, {
        purpose: query.description,
        expectedBehavior: 'AI should use MCP tools and return formatted response'
      });

      console.log(`    Done.\n`);
    }

    // Step 4: Test "New chat" functionality
    console.log('[4] Testing new conversation button...');
    // Find and click "New chat" button by text content (can't use :has-text in Puppeteer)
    const newChatClicked = await runner.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newChatBtn = buttons.find(btn => btn.textContent.includes('New chat'));
      if (newChatBtn) {
        newChatBtn.click();
        return true;
      }
      return false;
    });
    if (newChatClicked) {
      await runner.wait(500);
      await runner.screenshot('After clicking New Chat (messages cleared)');
    }

    // Step 5: Close chat panel
    console.log('\n[5] Closing chat panel...');
    await runner.click('button[aria-label="Close chat"]');
    await runner.wait(500);
    await runner.screenshot('Chat panel closed');

    // Step 6: Test chat from case detail page (with context)
    console.log('\n[6] Testing chat with case context...');
    await runner.goto('/cases/1'); // Martinez case
    await runner.wait(2000);
    await runner.screenshot('Case detail page - Martinez v. City of Los Angeles');

    // Open chat
    await runner.click('button[aria-label="Open chat"]');
    await runner.wait(500);
    await runner.screenshot('Chat opened with case context');

    // Send a contextual query
    await runner.type('textarea[placeholder="Type a message..."]', 'What are the upcoming deadlines for this case?');
    await runner.press('Enter');
    await runner.wait(10000);
    await runner.evaluate(() => {
      const messageList = document.querySelector('[class*="overflow-y-auto"]');
      if (messageList) {
        messageList.scrollTop = messageList.scrollHeight;
      }
    });
    await runner.screenshot('Chat response with case context');

    console.log('\n========================================');
    console.log('  Test complete! Generating PDF...');
    console.log('========================================\n');

    // Generate PDF report
    const pdfGen = new PdfGenerator({ outputDir: runner.outputDir });
    const pdfPath = await pdfGen.generate({
      title: 'Chat Feature Test Report',
      subtitle: 'Galipo Legal Case Management System',
      description: 'Automated browser testing of the AI chat feature including tool integration, case context, and conversation management.',
      steps: runner.getSteps(),
      outputFilename: `chat_test_report_${new Date().toISOString().split('T')[0]}.pdf`,
      metadata: {
        baseUrl: CONFIG.baseUrl,
        queriesTested: CHAT_QUERIES.length,
        headless: CONFIG.headless
      }
    });

    console.log(`\nPDF Report: ${pdfPath}`);
    console.log(`Screenshots: ${runner.outputDir}`);

    return { success: true, pdfPath, steps: runner.getSteps() };

  } catch (error) {
    console.error('\nTest failed:', error.message);

    // Try to take a failure screenshot
    try {
      await runner.screenshot('ERROR - Test failure state');
    } catch (e) {
      // Ignore screenshot errors during failure
    }

    throw error;

  } finally {
    await runner.close();
  }
}

// Run if executed directly
if (require.main === module) {
  runChatTest()
    .then(result => {
      console.log('\nTest completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nTest failed:', error);
      process.exit(1);
    });
}

module.exports = { runChatTest, CONFIG, CHAT_QUERIES };
