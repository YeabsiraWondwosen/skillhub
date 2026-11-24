import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { logger } from '../utils/logger.js';

const COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  bg: '#f9fafb',
  success: '#10b981',
  red: '#ef4444',
};

export const generateInvoicePDF = async (payment, options = {}) => {
  const {
    company = {
      name: 'SkillHub',
      tagline: 'The Multi-Category Freelance Marketplace',
      website: 'https://skillhub.dev',
      email: 'support@skillhub.dev',
    },
    includeQR = true,
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: `Invoice ${payment.invoiceNumber || payment._id}`,
          Author: company.name,
          Subject: 'Payment Invoice',
          Creator: `${company.name} Invoice Generator`,
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // QR Code
      let qrDataUrl = null;
      if (includeQR) {
        try {
          const invoiceUrl = `${options.frontendUrl || 'https://skillhub.dev'}/payments/invoices/${payment._id}`;
          qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
            width: 120,
            margin: 1,
            color: { dark: COLORS.primary, light: '#ffffff' },
          });
        } catch (e) {
          logger.warn('QR code generation failed:', e.message);
        }
      }

      // Header
      doc.rect(0, 0, doc.page.width, 140).fill(COLORS.primary);

      doc.fontSize(28).font('Helvetica-Bold').fillColor('#ffffff').text(company.name, 50, 40);
      doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.8)').text(company.tagline, 50, 75);
      doc.fontSize(10).fillColor('rgba(255,255,255,0.7)').text(company.website, 50, 90);

      doc.fontSize(32).font('Helvetica-Bold').fillColor('#ffffff').text('INVOICE', 350, 40, { align: 'right' });
      doc.fontSize(11).font('Helvetica').fillColor('rgba(255,255,255,0.9)')
        .text(`#${payment.invoiceNumber || payment._id}`, 350, 78, { align: 'right' });
      doc.fontSize(10).fillColor('rgba(255,255,255,0.7)')
        .text(`Date: ${new Date(payment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 350, 96, { align: 'right' });

      // QR code in header
      if (qrDataUrl) {
        try {
          const imgData = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          doc.image(imgData, doc.page.width - 120, 30, { width: 80, height: 80 });
        } catch (e) { /* skip qr */ }
      }

      // From / To
      const payer = payment.payer || {};
      const payee = payment.payee || {};

      doc.fillColor(COLORS.text);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight).text('FROM', 50, 165);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
        .text(`${payer.firstName || ''} ${payer.lastName || ''}`.trim() || 'N/A', 50, 182);
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight)
        .text(payer.email || '', 50, 198);

      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight).text('TO', 300, 165);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
        .text(`${payee.firstName || ''} ${payee.lastName || ''}`.trim() || 'N/A', 300, 182);
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight)
        .text(payee.email || '', 300, 198);

      // Line
      doc.moveTo(50, 225).lineTo(545, 225).strokeColor(COLORS.border).lineWidth(1).stroke();

      // Table header
      const tableTop = 245;
      const tableHeaders = ['Description', 'Type', 'Status', 'Amount'];
      const colWidths = [240, 100, 90, 100];
      let colX = 50;

      doc.rect(50, tableTop, 495, 28).fill(COLORS.bg);
      tableHeaders.forEach((header, i) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.textLight)
          .text(header.toUpperCase(), colX + 8, tableTop + 10, { width: colWidths[i] - 16 });
        colX += colWidths[i];
      });

      // Table row
      const rowY = tableTop + 36;
      colX = 50;
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);

      const desc = payment.description || payment.type || 'Payment';
      doc.text(desc, colX + 8, rowY, { width: colWidths[0] - 16, lineBreak: false });
      colX += colWidths[0];

      doc.text((payment.type || '').replace(/_/g, ' '), colX + 8, rowY, { width: colWidths[1] - 16 });
      colX += colWidths[1];

      const statusColor = payment.status === 'completed' ? COLORS.success
        : payment.status === 'failed' ? COLORS.red : COLORS.textLight;
      doc.fillColor(statusColor).text((payment.status || 'pending').toUpperCase(), colX + 8, rowY, { width: colWidths[2] - 16 });
      doc.fillColor(COLORS.text);

      colX += colWidths[2];
      doc.font('Helvetica-Bold').text(`${payment.currency || 'ETB'} ${(payment.amount || 0).toFixed(2)}`, colX + 8, rowY, { width: colWidths[3] - 16 });

      // Separator
      doc.moveTo(50, rowY + 28).lineTo(545, rowY + 28).strokeColor(COLORS.border).lineWidth(1).stroke();

      // Totals
      const totalsY = rowY + 50;
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight).text('Subtotal', 350, totalsY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(`${payment.currency || 'ETB'} ${(payment.amount || 0).toFixed(2)}`, 460, totalsY, { align: 'right', width: 80 });

      if (payment.commission > 0) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight)
          .text(`Platform Fee (${((payment.commissionRate || 0.1) * 100).toFixed(0)}%)`, 350, totalsY + 22);
        doc.font('Helvetica-Bold').fillColor(COLORS.red)
          .text(`-${payment.currency || 'ETB'} ${(payment.commission || 0).toFixed(2)}`, 460, totalsY + 22, { align: 'right', width: 80 });
      }

      doc.moveTo(350, totalsY + (payment.commission > 0 ? 44 : 22))
        .lineTo(545, totalsY + (payment.commission > 0 ? 44 : 22))
        .strokeColor(COLORS.border).lineWidth(1).stroke();

      const netY = totalsY + (payment.commission > 0 ? 54 : 32);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.primary).text('Net Amount', 350, netY);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text(`${payment.currency || 'ETB'} ${(payment.netAmount || payment.amount || 0).toFixed(2)}`, 440, netY - 2, { align: 'right', width: 100 });

      // Footer info
      const footerY = netY + 60;
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor(COLORS.border).lineWidth(1).stroke();

      doc.fontSize(8).font('Helvetica').fillColor(COLORS.textLight);
      if (payment.project) {
        doc.text(`Project Reference: ${typeof payment.project === 'object' ? payment.project.title : payment.project}`, 50, footerY + 12);
      }
      if (payment.milestone) {
        doc.text(`Milestone: ${typeof payment.milestone === 'object' ? payment.milestone.title : payment.milestone}`, 50, footerY + 26);
      }
      doc.text(`Payment Reference: ${payment.reference || payment._id}`, 50, footerY + 40);
      if (payment.provider) {
        doc.text(`Provider: ${payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1)}`, 50, footerY + 54);
      }
      if (payment.processedAt) {
        doc.text(`Processed: ${new Date(payment.processedAt).toLocaleString()}`, 50, footerY + 68);
      }

      // Branding footer
      doc.fontSize(8).fillColor(COLORS.textLight)
        .text(`${company.name} — ${company.tagline}`, 50, doc.page.height - 50, { align: 'center', width: 495 });

      doc.end();
    } catch (error) {
      logger.error(`Invoice PDF generation failed: ${error.message}`);
      reject(error);
    }
  });
};
