import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import QRCode from 'qrcode';
import { COMPLIANCE } from '@nawi/shared';

const FONT = 'Calibri';
const SIZE = 18; // half-points

function decodeDataUrl(dataUrl) {
  const [, mime, b64] = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/) ?? [];
  return mime ? { type: mime === 'jpeg' ? 'jpg' : 'png', data: Buffer.from(b64, 'base64') } : null;
}

/** Pixel size from a PNG or JPEG header, so images keep their aspect ratio. */
function imageSize({ type, data }) {
  if (type === 'png') return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  let i = 2;
  while (i < data.length) {
    const marker = data[i + 1];
    const len = data.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: data.readUInt16BE(i + 7), height: data.readUInt16BE(i + 5) };
    }
    i += 2 + len;
  }
  return { width: 400, height: 300 };
}

function image(dataUrl, maxW, maxH) {
  const img = decodeDataUrl(dataUrl);
  if (!img) return null;
  const { width, height } = imageSize(img);
  const scale = Math.min(maxW / width, maxH / height, 1);
  return new ImageRun({ type: img.type, data: img.data, transformation: { width: Math.round(width * scale), height: Math.round(height * scale) } });
}

const text = (t, opts = {}) => new TextRun({ text: t, font: FONT, size: SIZE, ...opts });
const para = (t, opts = {}, runOpts = {}) => new Paragraph({ children: [text(t, runOpts)], spacing: { after: 60 }, ...opts });
const heading = (t, level = HeadingLevel.HEADING_2) => new Paragraph({ text: t, heading: level, spacing: { before: 200, after: 80 } });

function cell(content, { header = false, bold = false, color, width } = {}) {
  return new TableCell({
    children: [new Paragraph({ children: [text(content, { bold: header || bold, color })] })],
    shading: header ? { type: ShadingType.CLEAR, fill: 'E2E8F0', color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    ...(width && { width: { size: width, type: WidthType.PERCENTAGE } }),
  });
}

const resultColor = (t) => (t === 'FAIL' ? 'B91C1C' : t === 'PASS' ? '15803D' : undefined);

function table(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, { header: true })) }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) =>
              headers[i] === 'Result' ? cell(c, { bold: true, color: resultColor(c) }) : cell(c),
            ),
          }),
      ),
    ],
  });
}

function fieldTable(fields) {
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) {
    const [a, b = ['', '']] = [fields[i], fields[i + 1]];
    rows.push(
      new TableRow({
        children: [cell(a[0], { color: '64748B', width: 20 }), cell(a[1], { width: 30 }), cell(b[0], { color: '64748B', width: 20 }), cell(b[1], { width: 30 })],
      }),
    );
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

const spacer = () => new Paragraph({ children: [], spacing: { after: 80 } });

export async function renderDocx(model) {
  const verdictColor = model.verdict.status === COMPLIANCE.PASS ? '166534' : model.verdict.status === COMPLIANCE.FAIL ? '991B1B' : '334155';
  const children = [];

  if (model.verifyUrl) {
    const qr = await QRCode.toBuffer(model.verifyUrl, { width: 240, margin: 1 });
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: 'png', data: qr, transformation: { width: 90, height: 90 } })] }));
  }
  children.push(
    para(model.labName, {}, { color: '64748B' }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [text(model.title, { size: 40, bold: true, color: '1E2C8A' })] }),
    para(model.subtitle, {}, { color: '64748B' }),
  );
  if (model.sample) children.push(para('SAMPLE DATA — NOT VALID AS A TEST REPORT', {}, { bold: true, color: 'B91C1C' }));
  else if (model.draft) children.push(para('DRAFT — NOT VALID AS A TEST REPORT', {}, { bold: true, color: 'B91C1C' }));
  children.push(
    fieldTable([
      ['Report no.', model.referenceNo],
      ['Revision', String(model.revision)],
      ['Date of issue', model.issuedAt ?? 'Not issued'],
      ['Status', model.status],
    ]),
    spacer(),
    para(`Overall result: ${model.verdict.label}`, {}, { bold: true, size: 24, color: verdictColor }),
    para(model.verdict.text, {}, { color: verdictColor }),
  );

  for (const s of model.fieldSections) children.push(heading(s.title), fieldTable(s.fields));

  children.push(heading(model.weights.title));
  if (model.weights.sets.rows.length) children.push(table(model.weights.sets.headers, model.weights.sets.rows), spacer());
  if (model.weights.loads.rows.length) children.push(table(model.weights.loads.headers, model.weights.loads.rows), spacer());
  children.push(para(model.weights.note, {}, { color: '64748B' }));

  children.push(heading(model.summary.title), table(model.summary.headers, model.summary.rows), heading('7. Observations'));
  model.tests.forEach((t, i) => {
    children.push(heading(`7.${i + 1} ${t.title}`, HeadingLevel.HEADING_3), para(`${t.reference} — Result: ${model.summary.rows[i][2]}`, {}, { color: '64748B' }));
    for (const line of t.lines) children.push(para(line));
    for (const tb of t.tables) children.push(table(tb.headers, tb.rows), spacer());
  });

  if (model.remarks) children.push(heading('Remarks'), para(model.remarks));

  if (model.photos.length) {
    children.push(heading('8. Photographs'));
    for (const p of model.photos) {
      const img = image(p.dataUrl, 420, 300);
      if (img) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [img] }));
      children.push(para(p.caption, { alignment: AlignmentType.CENTER }, { color: '64748B' }));
    }
  }

  children.push(heading(model.photos.length ? '9. Authorisation' : '8. Authorisation'));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: model.signatures.map((sig) => {
            const img = sig.image ? image(sig.image, 180, 60) : null;
            return new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                para(sig.heading, {}, { color: '64748B' }),
                new Paragraph({ children: img ? [img] : [text(' ')] , spacing: { after: 60 } }),
                para(sig.name ?? 'Not signed', {}, { bold: true }),
                para(sig.role ? sig.role.charAt(0).toUpperCase() + sig.role.slice(1) : ''),
                para(sig.signedAt ? `Electronically signed ${sig.signedAt}` : '', {}, { color: '64748B', size: 16 }),
              ],
            });
          }),
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: model.labName,
    title: `Test report ${model.referenceNo}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
        headers: {
          default: new Header({ children: [para(`${model.labName} · ${model.referenceNo} · Rev ${model.revision}`, { alignment: AlignmentType.RIGHT }, { size: 14, color: '64748B' })] }),
        },
        footers: {
          default: new Footer({
            children: [
              para(model.recordHash ? `Record fingerprint (SHA-256): ${model.recordHash}` : 'Draft — not signed or fingerprinted', {}, { size: 12, color: '64748B' }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 14, color: '64748B' })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
