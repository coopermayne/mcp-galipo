/**
 * Galipo Browser Test Framework
 *
 * Exports for programmatic use:
 *
 * const { TestRunner, PdfGenerator } = require('./tests/browser');
 *
 * const runner = new TestRunner({ baseUrl: 'http://localhost:3000' });
 * await runner.init();
 * await runner.login('admin', 'password');
 * await runner.screenshot('Dashboard');
 * // ...
 * await runner.close();
 *
 * const pdf = new PdfGenerator();
 * await pdf.generate({ title: 'Test', steps: runner.getSteps() });
 */

const TestRunner = require('./lib/TestRunner');
const PdfGenerator = require('./lib/PdfGenerator');

module.exports = {
  TestRunner,
  PdfGenerator
};
