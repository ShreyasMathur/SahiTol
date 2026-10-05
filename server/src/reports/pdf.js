import PdfPrinter from 'pdfmake';
import vfs from 'pdfmake/build/vfs_fonts.js';
import { COMPLIANCE } from '@nawi/shared';

const font = (name) => Buffer.from(vfs[name], 'base64');
const printer = new PdfPrinter({
  Roboto: {
    normal: font('Roboto-Regular.ttf'),
    bold: font('Roboto-Medium.ttf'),
    italics: font('Roboto-Italic.ttf'),
    bolditalics: font('Roboto-MediumItalic.ttf'),
  },
});

const COLORS = { ink: '#0f172a', muted: '#64748b', rule: '#cbd5e1', head: '#e2e8f0', brand: '#1e2c8a' };
const VERDICT_COLORS = {
  [COMPLIANCE.PASS]: { fill: '#dcfce7', text: '#166534' },
  [COMPLIANCE.FAIL]: { fill: '#fee2e2', text: '#991b1b' },
  [COMPLIANCE.PENDING]: { fill: '#f1f5f9', text: '#334155' },
};

const resultCell = (text) => ({
  text,
  bold: text === 'PASS' || text === 'FAIL',
  color: text === 'FAIL' ? '#b91c1c' : text === 'PASS' ? '#15803d' : COLORS.ink,
});

function table(headers, rows, { widths } = {}) {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? headers.map(() => '*'),
      body: [
        headers.map((h) => ({ text: h, style: 'th' })),
        ...rows.map((r) => r.map((cell, i) => (i === r.length - 1 && headers[i] === 'Result' ? resultCell(cell) : { text: cell }))),
      ],
    },
    layout: {
      fillColor: (row) => (row === 0 ? COLORS.head : null),
      hLineColor: () => COLORS.rule,
      vLineColor: () => COLORS.rule,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 2, 0, 8],
  };
}

/** Two label/value pairs per row. */
function fieldGrid(fields) {
  const body = [];
  for (let i = 0; i < fields.length; i += 2) {
    const [a, b = ['', '']] = [fields[i], fields[i + 1]];
    body.push([{ text: a[0], style: 'label' }, a[1], { text: b[0], style: 'label' }, b[1]]);
  }
  return { table: { widths: [90, '*', 90, '*'], body }, layout: 'noBorders', margin: [0, 0, 0, 8] };
}

const heading = (text) => ({ text, style: 'h2' });

function signatureBlock(sig) {
  return {
    width: '*',
    stack: [
      { text: sig.heading, style: 'label' },
      sig.image ? { image: sig.image, fit: [160, 50], margin: [0, 4, 0, 0] } : { text: sig.name ? '' : ' ', margin: [0, 30, 0, 0] },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 200, y2: 2, lineWidth: 0.5, lineColor: COLORS.muted }] },
      { text: sig.name ?? 'Not signed', bold: true, margin: [0, 3, 0, 0] },
      sig.role ? { text: sig.role.charAt(0).toUpperCase() + sig.role.slice(1), color: COLORS.muted } : '',
      sig.signedAt ? { text: `Electronically signed ${sig.signedAt}`, color: COLORS.muted, fontSize: 7.5 } : '',
    ],
  };
}

function photoGrid(photos) {
  const rows = [];
  for (let i = 0; i < photos.length; i += 2) {
    rows.push({
      columns: photos.slice(i, i + 2).map((p) => ({
        width: '50%',
        stack: [
          { image: p.dataUrl, fit: [235, 170], alignment: 'center' },
          { text: p.caption, alignment: 'center', color: COLORS.muted, margin: [0, 3, 0, 0] },
        ],
      })),
      columnGap: 12,
      margin: [0, 0, 0, 10],
    });
  }
  return rows;
}

export function reportDocDefinition(model) {
  const verdictColor = VERDICT_COLORS[model.verdict.status] ?? VERDICT_COLORS[COMPLIANCE.PENDING];

  const content = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: model.labName, color: COLORS.muted },
            { text: model.title, style: 'h1' },
            { text: model.subtitle, color: COLORS.muted, margin: [0, 0, 0, 6] },
            fieldGrid([
              ['Report no.', model.referenceNo],
              ['Revision', String(model.revision)],
              ['Date of issue', model.issuedAt ?? 'Not issued'],
              ['Status', model.status],
            ]),
          ],
        },
        model.verifyUrl
          ? { width: 90, stack: [{ qr: model.verifyUrl, fit: 86 }, { text: 'Scan to verify', fontSize: 7, color: COLORS.muted, alignment: 'center' }] }
          : { width: 0, text: '' },
      ],
    },
    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: `Overall result: ${model.verdict.label}`, bold: true, fontSize: 12, color: verdictColor.text },
            { text: model.verdict.text, color: verdictColor.text },
          ],
          fillColor: verdictColor.fill,
          margin: [8, 6, 8, 6],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 4, 0, 10],
    },
    ...model.fieldSections.flatMap((s) => [heading(s.title), fieldGrid(s.fields)]),
    heading(model.weights.title),
    model.weights.sets.rows.length ? table(model.weights.sets.headers, model.weights.sets.rows) : { text: 'No reference weights recorded.', margin: [0, 0, 0, 6] },
    model.weights.loads.rows.length ? table(model.weights.loads.headers, model.weights.loads.rows) : '',
    { text: model.weights.note, color: COLORS.muted, margin: [0, 0, 0, 8] },
    heading(model.summary.title),
    table(model.summary.headers, model.summary.rows, { widths: ['*', '*', 70] }),
    heading('7. Observations'),
    ...model.tests.flatMap((t, i) => [
      { text: `7.${i + 1} ${t.title}`, style: 'h3' },
      { text: `${t.reference} — Result: ${model.summary.rows[i][2]}`, color: COLORS.muted, margin: [0, 0, 0, 3] },
      ...t.lines.map((line) => ({ text: line, margin: [0, 0, 0, 2] })),
      ...t.tables.map((tb) => table(tb.headers, tb.rows)),
    ]),
  ];

  if (model.remarks) content.push(heading('Remarks'), { text: model.remarks, margin: [0, 0, 0, 8] });
  if (model.photos.length) content.push({ ...heading('8. Photographs'), pageBreak: 'before' }, ...photoGrid(model.photos));
  content.push({
    unbreakable: true,
    stack: [
      heading(model.photos.length ? '9. Authorisation' : '8. Authorisation'),
      { columns: model.signatures.map(signatureBlock), columnGap: 30, margin: [0, 4, 0, 0] },
    ],
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 55],
    info: { title: `Test report ${model.referenceNo}`, subject: 'OIML R 76 test report' },
    ...((model.draft || model.sample) && {
      watermark: { text: model.sample ? 'SAMPLE DATA — NOT VALID' : 'DRAFT — NOT VALID', color: '#b91c1c', opacity: 0.1, bold: true, angle: -45 },
    }),
    header: () => ({
      columns: [
        { text: model.labName, color: COLORS.muted, fontSize: 7.5 },
        { text: `${model.referenceNo} · Rev ${model.revision}`, alignment: 'right', color: COLORS.muted, fontSize: 7.5 },
      ],
      margin: [40, 22, 40, 0],
    }),
    footer: (page, count) => ({
      columns: [
        {
          text: model.recordHash ? `Record fingerprint (SHA-256): ${model.recordHash}` : 'Draft — not signed or fingerprinted',
          fontSize: 6.5,
          color: COLORS.muted,
        },
        { text: `Page ${page} of ${count}`, alignment: 'right', width: 60, fontSize: 7.5, color: COLORS.muted },
      ],
      margin: [40, 20, 40, 0],
    }),
    content,
    styles: {
      h1: { fontSize: 18, bold: true, color: COLORS.brand },
      h2: { fontSize: 11, bold: true, color: COLORS.brand, margin: [0, 8, 0, 4] },
      h3: { fontSize: 10, bold: true, margin: [0, 6, 0, 1] },
      th: { bold: true, fontSize: 8 },
      label: { color: COLORS.muted },
    },
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: COLORS.ink, lineHeight: 1.15 },
  };
}

export function renderPdf(model) {
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(reportDocDefinition(model));
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
