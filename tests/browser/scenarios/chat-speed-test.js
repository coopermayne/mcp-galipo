/**
 * Chat Speed Test - Performance measurement using Playwright
 *
 * Tests AI chat response times with detailed timing output.
 */

const { chromium } = require('playwright');

const CONFIG = {
  baseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  username: process.env.AUTH_USERNAME || 'asdf',
  password: process.env.AUTH_PASSWORD || 'asdf',
  headless: process.env.HEADLESS !== 'false'
};

const QUERIES = [
  { message: 'Hello!', maxWait: 30000 },
  { message: 'How many cases are there?', maxWait: 60000 },
  { message: 'List all the tasks', maxWait: 60000 }
];

async function runSpeedTest() {
  console.log('\n=== Chat Speed Test (Playwright) ===\n');
  console.log(`URL: ${CONFIG.baseUrl}`);
  console.log(`Headless: ${CONFIG.headless}\n`);

  const browser = await chromium.launch({
    headless: CONFIG.headless
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  const page = await context.newPage();

  // Enable request/response logging
  page.on('request', request => {
    if (request.url().includes('/chat/stream')) {
      console.log(`    [NET] Stream request: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/chat/stream')) {
      console.log(`    [NET] Stream response: ${response.status()}`);
    }
  });

  // Log console messages from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`    [PAGE ERROR] ${msg.text()}`);
    }
  });

  try {
    // Login
    console.log('[1] Logging in...');
    await page.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#username');
    await page.fill('#username', CONFIG.username);
    await page.fill('#password', CONFIG.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/*', { waitUntil: 'networkidle' });
    console.log('    Logged in successfully\n');

    // Open chat panel
    console.log('[2] Opening chat...');
    await page.waitForSelector('button[aria-label="Open chat"]', { timeout: 10000 });
    await page.click('button[aria-label="Open chat"]');
    await page.waitForTimeout(500);
    console.log('    Chat panel opened\n');

    // Check if there's an existing conversation and clear it
    const newChatBtn = await page.$('button:has-text("New chat")');
    if (newChatBtn) {
      console.log('    Clearing existing conversation...');
      await newChatBtn.click();
      await page.waitForTimeout(500);
    }

    // Run queries with timing
    console.log('[3] Running queries...\n');
    const results = [];

    for (let i = 0; i < QUERIES.length; i++) {
      const query = QUERIES[i];
      console.log(`--- Query ${i + 1}: "${query.message}" ---`);

      // Get initial message count
      const initialMsgCount = await page.evaluate(() => {
        return document.querySelectorAll('[class*="rounded-2xl"][class*="px-"]').length;
      });
      console.log(`    Initial message count: ${initialMsgCount}`);

      // Type the message using Playwright's fill (works properly with React)
      await page.fill('textarea[placeholder="Type a message..."]', query.message);

      // Verify the input has the correct value
      const inputValue = await page.inputValue('textarea[placeholder="Type a message..."]');
      console.log(`    Input value: "${inputValue}"`);

      // Check if send button is enabled
      const sendBtnDisabled = await page.$eval('button[aria-label="Send message"]', btn => btn.disabled);
      console.log(`    Send button disabled: ${sendBtnDisabled}`);

      // Click the send button (or press Enter)
      const sendStart = Date.now();
      await page.press('textarea[placeholder="Type a message..."]', 'Enter');
      console.log(`    Sent at ${new Date().toISOString()}`);

      // Poll for completion
      let responseReceived = false;
      let elapsed = 0;
      const pollInterval = 500;
      let debugLogged = false;

      while (!responseReceived && elapsed < query.maxWait) {
        await page.waitForTimeout(pollInterval);
        elapsed += pollInterval;

        const state = await page.evaluate(() => {
          // Check for streaming cursor (the pulsing block cursor)
          const streamingCursor = document.querySelector('[class*="animate-pulse"]');
          const isStreaming = !!streamingCursor;

          // Check for typing indicator (3 bouncing dots)
          const bouncingDots = document.querySelectorAll('[class*="animate-bounce"]');
          const isTypingIndicator = bouncingDots.length >= 3;

          // Find the message container (the scrollable area)
          const messageContainer = document.querySelector('[class*="overflow-y-auto"][class*="p-"]');

          // Find all message items - look for flex items with gap
          const messageItems = messageContainer ? messageContainer.querySelectorAll(':scope > div[class*="flex"][class*="items-start"]') : [];
          const msgCount = messageItems.length;

          // Find the last assistant message by looking for Bot icon or slate background
          // Assistant messages have rounded-tl-sm, user messages have rounded-tr-sm
          const allBubbles = document.querySelectorAll('[class*="rounded-2xl"]');
          let lastAssistantContent = '';
          let debugInfo = [];

          for (const bubble of allBubbles) {
            const classes = bubble.className;
            debugInfo.push(classes.substring(0, 80));
            // Assistant bubbles have rounded-tl-sm, user bubbles have rounded-tr-sm
            if (classes.includes('rounded-tl-sm') && !classes.includes('bg-blue-600')) {
              lastAssistantContent = bubble.textContent || '';
            }
          }

          return {
            isStreaming,
            isTypingIndicator,
            msgCount,
            contentLength: lastAssistantContent.length,
            hasContent: lastAssistantContent.length > 10,
            content: lastAssistantContent.substring(0, 100),
            debugClasses: debugInfo.slice(-3)
          };
        });

        // Log debug info once
        if (!debugLogged && elapsed >= 2000) {
          console.log(`    [DEBUG] Classes found: ${JSON.stringify(state.debugClasses)}`);
          console.log(`    [DEBUG] Content preview: "${state.content}"`);
          debugLogged = true;
        }

        // Log progress every 5s
        if (elapsed % 5000 === 0) {
          console.log(`    ... ${elapsed/1000}s - streaming: ${state.isStreaming}, typing: ${state.isTypingIndicator}, msgs: ${state.msgCount}, len: ${state.contentLength}`);
        }

        // Response complete when:
        // - Not showing streaming cursor or typing indicator
        // - We have more messages than before
        // - Message has substantial content
        if (!state.isStreaming && !state.isTypingIndicator && state.msgCount > initialMsgCount && state.hasContent) {
          // Double-check it's really done
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
      const status = responseReceived ? '✓' : '✗ (timeout)';
      console.log(`    ${status} Response time: ${(totalTime / 1000).toFixed(2)}s`);

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
        return lastAssistantContent.substring(0, 150) || 'No response';
      });
      console.log(`    Preview: ${preview.substring(0, 100)}...`);
      console.log('');

      results.push({
        query: query.message,
        responseTimeMs: totalTime,
        success: responseReceived
      });

      // Click "New chat" before next query
      if (i < QUERIES.length - 1) {
        const newChat = await page.$('button:has-text("New chat")');
        if (newChat) {
          await newChat.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Summary
    console.log('\n=== RESULTS SUMMARY ===\n');
    results.forEach((r, i) => {
      const status = r.success ? '✓' : '✗';
      console.log(`${status} Query ${i + 1}: ${(r.responseTimeMs / 1000).toFixed(2)}s - "${r.query}"`);
    });

    const successful = results.filter(r => r.success);
    if (successful.length > 0) {
      const avgTime = successful.reduce((a, b) => a + b.responseTimeMs, 0) / successful.length;
      console.log(`\nAverage response time: ${(avgTime / 1000).toFixed(2)}s (${successful.length}/${results.length} successful)`);
    }

    return results;

  } catch (error) {
    console.error('\nTest failed:', error.message);
    await page.screenshot({ path: '/tmp/chat-speed-error.png' });
    console.log('Error screenshot saved to /tmp/chat-speed-error.png');
    throw error;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runSpeedTest()
    .then(() => {
      console.log('\nTest completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { runSpeedTest };
