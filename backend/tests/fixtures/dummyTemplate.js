import ExcelJS from 'exceljs';

export async function dummyTemplateBytes({ invalidDate = true } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('START HERE').addRows([
    ['ProMoney  |  Demo Data Workbook'], [], [], ['PURPOSE', 'One tab per month.'],
  ]);
  workbook.addWorksheet('REFERENCE LISTS').addRows([
    ['Suggested categories & accounts'], [], [],
    ['Income Categories', 'Expense Categories', 'Accounts', 'Payment Methods', 'Transaction Types'],
  ]);
  for (const [name, date, description, amount] of [
    ['01 Jan', '2026-01-01', 'Monthly rent', 40000],
    ['02 Feb', '2026-02-25', 'Salary', 75000],
    ['12 Dec', null, null, null],
  ]) {
    const sheet = workbook.addWorksheet(name);
    sheet.mergeCells('A1:H2');
    sheet.getCell('A1').value = 'ProMoney / Demo Transactions';
    sheet.getCell('A3').value = 'ENTER FICTIONAL DATA ONLY';
    sheet.getCell('J4').value = 'MONTHLY CHECK';
    sheet.getRow(5).values = [
      'Date', 'Type', 'Category', 'Account', 'Description', 'Amount (JPY)', 'Payment Method', 'Notes / Scenario',
      null, 'Income', { formula: 'SUMIF(B6:B155,"Income",F6:F155)' },
    ];
    if (date) sheet.getRow(6).values = [
      new Date(date + 'T00:00:00Z'), name === '01 Jan' ? 'Expense' : 'Income',
      'Rent', 'Demo Bank', description, amount, 'Bank Transfer', null, null,
      'Expenses', { formula: 'SUMIF(B6:B155,"Expense",F6:F155)' },
    ];
    if (name === '02 Feb' && invalidDate) sheet.getRow(16).values = [
      '            2026-02-30', 'Expense', 'Utilities', 'Demo Cash', 'Electricity Bill', 5000, 'Cash',
    ];
  }
  workbook.addWorksheet('YEAR SUMMARY').getCell('B5').value = { formula: "'01 Jan'!K5" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
