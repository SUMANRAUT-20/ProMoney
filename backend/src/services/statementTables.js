import { findStatementColumns, parseStatementTable, StatementCsvError } from './statementCsv.js';

const DATE_SHAPE = /(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{2,4}年.*\d{1,2}月|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[ .]+\d{1,2}\b|\b\d{1,2}[ -](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/i;
const DATE_HEADING = /\b(?:date|posted|when)\b|日付|取引日|処理.*日/i;
const AMOUNT_HEADING = /\b(?:amount|withdrawal|deposit|debit|credit|paid|received)\b|金額|入金|出金|支出額/i;

export function looksLikeStatementData(cells) {
  return cells.some((cell, index) => DATE_SHAPE.test(cell.normalize('NFKC')) &&
    (cells.some((value, other) => index !== other && /\d/.test(value.normalize('NFKC'))) || /[¥円]/.test(cell)));
}

function looksLikeStatementHeader(cells) {
  return cells.some((cell, index) => cell.length <= 64 && DATE_HEADING.test(cell) &&
    cells.some((other, column) => index !== column && other.length <= 64 && AMOUNT_HEADING.test(other)));
}

export function inspectStatementTable(name, entries, { headerAt, firstData } = {}) {
  headerAt ??= entries.findIndex(({ cells }) => findStatementColumns(cells));
  const headerMatched = headerAt >= 0;
  if (headerMatched) firstData = headerAt + 1;
  firstData ??= entries.findIndex(({ cells }) => looksLikeStatementData(cells));
  const preceding = firstData < 0 ? entries : entries.slice(0, firstData);
  const likelyHeader = headerMatched ? headerAt : preceding.findLastIndex(({ cells }) => looksLikeStatementHeader(cells));
  const lastHeader = likelyHeader >= 0 ? likelyHeader
    : preceding.findLastIndex(({ cells }) => cells.filter(Boolean).length > 1);
  if (likelyHeader >= 0) firstData = likelyHeader + 1;
  const balanceOnly = !headerMatched && entries[lastHeader]?.cells.length <= 3 &&
    entries[lastHeader].cells.some((cell) => /^(?:balance|残高)$/i.test(cell.trim()));
  const data = firstData < 0 || balanceOnly ? [] : entries.slice(firstData);
  if (data.length > 1000) {
    throw new StatementCsvError('Split this statement into files of at most 1,000 transactions.');
  }
  const headers = lastHeader < 0 ? [] : entries.slice(Math.max(0, lastHeader - 2), lastHeader + 1);
  const rows = new Map();
  const failures = new Map();
  if (headerMatched && data.length) parseCodeRows(entries[headerAt].cells, data, rows, failures);
  if (!headerMatched) {
    for (const { number } of data) failures.set(number, 'Unrecognized transaction columns');
  }
  return { name, headerMatched, headers, data, rows, failures };
}

function parseCodeRows(header, data, rows, failures) {
  try {
    parseStatementTable([header, ...data.map(({ cells }) => cells)], {
      onParsedRow: (index, row) => rows.set(data[index].number, row),
      onInvalidRow: (index, reason) => failures.set(data[index].number, reason),
    });
  } catch (error) {
    if (!(error instanceof StatementCsvError)) throw error;
    for (const { number, cells } of data) {
      parseStatementTable([header, cells], {
        onParsedRow: (_, row) => rows.set(number, row),
        onInvalidRow: (_, reason) => failures.set(number, reason),
      });
    }
  }
  for (const { number, error } of data) {
    if (!error) continue;
    rows.delete(number);
    failures.set(number, error);
  }
}

export function statementSheetSummary(sheet, failures = sheet.failures) {
  const reasons = new Map();
  for (const reason of failures.values()) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  return {
    name: sheet.name, found: sheet.data.length, skipped: failures.size,
    reasons: [...reasons].map(([reason, count]) => ({ reason, count })),
    note: !sheet.data.length ? (sheet.headerMatched ? 'No transaction rows' : 'No transaction table') : null,
  };
}
