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

/** Streams a PDF for the given handover into `res`. */
function buildHandoverPdf(res, { handover, employee, settings, deliveredBy }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 46, left: 46, right: 46 } });
  doc.pipe(res);
  doc.registerFont('r', F.regular).registerFont('b', F.bold).registerFont('i', F.oblique);

  const W = doc.page.width - 92; // content width
  const items = handover.items || [];
  const groups = handover.documentType === 'separate' ? items.map((i) => [i]) : [items];
  const formNo = 'HF-' + String(handover.id || '').slice(0, 8).toUpperCase();

  groups.forEach((group, gi) => {
    if (gi > 0) doc.addPage();
    let y = 46;

    /* ---- header ---- */
    const logo = settings.companyLogo;
    if (logo && /^data:image\/(png|jpe?g);base64,/.test(logo)) {
      try {
        doc.image(Buffer.from(logo.split(',')[1], 'base64'), 46, y, { fit: [44, 44] });
      } catch { /* unsupported image — skip */ }
    } else {
      doc.rect(46, y, 44, 44).lineWidth(1).stroke('#111');
      doc.font('b').fontSize(20).fillColor('#111')
        .text((settings.companyName || 'A')[0].toUpperCase(), 46, y + 11, { width: 44, align: 'center' });
    }
    doc.font('b').fontSize(14).fillColor('#111')
      .text((settings.companyName || 'IT ASSET CONTROL PRO').toUpperCase(), 100, y + 2, { width: W - 260 });
    doc.font('r').fontSize(8).fillColor('#444')
      .text('IT Asset Control Pro — Asset Management', 100, doc.y + 2);

    doc.font('b').fontSize(12).fillColor('#111')
      .text('ASSET HANDOVER FORM', 46, y, { width: W, align: 'right' });
    doc.font('r').fontSize(10).text('(ZİMMET TUTANAĞI)', 46, doc.y + 1, { width: W, align: 'right' });
    doc.font('r').fontSize(8).fillColor('#333')
      .text(`Form ID: ${formNo}${groups.length > 1 ? '-' + (gi + 1) : ''}    Date: ${fmtDate(handover.transactionDate)}`,
        46, doc.y + 3, { width: W, align: 'right' });

    y = 112;
    doc.moveTo(46, y).lineTo(46 + W, y).lineWidth(1.6).stroke('#111');
    y += 14;

    /* ---- employee info ---- */
    const section = (title) => {
      doc.font('b').fontSize(9).fillColor('#111').text(title.toUpperCase(), 46, y, { width: W });
      y = doc.y + 3;
      doc.moveTo(46, y).lineTo(46 + W, y).lineWidth(0.7).stroke('#111');
      y += 8;
    };
    const infoField = (label, value, x, w) => {
      doc.font('r').fontSize(7).fillColor('#555').text(label, x, y, { width: w });
      doc.font('b').fontSize(9.5).fillColor('#111').text(value || '—', x, y + 10, { width: w, lineBreak: false });
      doc.moveTo(x, y + 24).lineTo(x + w - 14, y + 24).lineWidth(0.5).dash(1.5, { space: 1.5 }).stroke('#666').undash();
    };

    section('Receiving Employee Information');
    const half = W / 2;
    infoField('Full Name / Ad Soyad', handover.employeeName, 46, half);
    infoField('Employee ID / Sicil No', employee ? String(employee.id).slice(0, 8).toUpperCase() : '', 46 + half, half);
    y += 34;
    infoField('Department / Departman', employee && employee.department, 46, half);
    infoField('Position / Ünvan', employee && employee.title, 46 + half, half);
    y += 40;

    /* ---- equipment table ---- */
    section('Equipment Details / Ekipman Detayları');
    const cols = [
      { t: 'No', w: 24 }, { t: 'Category', w: 66 }, { t: 'Brand / Model', w: 138 },
      { t: 'Serial Number', w: 100 }, { t: 'MAC Address', w: 96 }, { t: 'Condition', w: W - 424 },
    ];
    const rowH = 20;
    const drawRow = (cells, opts = {}) => {
      let x = 46;
      cells.forEach((cell, ci) => {
        doc.rect(x, y, cols[ci].w, rowH).lineWidth(0.6).stroke('#444');
        if (opts.head) doc.rect(x, y, cols[ci].w, rowH).fill('#ecebf5').stroke('#444');
        doc.font(opts.head ? 'b' : 'r').fontSize(7.5).fillColor('#111')
          .text(String(cell ?? ''), x + 4, y + 6, { width: cols[ci].w - 8, height: rowH - 8, ellipsis: true, lineBreak: false });
        x += cols[ci].w;
      });
      y += rowH;
    };
    drawRow(cols.map((c) => c.t), { head: true });
    group.forEach((i, idx) =>
      drawRow([idx + 1, i.category || '—', `${i.brand} ${i.model}`, i.serialNumber, i.macAddress || 'N/A', i.conditionNote || 'New']));
    drawRow([group.length + 1, '', '', '', '', '']); // spare line
    y += 12;

    /* ---- terms ---- */
    section('Terms and Conditions / Şartlar ve Koşullar');
    const paras = String(settings.handoverTerms || '').split(/\n\s*\n/).filter((p) => p.trim());
    paras.forEach((p, i) => {
      doc.font(i === 0 ? 'r' : 'i').fontSize(7.5).fillColor('#222')
        .text(p.trim(), 46, y, { width: W, lineGap: 1.5 });
      y = doc.y + 5;
    });
    y += 6;

    /* ---- delivery signatures ---- */
    const sig = (x, w, topLabel, subLabel, name, underLabel) => {
      doc.font('r').fontSize(8).fillColor('#111').text(topLabel, x, y, { width: w, align: 'center' });
      doc.font('r').fontSize(7).fillColor('#555').text(subLabel, x, doc.y, { width: w, align: 'center' });
      const ly = y + 46;
      doc.moveTo(x + 14, ly).lineTo(x + w - 14, ly).lineWidth(0.8).stroke('#111');
      doc.font('b').fontSize(8.5).fillColor('#111').text(name || ' ', x, ly + 4, { width: w, align: 'center' });
      doc.font('r').fontSize(7).fillColor('#555').text(underLabel, x, doc.y + 1, { width: w, align: 'center' });
    };
    sig(46, W / 2 - 10, 'Delivered By (IT Department)', 'Teslim Eden (BT Departmanı)', deliveredBy || 'IT Department', 'IT Systems Administrator');
    sig(46 + W / 2 + 10, W / 2 - 10, 'Received By (Employee)', 'Teslim Alan (Çalışan)', handover.employeeName, 'Signature / İmza');
    y += 78;

    /* ---- return section (signed when the equipment comes back) ---- */
    section('Equipment Return / Ekipman İadesi');
    doc.font('r').fontSize(7.5).fillColor('#222')
      .text('I confirm that I returned the equipment listed above. This section is signed when the equipment is handed back to the IT department.',
        46, y, { width: W, lineGap: 1.5 });
    y = doc.y + 2;
    doc.font('i').fontSize(7.5)
      .text('Yukarıda listelenen ekipmanı iade ettiğimi onaylarım. Bu bölüm, ekipman BT departmanına teslim edildiğinde imzalanır.',
        46, y, { width: W, lineGap: 1.5 });
    y = doc.y + 10;

    const third = W / 3;
    infoField('Return Date / İade Tarihi', ' ', 46, third);
    infoField('Condition on Return / İade Durumu', ' ', 46 + third, third);
    infoField('Missing Items / Eksikler', ' ', 46 + third * 2, third);
    y += 40;
    sig(46, W / 2 - 10, 'Returned By (Employee)', 'İade Eden (Çalışan)', handover.employeeName, 'Signature / İmza');
    sig(46 + W / 2 + 10, W / 2 - 10, 'Received Back By (IT Department)', 'İade Teslim Alan (BT Departmanı)', ' ', 'Name & Signature / Ad ve İmza');
  });

  doc.end();
}

module.exports = { buildHandoverPdf };
