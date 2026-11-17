import { createHmac, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const font = fileURLToPath(new URL('../assets/NotoSansJP.ttf', import.meta.url));

export function signReport(report, userId) {
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(JSON.stringify(['labo-report', userId, report]))
    .digest('hex');
}

export function verifyReport(report, signature, userId) {
  return report && typeof signature === 'string' && /^[a-f0-9]{64}$/.test(signature)
    && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signReport(report, userId), 'hex'));
}

function csvCell(value) {
  if (typeof value === 'number') return String(value);
  const safe = /^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function reportCsv({ title, period, columns, rows }) {
  return '\uFEFF' + [[title, period], columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export async function reportPdf(report) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, font, info: { Title: report.title } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const finished = once(doc, 'end');
  doc.fillColor('#135844').fontSize(12).text('ProMoney');
  doc.moveDown(0.5).fillColor('#182820').fontSize(25).text(report.title);
  doc.fontSize(11).fillColor('#516359').text(`${report.period}  |  Figures by ProMoney engine`);
  doc.moveDown();
  doc.fontSize(12).fillColor('#182820');
  for (const [label, ...amounts] of report.rows) {
    const values = amounts.map((amount, i) =>
      `${report.columns[i + 1]}: ${amount.toLocaleString('ja-JP')}`).join('  |  ');
    const rowHeight = doc.heightOfString(label) + doc.heightOfString(values);
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.text(label);
    doc.fillColor('#516359').text(values);
    doc.moveDown(0.65).fillColor('#182820');
  }
  if (!report.hasData) doc.fontSize(11).text('Add records on the Transactions page to see activity here.');
  doc.end();
  await finished;
  return Buffer.concat(chunks);
}
