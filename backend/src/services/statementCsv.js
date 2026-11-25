import { iso, positiveYen } from './financeMath.js';

const HEADER_NAMES = {
  date: ['date', 'transactiondate', 'posteddate', 'postingdate', 'bookingdate', 'valuedate', '日付', '取引日', '取引日付', '利用日', 'ご利用日', '年月日'],
  note: ['description', 'transactiondescription', 'details', 'transactiondetails', 'memo', 'narrative', 'note', 'title', 'merchant', 'merchantname', 'payee', 'name', '内容', '取引内容', 'お取引内容', '摘要', '明細', '備考', '利用店名'],
  amount: ['amount', 'transactionamount', '金額', '取引金額', '利用金額', 'ご利用金額'],
  credit: ['moneyin', 'credit', 'creditamount', 'deposit', 'depositamount', '入金', '入金額', '預入金額', 'お預入れ金額', 'お預り金額', '受取金額'],
  debit: ['moneyout', 'debit', 'debitamount', 'withdrawal', 'withdrawals', 'withdrawalamount', '出金', '出金額', '引出金額', 'お引出し金額', 'お支払金額', '支払金額'],
  direction: ['direction', 'type', 'transactiontype', '入出金区分'],
  currency: ['currency', 'currencycode', '通貨', '通貨コード'],
  accountLabel: ['account', 'accountname', '口座', '口座名'],
  paymentMethod: ['paymentmethod', '支払方法', '決済方法'],
  categoryLabel: ['category', 'transactioncategory', 'カテゴリ', 'カテゴリー'],
  importNote: ['notes', 'notesscenario'],
};

const MAX_AMOUNT = 999_999_999_999;
const UNSUPPORTED_HEADER = 'I could not recognize the statement columns. Use Date, Description, and Amount, or Date, Description, Money In, and Money Out.';

export class StatementCsvError extends Error {
  code = 'STATEMENT_UNREADABLE';
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').trim();
}

export function findStatementColumns(headers) {
  const labels = headers.map((header) =>
    normalized(header).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').replace(/(?:jpy|円)$/, ''),
  );
  const columns = {};
  for (const [key, aliases] of Object.entries(HEADER_NAMES)) {
    const matches = labels.flatMap((label, index) => aliases.includes(label) ? [index] : []);
    if (matches.length > 1) return null;
    columns[key] = matches[0];
  }
  const splitAmount = columns.credit !== undefined || columns.debit !== undefined;
  if (columns.date === undefined || columns.note === undefined) return null;
  if (splitAmount) {
    return columns.credit !== undefined && columns.debit !== undefined && columns.amount === undefined
      ? columns
      : null;
  }
  return columns.amount !== undefined ? columns : null;
}

export function isStatementHeader(cells) {
  return findStatementColumns(cells) !== null;
}

function readRecords(text, delimiter) {
  const field = new RegExp(`(?:"((?:""|[^"])*)"|([^"${delimiter}\\r\\n]*))(${delimiter}|\\r\\n|\\r|\\n|$)`, 'y');
  const records = [];
  let record = [];
  let offset = 0;
  while (offset < text.length) {
    field.lastIndex = offset;
    const match = field.exec(text);
    if (!match) return null;
    const [, quoted, unquoted, separator] = match;
    record.push(quoted === undefined ? unquoted : quoted.replaceAll('""', '"'));
    offset = field.lastIndex;
    if (separator !== delimiter) {
      records.push(record);
      record = [];
    }
  }
  if (record.length) records.push([...record, '']);
  return records.filter((row) => row.some((cell) => cell.trim()));
}

function splitDate(value) {
  return /^(\d{1,2})([/-])(\d{1,2})\2([1-9]\d{3})$/.exec(normalized(value));
}

function explicitDateOrder(parts) {
  const [, first, , second] = parts;
  if (Number(first) > 12) return 'day-first';
  if (Number(second) > 12) return 'month-first';
  return null;
}

function statementDateOrder(records, column) {
  const orders = new Set();
  for (const record of records) {
    const parts = splitDate(record[column]);
    const order = parts && explicitDateOrder(parts);
    if (order) orders.add(order);
  }
  if (orders.size > 1) throw new StatementCsvError('The statement mixes different date formats. Use YYYY-MM-DD.');
  return orders.values().next().value;
}

class InvalidCalendarDate extends Error {}

function readCalendarDate(value) {
  try {
    return iso(value);
  } catch (error) {
    throw new InvalidCalendarDate(error.message);
  }
}

export function parseStatementDate(value, dateOrder) {
  const text = normalized(value);
  const yearFirst = /^([1-9]\d{3})([-/.])(\d{1,2})\2(\d{1,2})$/.exec(text);
  const japanese = /^([1-9]\d{3})年\s*(\d{1,2})月\s*(\d{1,2})日$/.exec(text);
  if (yearFirst || japanese) {
    const [, year, month, day] = japanese ?? [null, yearFirst[1], yearFirst[3], yearFirst[4]];
    return readCalendarDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  const parts = splitDate(text);
  const order = parts && (dateOrder ?? explicitDateOrder(parts));
  if (!order) throw new Error('date is invalid or ambiguous (use YYYY-MM-DD)');
  const [, first, , second, year] = parts;
  const [month, day] = order === 'month-first' ? [first, second] : [second, first];
  return readCalendarDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
}

export function parseSignedStatementAmount(value) {
  const text = normalized(value);
  if (!text || /^[-−—]$/.test(text)) return 0;
  const amountText = text
    .replace(/^\(([^+\-−]+)\)$/, '-$1')
    .replace(/^([+\-−△▲]?)\s*(?:¥|JPY)\s*/i, '$1')
    .replace(/\s*(?:円|JPY)$/i, '')
    .replace(/^[−△▲]/, '-');
  const match = /^([+-]?)\s*(\d+|\d{1,3}(?:,\d{3})+)(?:\.0+)?$/.exec(amountText);
  if (!match) throw new Error('amount must be whole JPY');
  const [, sign, digits] = match;
  const amount = Number(digits.replaceAll(',', ''));
  if (amount === 0) return 0;
  if (amount > MAX_AMOUNT) throw new Error('amount is too large');
  return (sign === '-' ? -1 : 1) * positiveYen(amount);
}

function readAmount(record, columns) {
  if (columns.amount === undefined) {
    const credit = parseSignedStatementAmount(record[columns.credit]);
    const debit = parseSignedStatementAmount(record[columns.debit]);
    if (credit < 0 || Boolean(credit) === Boolean(debit)) {
      throw new Error('exactly one of Money In or Money Out must contain an amount');
    }
    return credit || -Math.abs(debit);
  }
  const amount = parseSignedStatementAmount(record[columns.amount]);
  const direction = normalized(record[columns.direction]).toLowerCase();
  if (!direction) return amount;
  if (/^(expense|debit|withdrawal|money out|出金|支出)$/.test(direction)) return -Math.abs(amount);
  if (/^(income|credit|deposit|money in|入金|収入)$/.test(direction) && amount > 0) return amount;
  throw new Error('transaction direction is unsupported or disagrees with the amount');
}

function readTransaction(record, columns, dateOrder) {
  if (columns.currency !== undefined && !/^(JPY|¥|円)$/i.test(normalized(record[columns.currency]))) {
    throw new Error('currency must be JPY');
  }
  const note = record[columns.note].trim();
  if (!note) throw new Error('description is missing');
  const signedAmount = readAmount(record, columns);
  const amount = positiveYen(Math.abs(signedAmount));
  return {
    transaction_date: parseStatementDate(record[columns.date], dateOrder),
    note: note.slice(0, 150),
    kind: signedAmount < 0 ? 'expense' : 'income',
    amount,
    ...(columns.accountLabel !== undefined && { accountLabel: record[columns.accountLabel].trim() }),
    ...(columns.paymentMethod !== undefined && { paymentMethod: record[columns.paymentMethod].trim() }),
    ...(columns.categoryLabel !== undefined && { categoryLabel: record[columns.categoryLabel].trim() }),
    ...(columns.importNote !== undefined && { importNote: record[columns.importNote].trim().slice(0, 255) }),
  };
}

export function parseStatementTable([headers, ...records], { onInvalidRow, onParsedRow } = {}) {
  const columns = headers && findStatementColumns(headers);
  if (!columns) throw new StatementCsvError(UNSUPPORTED_HEADER);
  if (records.length === 0) throw new StatementCsvError('The statement contains no transaction rows.');
  const order = statementDateOrder(records, columns.date);
  return records.map((record, index) => {
    try {
      if (record.length !== headers.length) throw new Error('column count differs from the header');
      const row = readTransaction(record, columns, order);
      onParsedRow?.(index, row);
      return row;
    } catch (error) {
      if (onInvalidRow) {
        onInvalidRow(index, error.message, error instanceof InvalidCalendarDate);
        return null;
      }
      throw new StatementCsvError(`I could not import data row ${index + 1}: ${error.message}.`);
    }
  }).filter(Boolean);
}

export function parseStatementCsv(text) {
  const records = readStatementCsvRecords(text);
  if (records?.length && isStatementHeader(records[0])) return parseStatementTable(records);
  throw new StatementCsvError(UNSUPPORTED_HEADER);
}

export function readStatementCsvRecords(text) {
  if (typeof text !== 'string' || text.includes('\0')) {
    throw new StatementCsvError('I could not read the statement as CSV.');
  }
  const csv = text.replace(/^\uFEFF/, '');
  let best = [];
  for (const delimiter of [',', ';', '\t']) {
    const records = readRecords(csv, delimiter);
    if (!records?.length) continue;
    if (isStatementHeader(records[0])) return records;
    if (!best.length || structuredRows(records) > structuredRows(best)) best = records;
  }
  return best;
}

const structuredRows = (rows) => rows.filter((row) => row.length > 1).length;
