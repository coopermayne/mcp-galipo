import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const USERNAME = process.env.APP_USER || 'asdf';
const PASSWORD = process.env.APP_PASS || 'asdf';

const TEST_MESSAGES = [
  // Simple question - no tools needed
  "What can you help me with?",

  // Query that should trigger tool use
  "Show me all my cases",

  // More specific query
  "What tasks are due this week?",

  // Create something
  "Create a task called 'Review settlement offer' for the first case",
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runChatTests() {
  console.log('Starting chat tests...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Take screenshot to see what we have
  await page.screenshot({ path: '/tmp/login-page.png' });
  console.log('Screenshot saved to /tmp/login-page.png');

  // Check for login form - try multiple selectors
  const usernameInput = await page.$('input[type="text"], input[name="username"], input[placeholder*="username" i]');
  const passwordInput = await page.$('input[type="password"]');

  if (usernameInput && passwordInput) {
    console.log('Found login form, filling credentials...');
    await usernameInput.fill(USERNAME);
    await passwordInput.fill(PASSWORD);

    // Find and click submit button
    const submitBtn = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    if (submitBtn) {
      await submitBtn.click();
      console.log('Clicked submit button');

      // Wait for navigation or error
      try {
        await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 10000 });
        console.log('Logged in successfully\n');
      } catch (e) {
        // Check for error message
        await page.screenshot({ path: '/tmp/login-error.png' });
        console.log('Login may have failed - screenshot saved to /tmp/login-error.png');
        const pageContent = await page.content();
        if (pageContent.includes('error') || pageContent.includes('Invalid')) {
          console.error('Login error detected');
        }
      }
    } else {
      console.log('Could not find submit button');
    }
  } else {
    console.log('No login form found - may already be logged in');
  }

  // Wait for page to settle
  await sleep(1000);

  // Open chat panel (Cmd+K or click button)
  console.log('Opening chat panel...');

  // Look for the chat button (floating action button)
  let chatButton = await page.$('button:has-text("Chat")');
  if (!chatButton) {
    // Try finding by SVG icon or other attributes
    chatButton = await page.$('[data-testid="chat-button"]');
  }
  if (!chatButton) {
    // Find any button with a chat/message icon
    chatButton = await page.$('button.fixed');
  }

  if (chatButton) {
    await chatButton.click();
    console.log('Clicked chat button');
  } else {
    // Try keyboard shortcut
    console.log('Trying Cmd+K shortcut...');
    await page.keyboard.press('Meta+k');
  }

  await sleep(1000);

  // Find chat input - use the exact placeholder
  let chatInput = await page.$('textarea[placeholder="Type a message..."]');
  if (!chatInput) {
    chatInput = await page.$('textarea');
  }

  if (!chatInput) {
    console.error('Could not find chat input!');
    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/chat-debug.png', fullPage: true });
    console.log('Screenshot saved to /tmp/chat-debug.png');
    await browser.close();
    return;
  }

  console.log('Found chat input')

  // Send each test message
  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const message = TEST_MESSAGES[i];
    console.log(`\n--- Test ${i + 1}/${TEST_MESSAGES.length} ---`);
    console.log(`Sending: "${message}"`);

    // Wait for input to be enabled (not disabled from previous message)
    await page.waitForSelector('textarea:not([disabled])', { timeout: 60000 });

    // Re-find the chat input (in case it was recreated)
    const input = await page.$('textarea[placeholder="Type a message..."]') || await page.$('textarea');

    // Type and send message
    await input.fill(message);
    await page.keyboard.press('Enter');

    // Wait for response to complete
    // Look for the input to be disabled then enabled again
    let waitTime = 0;
    const maxWait = 60000; // 60 seconds max for longer operations

    // First wait for it to start processing (input becomes disabled)
    await sleep(500);

    // Then wait for it to finish (input becomes enabled again)
    while (waitTime < maxWait) {
      await sleep(500);
      waitTime += 500;

      // Check if input is enabled (response complete)
      const isDisabled = await page.$('textarea[disabled]');
      if (!isDisabled && waitTime > 1000) {
        break;
      }
    }

    console.log(`Response received (waited ${waitTime}ms)`);

    // Small delay between messages
    await sleep(500);
  }

  console.log('\n=== Chat tests complete ===');
  console.log('Check logs with: python scripts/analyze_chat_logs.py --summary --tools\n');

  await browser.close();
}

runChatTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
