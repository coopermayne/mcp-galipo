/**
 * TestRunner - Flexible browser automation framework built on Puppeteer
 *
 * Features:
 * - Login handling
 * - Screenshot capture with annotations
 * - Wait helpers for async content
 * - Test step tracking for reports
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.outputDir = options.outputDir || path.join(__dirname, '..', 'output');
    this.headless = options.headless !== false; // default true
    this.slowMo = options.slowMo || 0;
    this.viewport = options.viewport || { width: 1280, height: 800 };

    this.browser = null;
    this.page = null;
    this.steps = []; // Track test steps for report
    this.screenshotIndex = 0;
    this.testName = options.testName || 'test';

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Initialize browser and page
   */
  async init() {
    this.browser = await puppeteer.launch({
      headless: this.headless,
      slowMo: this.slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport(this.viewport);

    // Set up console logging from browser
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser Error] ${msg.text()}`);
      }
    });

    return this;
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Navigate to a URL (relative to baseUrl or absolute)
   */
  async goto(urlPath, options = {}) {
    const url = urlPath.startsWith('http') ? urlPath : `${this.baseUrl}${urlPath}`;
    await this.page.goto(url, { waitUntil: 'networkidle0', ...options });
    return this;
  }

  /**
   * Login to the application
   */
  async login(username, password) {
    await this.goto('/login');

    // Wait for login form
    await this.page.waitForSelector('#username');

    // Fill in credentials
    await this.page.type('#username', username);
    await this.page.type('#password', password);

    // Click submit
    await this.page.click('button[type="submit"]');

    // Wait for navigation to complete (should redirect to dashboard)
    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });

    return this;
  }

  /**
   * Take a screenshot and add to test steps
   */
  async screenshot(description, options = {}) {
    this.screenshotIndex++;
    const filename = `${this.testName}_${String(this.screenshotIndex).padStart(2, '0')}.png`;
    const filepath = path.join(this.outputDir, filename);

    await this.page.screenshot({
      path: filepath,
      fullPage: options.fullPage || false,
      ...options
    });

    this.steps.push({
      index: this.screenshotIndex,
      description,
      screenshot: filename,
      timestamp: new Date().toISOString()
    });

    console.log(`  [${this.screenshotIndex}] ${description}`);

    return filepath;
  }

  /**
   * Add a step without screenshot (for notes/context)
   */
  addStep(description, details = {}) {
    this.steps.push({
      index: null,
      description,
      details,
      timestamp: new Date().toISOString()
    });
    return this;
  }

  /**
   * Wait for a selector to appear
   */
  async waitFor(selector, options = {}) {
    await this.page.waitForSelector(selector, { timeout: 30000, ...options });
    return this;
  }

  /**
   * Wait for text content to appear on page
   */
  async waitForText(text, options = {}) {
    await this.page.waitForFunction(
      (searchText) => document.body.innerText.includes(searchText),
      { timeout: 30000, ...options },
      text
    );
    return this;
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(timeout = 500) {
    await this.page.waitForNetworkIdle({ idleTime: timeout });
    return this;
  }

  /**
   * Click an element
   */
  async click(selector) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
    return this;
  }

  /**
   * Type text into an input
   */
  async type(selector, text, options = {}) {
    await this.page.waitForSelector(selector);
    if (options.clear) {
      await this.page.click(selector, { clickCount: 3 });
    }
    await this.page.type(selector, text, { delay: options.delay || 0 });
    return this;
  }

  /**
   * Press a key
   */
  async press(key) {
    await this.page.keyboard.press(key);
    return this;
  }

  /**
   * Wait for specified milliseconds
   */
  async wait(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
    return this;
  }

  /**
   * Get all test steps for report generation
   */
  getSteps() {
    return this.steps;
  }

  /**
   * Execute a custom function with page access
   */
  async evaluate(fn, ...args) {
    return await this.page.evaluate(fn, ...args);
  }

  /**
   * Get page content
   */
  async getContent() {
    return await this.page.content();
  }

  /**
   * Check if element exists
   */
  async exists(selector) {
    const element = await this.page.$(selector);
    return element !== null;
  }

  /**
   * Get text content of an element
   */
  async getText(selector) {
    await this.page.waitForSelector(selector);
    return await this.page.$eval(selector, el => el.textContent);
  }

  /**
   * Scroll to element
   */
  async scrollTo(selector) {
    await this.page.waitForSelector(selector);
    await this.page.$eval(selector, el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await this.wait(300); // Wait for scroll animation
    return this;
  }

  /**
   * Get element bounding box (for highlighting in reports)
   */
  async getBoundingBox(selector) {
    await this.page.waitForSelector(selector);
    const element = await this.page.$(selector);
    return await element.boundingBox();
  }

  /**
   * Highlight an element temporarily (useful before screenshots)
   */
  async highlight(selector, color = 'red') {
    await this.page.evaluate((sel, c) => {
      const el = document.querySelector(sel);
      if (el) {
        el.style.outline = `3px solid ${c}`;
        el.style.outlineOffset = '2px';
      }
    }, selector, color);
    return this;
  }

  /**
   * Remove highlight from element
   */
  async unhighlight(selector) {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    }, selector);
    return this;
  }
}

module.exports = TestRunner;
