import ExcelJS from 'exceljs';

export async function messyStatementBytes() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Unsorted export').addRows([
    ['店名・摘要欄', '支出額（円）', '口座の表示', '処理された日', 'Credit +', '分類メモ', '備考欄'],
    ['Shinjuku clinic', '(¥1,250)', 'Demo Bnak', '2026年11月10日', '', 'Health Care', 'Receipt available'],
    ['Pay roll', '', ' demo bank ', 'Nov 11, 2026', '¥250,000', 'salery', 'November pay'],
    ['Train ticket', '¥850', 'Demo Cash', '13/11/2026', '', 'Trans-port', 'Trip'],
    ['Mystery charge', '¥300', 'Demo Cash', '2026-02-30', '', 'Unlisted label', 'Check line'],
    ['???', '?', '', '?', '?', '', ''],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const messyExtraction = {
  rows: [
    { sourceRow: 2, date: '2026-11-10', type: 'expense', title: 'Shinjuku clinic', amount: 1250,
      category: 'Health', accountLabel: 'Demo Bank', note: 'Receipt available', confidence: 0.98 },
    { sourceRow: 3, date: '2026-11-11', type: 'income', title: 'Payroll', amount: 250000,
      category: 'Salary', accountLabel: 'Demo Bank', note: 'November pay', confidence: 0.96 },
    { sourceRow: 4, date: '2026-11-13', type: 'expense', title: 'Train ticket', amount: 850,
      category: 'Transportation', accountLabel: 'Demo Cash', note: 'Trip', confidence: 0.6 },
    { sourceRow: 5, date: '2026-02-30', type: 'expense', title: 'Mystery charge', amount: 9803,
      category: 'Unlisted label', accountLabel: 'Demo Cash', note: 'Check line', confidence: 0.95 },
    { sourceRow: 999, date: '2026-11-14', type: 'expense', title: 'No source', amount: 1,
      category: 'Health', confidence: 1 },
  ],
  skipped: [{ sourceRow: 6, reason: 'unreadable' }],
};
