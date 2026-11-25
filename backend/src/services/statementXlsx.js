import ExcelJS from 'exceljs';
import { findStatementColumns, StatementCsvError } from './statementCsv.js';
import { inspectStatementTable, statementSheetSummary } from './statementTables.js';

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

function isAggregateHeader(cells) {
  const labels = cells.map((cell) => cell.normalize('NFKC').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase());
  return labels.some((label) => /^(?:month|period|quarter|year|月|期間)$/.test(label)) &&
    labels.some((label) => /^(?:income|収入)$/.test(label)) &&
    labels.some((label) => /^(?:expenses?|支出)$/.test(label)) &&
    labels.some((label) => /^(?:surplus|net|transactions|transaction count|収支|件数)$/.test(label));
}

function worksheetTable(sheet) {
  const entries = [];
  let headerAt = -1;
  let matched;
  sheet.eachRow((row) => {
    if (!matched) {
      const cells = Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text);
      const columns = findStatementColumns(cells);
      if (columns) {
        headerAt = entries.length;
        matched = Object.values(columns).filter((index) => index !== undefined);
      }
      entries.push({ number: row.number, cells: matched ? matched.map((index) => cells[index]) : cells });
      return;
    }
    const sourceCells = matched.map((index) => row.getCell(index + 1));
    try {
      const cells = sourceCells.map(cellText);
      if (cells.some((cell) => cell.trim())) entries.push({ number: row.number, cells });
    } catch (error) {
      entries.push({ number: row.number, cells: sourceCells.map((cell) => cell.text), error: error.message });
    }
  });
  if (headerAt < 0 && entries.some(({ cells }) => isAggregateHeader(cells))) {
    return inspectStatementTable(sheet.name, []);
  }
  return inspectStatementTable(sheet.name, entries, { headerAt });
}

export async function inspectStatementXlsx(bytes) {
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
  return workbook.worksheets.map(worksheetTable);
}

export async function parseStatementXlsx(bytes, { onWarning = () => {}, onSheet = () => {} } = {}) {
  const warnings = [];
  const rows = (await inspectStatementXlsx(bytes)).flatMap((sheet) => {
    const legacySheet = sheet.headerMatched ? sheet : { ...sheet, data: [], failures: new Map() };
    onSheet(statementSheetSummary(legacySheet));
    for (const [number, reason] of legacySheet.failures) {
      const message = `${sheet.name}, row ${number} was excluded: ${reason}.`;
      warnings.push(message);
      onWarning(message);
    }
    return [...sheet.rows.values()];
  });
  if (!rows.length) {
    throw new StatementCsvError(warnings.length
      ? 'I couldn’t read any valid transactions. ' + warnings.join('\n')
      : 'I couldn’t read any transactions from this workbook. No populated table with Date, Description, and Amount columns was found.');
  }
  if (rows.length > 1000) throw new StatementCsvError('Split this statement into files of at most 1,000 transactions.');
  return rows;
}
