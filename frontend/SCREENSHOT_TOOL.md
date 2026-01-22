# Frontend Screenshot Tool

A Playwright-based utility for capturing screenshots of the frontend. Useful for documenting UI changes, debugging, and development assistance.

## Setup

Install Playwright (already in devDependencies):

```bash
cd frontend
npm install
npx playwright install chromium
```

## Usage

```bash
# Basic usage (screenshots localhost:5173 to screenshot.png)
node screenshot.mjs

# Screenshot a specific page
node screenshot.mjs http://localhost:5173/cases screenshot-cases.png

# Screenshot with custom credentials
APP_USER=myuser APP_PASS=mypass node screenshot.mjs http://localhost:5173/cases/1 case-detail.png
```

## How Claude Can Use This

When working on frontend development, Claude can use this tool to:

1. **Verify UI changes** - After making CSS/component changes, take a screenshot to confirm the result
2. **Debug layout issues** - Capture the current state of a page to analyze problems
3. **Document before/after** - Screenshot before making changes, then after, to compare

### Example workflow

```bash
# Start the dev server (in another terminal)
cd frontend && npm run dev

# Take a screenshot of the current state
node screenshot.mjs http://localhost:5173/cases before.png

# ... make changes ...

# Take a screenshot of the new state
node screenshot.mjs http://localhost:5173/cases after.png
```

### Environment Variables

- `APP_USER` - Login username (default: `admin`)
- `APP_PASS` - Login password (default: `devpassword123`)

## Notes

- The script automatically handles login if redirected to the login page
- Screenshots are full-page captures at 1280x900 viewport
- Make sure the dev server is running before taking screenshots
