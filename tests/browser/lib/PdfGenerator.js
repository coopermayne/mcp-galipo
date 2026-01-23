/**
 * PdfGenerator - Creates PDF reports from test steps and screenshots
 *
 * Features:
 * - Title page with test summary
 * - Screenshots with descriptions
 * - Automatic page breaks
 * - Table of contents
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PdfGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(__dirname, '..', 'output');
    this.margin = options.margin || 50;
    this.pageWidth = 612; // Letter size
    this.pageHeight = 792;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  /**
   * Generate a PDF report from test steps
   */
  async generate(options = {}) {
    const {
      title = 'Test Report',
      subtitle = '',
      description = '',
      steps = [],
      outputFilename = 'report.pdf',
      metadata = {}
    } = options;

    const outputPath = path.join(this.outputDir, outputFilename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'letter',
        margin: this.margin,
        info: {
          Title: title,
          Author: 'Browser Test Automation',
          Subject: subtitle,
          ...metadata
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title page
      this._renderTitlePage(doc, { title, subtitle, description, steps });

      // Table of contents
      if (steps.length > 0) {
        doc.addPage();
        this._renderTableOfContents(doc, steps);
      }

      // Test steps with screenshots
      for (const step of steps) {
        doc.addPage();
        this._renderStep(doc, step);
      }

      // Summary page
      doc.addPage();
      this._renderSummary(doc, { title, steps, metadata });

      doc.end();

      stream.on('finish', () => {
        console.log(`PDF report generated: ${outputPath}`);
        resolve(outputPath);
      });

      stream.on('error', reject);
    });
  }

  /**
   * Render title page
   */
  _renderTitlePage(doc, { title, subtitle, description, steps }) {
    const centerY = this.pageHeight / 2 - 100;

    // Title
    doc.fontSize(32)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(title, this.margin, centerY, {
         width: this.contentWidth,
         align: 'center'
       });

    // Subtitle
    if (subtitle) {
      doc.moveDown(0.5)
         .fontSize(16)
         .font('Helvetica')
         .fillColor('#64748b')
         .text(subtitle, {
           width: this.contentWidth,
           align: 'center'
         });
    }

    // Description
    if (description) {
      doc.moveDown(1)
         .fontSize(12)
         .fillColor('#334155')
         .text(description, {
           width: this.contentWidth,
           align: 'center'
         });
    }

    // Date and stats
    doc.moveDown(3)
       .fontSize(11)
       .fillColor('#94a3b8')
       .text(`Generated: ${new Date().toLocaleString()}`, {
         width: this.contentWidth,
         align: 'center'
       })
       .moveDown(0.3)
       .text(`Total Steps: ${steps.filter(s => s.screenshot).length}`, {
         width: this.contentWidth,
         align: 'center'
       });

    // Footer
    doc.fontSize(10)
       .fillColor('#cbd5e1')
       .text('Galipo Legal Case Management', this.margin, this.pageHeight - 80, {
         width: this.contentWidth,
         align: 'center'
       });
  }

  /**
   * Render table of contents
   */
  _renderTableOfContents(doc, steps) {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text('Table of Contents', this.margin, this.margin);

    doc.moveDown(1);

    let pageNum = 3; // Start after title and TOC pages
    const stepsWithScreenshots = steps.filter(s => s.screenshot);

    for (let i = 0; i < stepsWithScreenshots.length; i++) {
      const step = stepsWithScreenshots[i];
      const stepNum = i + 1;

      // Check if we need a new page for TOC
      if (doc.y > this.pageHeight - 100) {
        doc.addPage();
        doc.y = this.margin;
      }

      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#334155');

      const text = `${stepNum}. ${step.description}`;
      const dots = '.'.repeat(Math.max(1, 60 - text.length));

      doc.text(`${text} ${dots} ${pageNum}`, {
        width: this.contentWidth,
        lineGap: 6
      });

      pageNum++;
    }
  }

  /**
   * Render a single test step with screenshot
   */
  _renderStep(doc, step) {
    // Step header
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text(`Step ${step.index}: ${step.description}`, this.margin, this.margin);

    // Timestamp
    if (step.timestamp) {
      doc.moveDown(0.3)
         .fontSize(9)
         .font('Helvetica')
         .fillColor('#94a3b8')
         .text(new Date(step.timestamp).toLocaleString());
    }

    doc.moveDown(1);

    // Screenshot
    if (step.screenshot) {
      const screenshotPath = path.join(this.outputDir, step.screenshot);

      if (fs.existsSync(screenshotPath)) {
        // Calculate image dimensions to fit page
        const maxWidth = this.contentWidth;
        const maxHeight = this.pageHeight - doc.y - this.margin - 40;

        try {
          doc.image(screenshotPath, this.margin, doc.y, {
            fit: [maxWidth, maxHeight],
            align: 'center'
          });
        } catch (err) {
          doc.fontSize(10)
             .fillColor('#ef4444')
             .text(`[Screenshot not available: ${err.message}]`);
        }
      } else {
        doc.fontSize(10)
           .fillColor('#ef4444')
           .text(`[Screenshot file not found: ${step.screenshot}]`);
      }
    }

    // Details (if any)
    if (step.details && Object.keys(step.details).length > 0) {
      doc.moveDown(1)
         .fontSize(10)
         .font('Helvetica')
         .fillColor('#64748b');

      for (const [key, value] of Object.entries(step.details)) {
        doc.text(`${key}: ${value}`);
      }
    }
  }

  /**
   * Render summary page
   */
  _renderSummary(doc, { title, steps, metadata }) {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#1e40af')
       .text('Test Summary', this.margin, this.margin);

    doc.moveDown(1);

    const stepsWithScreenshots = steps.filter(s => s.screenshot);
    const stepsWithoutScreenshots = steps.filter(s => !s.screenshot);

    // Stats
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#334155');

    const stats = [
      ['Test Name', title],
      ['Total Screenshots', stepsWithScreenshots.length.toString()],
      ['Additional Notes', stepsWithoutScreenshots.length.toString()],
      ['Generated', new Date().toLocaleString()]
    ];

    for (const [label, value] of stats) {
      doc.font('Helvetica-Bold')
         .text(`${label}: `, { continued: true })
         .font('Helvetica')
         .text(value);
      doc.moveDown(0.3);
    }

    // Metadata
    if (metadata && Object.keys(metadata).length > 0) {
      doc.moveDown(1)
         .fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('Test Configuration');

      doc.moveDown(0.5)
         .fontSize(11)
         .font('Helvetica')
         .fillColor('#334155');

      for (const [key, value] of Object.entries(metadata)) {
        doc.text(`${key}: ${JSON.stringify(value)}`);
      }
    }

    // Notes section
    if (stepsWithoutScreenshots.length > 0) {
      doc.moveDown(1)
         .fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('Notes');

      doc.moveDown(0.5)
         .fontSize(11)
         .font('Helvetica')
         .fillColor('#334155');

      for (const note of stepsWithoutScreenshots) {
        doc.text(`- ${note.description}`);
        if (note.details) {
          for (const [key, value] of Object.entries(note.details)) {
            doc.text(`    ${key}: ${value}`);
          }
        }
      }
    }
  }
}

module.exports = PdfGenerator;
