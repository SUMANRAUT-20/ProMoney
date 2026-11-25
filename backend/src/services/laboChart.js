import { createCanvas } from '@napi-rs/canvas';

const width = 800;
const rowHeight = 49;
const labelWidth = 245;
const maximumRows = 10;
const yen = (value) => `¥${value.toLocaleString('ja-JP')}`;

export function requestsSpendingChart(question) {
  const text = question.normalize('NFKC').trim();
  if (/^(?:please\s+)?(?:graph|chart)\s+banai\s*deu[.!?\s]*$/i.test(text)) return true;
  if (/^(?:(?:show|make|display|download)(?: me)? (?:the |a )?)?(?:spending|expense|category breakdown) (?:chart|graph)(?: this month)?[.!?\s]*$/i.test(text)) return true;
  const action = /\b(?:show|see|draw|plot|visuali[sz]e|make|create|display|download)\b|\b(?:chart|graph) (?:my|our)\b|見せ|作って|グラフに/i;
  const subject = /\b(?:my|our)\b.*\b(?:spending|expenses?|outgoings?|category breakdown)\b|支出/i;
  return action.test(text) && subject.test(text) && /\b(?:chart|graph|plot|visuali[sz]e)\b|グラフ/i.test(text);
}

function drawRows(context, rows) {
  const largest = rows[0][1];
  rows.forEach(([category, amount], index) => {
    const top = 134 + index * rowHeight;
    context.fillStyle = '#253933';
    context.font = '18px sans-serif';
    context.fillText(category, 28, top + 15, labelWidth - 12);
    context.fillStyle = '#e7efeb';
    context.fillRect(284, top, 335, 20);
    context.fillStyle = '#087e57';
    context.fillRect(284, top, 335 * (amount / largest), 20);
    context.fillStyle = '#192e26';
    context.font = '600 18px sans-serif';
    context.textAlign = 'right';
    context.fillText(yen(amount), width - 28, top + 16);
    context.textAlign = 'left';
  });
}

function renderChart(report, total, rows) {
  const height = 152 + rows.length * rowHeight;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#f7fbf9';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#123b2d';
  context.font = 'bold 32px sans-serif';
  context.fillText(report.title, 28, 49);
  context.fillStyle = '#476459';
  context.font = '20px sans-serif';
  context.fillText(`${report.period}  ·  Total ${yen(total)}`, 28, 84);
  drawRows(context, rows);
  if (rows.length < report.rows.length - 1) {
    context.font = '15px sans-serif';
    context.fillStyle = '#476459';
    context.fillText(`Top ${rows.length} categories shown · total includes all categories`, 28, height - 18);
  }
  return { height, dataUrl: `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}` };
}

export function spendingChartReply(report) {
  if (!report.hasData) return { answer: `There’s no spending to chart for ${report.period}. Add expenses on Transactions first.` };
  const total = report.rows.at(-1)[1];
  const rows = report.rows.slice(0, -1).slice(0, maximumRows);
  const [category, highest] = rows[0];
  return {
    answer: `Spending by category for ${report.period} totaled ${yen(total)}. ${category} was the largest category at ${yen(highest)}.`,
    chart: {
      ...renderChart(report, total, rows), width,
      alt: `Horizontal bar chart of category spending for ${report.period}`,
      filename: `promoney-spending-${report.period}.png`,
    },
  };
}
