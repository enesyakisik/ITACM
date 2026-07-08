/**
 * Server-side PDF generation for the handover form (Zimmet Tutanağı).
 *
 * Uses pdfkit with the bundled DejaVu fonts so Turkish characters
 * (ğ ş ı İ ö ü ç) render correctly on every platform — no browser,
 * no print dialog needed. Mirrors the on-screen form: company header,
 * employee info, equipment table, terms, delivery signatures and the
 * equipment-return section.
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const { DEFAULT_HANDOVER_TEMPLATE } = require('./defaults');

const FONT_DIR = path.dirname(require.resolve('dejavu-fonts-ttf/package.json'));
const F = {
  regular: path.join(FONT_DIR, 'ttf', 'DejaVuSans.ttf'),
  bold: path.join(FONT_DIR, 'ttf', 'DejaVuSans-Bold.ttf'),
  oblique: path.join(FONT_DIR, 'ttf', 'DejaVuSans-Oblique.ttf'),
};

const fmtDate = (v) => {
  const d = v && v.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR');
};

/** Streams a PDF for the given handover into `stream` (an http response or any writable). */
function buildHandoverPdf(stream, { handover, employee, settings, deliveredBy }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 46, left: 46, right: 46 } });
  doc.pipe(stream);
  doc.registerFont('r', F.regular).registerFont('b', F.bold).registerFont('i', F.oblique);

  const W = doc.page.width - 92; // content width
  const items = handover.items || [];
  const groups = handover.documentType === 'separate' ? items.map((i) => [i]) : [items];
  const formNo = 'HF-' + String(handover.id || '').slice(0, 8).toUpperCase();

  const PAGE_BOTTOM = doc.page.height - 40; // 40pt bottom margin
  // Merge over defaults so every option is always defined, regardless of caller.
  const tpl = { ...DEFAULT_HANDOVER_TEMPLATE, ...(settings.handoverTemplate || {}) };

  groups.forEach((group, gi) => {
    if (gi > 0) doc.addPage();
    let y = 44;

    /* ---- header ---- */
    const logo = settings.companyLogo;
    const nameX = tpl.showLogo ? 96 : 46;
    if (tpl.showLogo) {
      if (logo && /^data:image\/(png|jpe?g);base64,/.test(logo)) {
        try {
          doc.image(Buffer.from(logo.split(',')[1], 'base64'), 46, y, { fit: [40, 40] });
        } catch { /* unsupported image — skip */ }
      } else {
        doc.rect(46, y, 40, 40).lineWidth(1).stroke('#111');
        doc.font('b').fontSize(18).fillColor('#111')
          .text((settings.companyName || 'A')[0].toUpperCase(), 46, y + 10, { width: 40, align: 'center' });
      }
    }
    doc.font('b').fontSize(13).fillColor('#111')
      .text((settings.companyName || 'IT ASSET CONTROL PRO').toUpperCase(), nameX, y + 2, { width: W - 260 });
    if (tpl.subtitle) {
      doc.font('r').fontSize(7.5).fillColor('#444').text(tpl.subtitle, nameX, doc.y + 1, { width: W - 260 });
    }

    doc.font('b').fontSize(12).fillColor('#111')
      .text(tpl.titleEn || 'ASSET HANDOVER FORM', 46, y, { width: W, align: 'right' });
    if (tpl.titleTr) {
      doc.font('r').fontSize(9.5).text(`(${tpl.titleTr})`, 46, doc.y + 1, { width: W, align: 'right' });
    }
    doc.font('r').fontSize(7.5).fillColor('#333')
      .text(`Form ID: ${formNo}${groups.length > 1 ? '-' + (gi + 1) : ''}    Date: ${fmtDate(handover.transactionDate)}`,
        46, doc.y + 2, { width: W, align: 'right' });

    y = 92;
    doc.moveTo(46, y).lineTo(46 + W, y).lineWidth(1.4).stroke('#111');
    y += 11;

    /* ---- helpers ---- */
    const section = (title) => {
      doc.font('b').fontSize(8.5).fillColor('#111').text(title.toUpperCase(), 46, y, { width: W });
      y = doc.y + 2;
      doc.moveTo(46, y).lineTo(46 + W, y).lineWidth(0.6).stroke('#111');
      y += 7;
    };
    const half = W / 2;
    const infoField = (label, value, x, w) => {
      doc.font('r').fontSize(6.5).fillColor('#555').text(label, x, y, { width: w, lineBreak: false });
      doc.font('b').fontSize(9).fillColor('#111').text(value || '—', x, y + 9, { width: w, lineBreak: false });
      doc.moveTo(x, y + 22).lineTo(x + w - 12, y + 22).lineWidth(0.5).dash(1.5, { space: 1.5 }).stroke('#666').undash();
    };

    /* ---- employee info (only the enabled fields, laid out 2 per row) ---- */
    section('Receiving Employee Information');
    const empFields = [['Full Name / Ad Soyad', handover.employeeName]];
    if (tpl.showEmployeeId) empFields.push(['Employee ID / Sicil No', employee ? String(employee.id).slice(0, 8).toUpperCase() : '']);
    if (tpl.showDepartment) empFields.push(['Department / Departman', employee && employee.department]);
    if (tpl.showTitle) empFields.push(['Position / Ünvan', employee && employee.title]);
    for (let r = 0; r < empFields.length; r += 2) {
      infoField(empFields[r][0], empFields[r][1], 46, half);
      if (empFields[r + 1]) infoField(empFields[r + 1][0], empFields[r + 1][1], 46 + half, half);
      y += 30;
    }
    y += 4;

    /* ---- equipment table (columns per template; row height scales to one page) ---- */
    section('Equipment Details / Ekipman Detayları');
    const cols = [{ t: 'No', w: 22, get: (i, idx) => idx + 1 }];
    if (tpl.colCategory) cols.push({ t: 'Category', w: 62, get: (i) => i.category || '—' });
    cols.push({ t: 'Brand / Model', flex: true, get: (i) => `${i.brand} ${i.model}` });
    if (tpl.colSerial) cols.push({ t: 'Serial Number', w: 100, get: (i) => i.serialNumber });
    if (tpl.colMac) cols.push({ t: 'MAC Address', w: 92, get: (i) => i.macAddress || 'N/A' });
    if (tpl.colCondition) cols.push({ t: 'Condition', w: 88, get: (i) => i.conditionNote || 'New' });
    const fixedW = cols.reduce((s, c) => s + (c.flex ? 0 : c.w), 0);
    cols.forEach((c) => { if (c.flex) c.w = Math.max(90, W - fixedW); });

    // Reserve the space the fixed sections below the table need, then give the
    // table body whatever's left → the whole form stays on a single page.
    const RESERVE_BELOW = 300; // terms + delivery sigs + return section
    const availForBody = PAGE_BOTTOM - y - 18 /*header row*/ - RESERVE_BELOW;
    const rowH = Math.max(13, Math.min(18, Math.floor(availForBody / Math.max(group.length, 1))));
    const headH = 17;
    const drawRow = (cells, h, opts = {}) => {
      let x = 46;
      cells.forEach((cell, ci) => {
        if (opts.head) doc.rect(x, y, cols[ci].w, h).fillAndStroke('#ecebf5', '#444');
        else doc.rect(x, y, cols[ci].w, h).lineWidth(0.6).stroke('#444');
        doc.font(opts.head ? 'b' : 'r').fontSize(7).fillColor('#111')
          .text(String(cell ?? ''), x + 3, y + (h - 8) / 2, { width: cols[ci].w - 6, height: 9, ellipsis: true, lineBreak: false });
        x += cols[ci].w;
      });
      y += h;
    };
    drawRow(cols.map((c) => c.t), headH, { head: true });
    group.forEach((i, idx) => drawRow(cols.map((c) => c.get(i, idx)), rowH));
    y += 10;

    /* ---- terms (height-capped so it can never push a second page) ---- */
    if (tpl.showTerms) {
      section('Terms and Conditions / Şartlar ve Koşullar');
      const paras = String(settings.handoverTerms || '').split(/\n\s*\n/).filter((p) => p.trim());
      paras.slice(0, 2).forEach((p, i) => {
        doc.font(i === 0 ? 'r' : 'i').fontSize(6.8).fillColor('#222')
          .text(p.trim(), 46, y, { width: W, lineGap: 0.5, height: 42, ellipsis: true });
        y = doc.y + 3;
      });
      y += 3;
    }

    /* ---- signature helper ---- */
    const sig = (x, w, topLabel, subLabel, name, underLabel, sy) => {
      doc.font('r').fontSize(7.5).fillColor('#111').text(topLabel, x, sy, { width: w, align: 'center', lineBreak: false });
      if (subLabel) doc.font('r').fontSize(6.5).fillColor('#555').text(subLabel, x, sy + 9, { width: w, align: 'center', lineBreak: false });
      const ly = sy + 34;
      doc.moveTo(x + 12, ly).lineTo(x + w - 12, ly).lineWidth(0.8).stroke('#111');
      doc.font('b').fontSize(8).fillColor('#111').text(name || ' ', x, ly + 3, { width: w, align: 'center', lineBreak: false });
      doc.font('r').fontSize(6.5).fillColor('#555').text(underLabel, x, ly + 13, { width: w, align: 'center', lineBreak: false });
    };

    /* ---- delivery signatures ---- */
    sig(46, W / 2 - 10, tpl.deliveredByLabel || 'Delivered By (IT Department)', 'Teslim Eden (BT Departmanı)', deliveredBy || 'IT Department', 'IT Systems Administrator', y);
    sig(46 + W / 2 + 10, W / 2 - 10, tpl.receivedByLabel || 'Received By (Employee)', 'Teslim Alan (Çalışan)', handover.employeeName, 'Signature / İmza', y);
    y += 62;

    /* ---- return section (signed when the equipment comes back) ---- */
    if (tpl.showReturnSection) {
      section('Equipment Return / Ekipman İadesi');
      doc.font('r').fontSize(6.8).fillColor('#222')
        .text('I confirm that I returned the equipment listed above; signed when the equipment is handed back to the IT department. '
          + 'Yukarıda listelenen ekipmanı iade ettiğimi onaylarım; bu bölüm ekipman BT departmanına teslim edildiğinde imzalanır.',
          46, y, { width: W, lineGap: 0.5, height: 22, ellipsis: true });
      y = doc.y + 6;

      const third = W / 3;
      infoField('Return Date / İade Tarihi', ' ', 46, third);
      infoField('Condition on Return / İade Durumu', ' ', 46 + third, third);
      infoField('Missing Items / Eksikler', ' ', 46 + third * 2, third);
      y += 30;
      sig(46, W / 2 - 10, 'Returned By (Employee)', 'İade Eden (Çalışan)', handover.employeeName, 'Signature / İmza', y);
      sig(46 + W / 2 + 10, W / 2 - 10, 'Received Back By (IT Department)', 'İade Teslim Alan (BT Departmanı)', ' ', 'Name & Signature / Ad ve İmza', y);
    }

    /* ---- optional footer note (kept inside the 46pt bottom margin so it never
       spills onto a 2nd page) ---- */
    if (tpl.footerNote) {
      doc.font('i').fontSize(7).fillColor('#555')
        .text(tpl.footerNote, 46, doc.page.height - 60, { width: W, height: 10, align: 'center', lineBreak: false });
    }
  });

  doc.end();
}

/** Renders the PDF to an in-memory Buffer (used for the document archive). */
function renderHandoverPdfBuffer(opts) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sink = new (require('stream').PassThrough)();
    sink.on('data', (c) => chunks.push(c));
    sink.on('end', () => resolve(Buffer.concat(chunks)));
    sink.on('error', reject);
    try {
      buildHandoverPdf(sink, opts);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildHandoverPdf, renderHandoverPdfBuffer };
