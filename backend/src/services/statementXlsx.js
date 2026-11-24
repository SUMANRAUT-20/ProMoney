import ExcelJS from 'exceljs';
import { findStatementColumns, parseStatementTable, StatementCsvError } from './statementCsv.js';

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

function worksheetTable(sheet, { onWarning, onSheet }) {
  const table = [];
  const rowNumbers = [];
  let matched;
  sheet.eachRow((row) => {
    if (!matched) {
      const headers = Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text);
      const columns = findStatementColumns(headers);
      if (columns) {
        matched = Object.entries(columns).filter(([, index]) => index !== undefined);
        table.push(matched.map(([, index]) => headers[index]));
      }
      return;
    }
    const cells = matched.map(([, index]) => cellText(row.getCell(index + 1)));
    if (!cells.some((cell) => cell.trim())) return;
    if (table.length > 1000) {
      throw new StatementCsvError('Split this statement into files of at most 1,000 transactions.');
    }
    table.push(cells);
    rowNumbers.push(row.number);
  });
  console.info('[LA-BO XLSX]', {
    sheet: sheet.name,
    headersMatched: matched?.map(([field, column], index) => ({
      field, column: column + 1, header: table[0][index],
    })) ?? [],
    rowsFound: Math.max(0, table.length - 1),
  });
  const reasons = new Map();
  const found = Math.max(0, table.length - 1);
  const rows = found ? parseStatementTable(table, {
    onInvalidRow: (index, reason) => {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      onWarning(`${sheet.name}, row ${rowNumbers[index]} was excluded: ${reason}.`);
    },
  }) : [];
  onSheet({
    name: sheet.name, found, skipped: found - rows.length,
    reasons: [...reasons].map(([reason, count]) => ({ reason, count })),
    note: !matched ? 'No transaction table' : !found ? 'No transaction rows' : null,
  });
  return rows;
}

export async function parseStatementXlsx(bytes, { onWarning = () => {}, onSheet = () => {} } = {}) {
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
  const warnings = [];
  const rows = workbook.worksheets.flatMap((sheet) => worksheetTable(sheet, {
    onSheet,
    onWarning: (message) => {
      warnings.push(message);
      onWarning(message);
    },
  }));
  if (!rows.length) {
    throw new StatementCsvError(warnings.length
      ? 'I couldn’t read any valid transactions. ' + warnings.join('\n')
      : 'I couldn’t read any transactions from this workbook. No populated table with Date, Description, and Amount columns was found.');
  }
  if (rows.length > 1000) throw new StatementCsvError('Split this statement into files of at most 1,000 transactions.');
  return rows;
}
