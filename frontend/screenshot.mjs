import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173';
const outputPath = process.argv[3] || 'screenshot.png';
const BASE_URL = 'http://localhost:5173';
const USERNAME = process.env.APP_USER || 'admin';
const PASSWORD = process.env.APP_PASS || 'devpassword123';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // First, go to the app and log in
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Check if we're on login page
  const loginForm = await page.$('input[placeholder="Enter username"]');
  if (loginForm) {
    console.log('Logging in...');
    await page.fill('input[placeholder="Enter username"]', USERNAME);
    await page.fill('input[placeholder="Enter password"]', PASSWORD);
    await page.click('button:has-text("Sign In")');

    // Wait for navigation away from login page
    try {
      await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 10000 });
      console.log('Logged in successfully');
    } catch (e) {
      // Check for error message
      const error = await page.$('.text-red-600');
      if (error) {
        const errorText = await error.textContent();
        console.error('Login failed:', errorText);
      }
      throw new Error('Login failed - check credentials');
    }
  }

  // Now navigate to the target URL
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait a bit for any animations/transitions
  await page.waitForTimeout(500);

  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`Screenshot saved to ${outputPath}`);

  await browser.close();
}

takeScreenshot().catch(console.error);
