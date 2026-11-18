import ExcelJS from 'exceljs';
import { isStatementHeader, parseStatementTable, StatementCsvError } from './statementCsv.js';

function cellText(cell) {
  const value = cell.value;
  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) throw new StatementCsvError('The Excel statement contains an invalid date.');
    return value.toISOString().slice(0, 10);
  }
  if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value) && value.result === undefined) {
    throw new StatementCsvError('The Excel statement contains a formula without a saved result. Save it in Excel before uploading.');
  }
  return cell.text;
}

function firstSheetTable(sheet) {
  if (!sheet) throw new StatementCsvError('The XLSX statement has no first worksheet.');
  const table = [];
  sheet.eachRow((row) => {
    const cells = Array.from({ length: row.cellCount }, (_, index) => cellText(row.getCell(index + 1)));
    while (cells.length && !cells.at(-1).trim()) cells.pop();
    if (!cells.some((cell) => cell.trim())) return;
    if (!table.length) {
      if (isStatementHeader(cells)) table.push(cells);
      return;
    }
    if (table.length > 1000) {
      throw new StatementCsvError('Split this statement into files of at most 1,000 transactions.');
    }
    while (cells.length < table[0].length) cells.push('');
    table.push(cells);
  });
  return parseStatementTable(table);
}

export async function parseStatementXlsx(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.subarray(0, 4).toString('hex') !== '504b0304') {
    throw new StatementCsvError('Upload an XLSX workbook. Older XLS files are unsupported. Save the file as .xlsx first.');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes, {
      ignoreNodes: ['mergeCells', 'dataValidations', 'conditionalFormatting', 'drawing', 'picture', 'extLst'],
    });
  } catch {
    throw new StatementCsvError('I could not read this XLSX workbook. Upload an unlocked .xlsx file or export it as CSV.');
  }
  return firstSheetTable(workbook.worksheets[0]);
}
