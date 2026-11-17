import { getDbPool } from '../db.js';
import {
  UserModel,
  hashPassword,
  validatePasswordPolicy,
  setCachedTokenVersion,
} from '../models/userModel.js';
import { DEFAULT_PREFERENCES } from '../models/settingsModel.js';
import { addMonthsISO, tokyoTodayISO } from './financeMath.js';

const pool = getDbPool();

export const DEMO_DISPLAY_NAME = 'Sample Demo Account';

export const DEMO_CATEGORIES = [
  { name: 'Part-time Salary', kind: 'income' },
  { name: 'Salary', kind: 'income' },
  { name: 'Freelance', kind: 'income' },
  { name: 'Allowance', kind: 'income' },
  { name: 'Other Income', kind: 'income' },
  { name: 'Housing', kind: 'expense' },
  { name: 'Groceries', kind: 'expense' },
  { name: 'Food & Dining', kind: 'expense' },
  { name: 'Transportation', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Phone & Internet', kind: 'expense' },
  { name: 'Education', kind: 'expense' },
  { name: 'Shopping', kind: 'expense' },
  { name: 'Healthcare', kind: 'expense' },
  { name: 'Entertainment', kind: 'expense' },
  { name: 'Other Expense', kind: 'expense' },
];

export function getDemoCredentials() {
  const email = String(process.env.DEMO_EMAIL || 'demo@promoney.local')
    .trim()
    .toLowerCase();
  const password = String(process.env.DEMO_PASSWORD || '');
  return { email, password };
}

function prevMonthISO(monthStr, delta) {
  const [y, m] = String(monthStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addDaysISO(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const padDay = (month, day) => `${month}-${String(day).padStart(2, '0')}`;

/**
 * Idempotently creates or resets ONLY the demo user (DEMO_EMAIL, default demo@promoney.local)
 * with the canonical sample dataset in TiDB. No other user's data is ever touched.
 */
export async function seedDemoAccount({ now = new Date() } = {}) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await runSeedDemoAccountOnce({ now });
    } catch (err) {
      const isTransient =
        err?.fatal ||
        err?.code === 'PROTOCOL_CONNECTION_LOST' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        /closed state|connection lost/i.test(String(err?.message || ''));
      if (attempt < 2 && isTransient) {
        continue;
      }
      throw err;
    }
  }
}

async function runSeedDemoAccountOnce({ now = new Date() } = {}) {
  const { email, password } = getDemoCredentials();
  if (!email) {
    throw new Error('DEMO_EMAIL is required in root .env');
  }
  const policyErr = validatePasswordPolicy(password, 'DEMO_PASSWORD');
  if (policyErr) {
    throw new Error(`Invalid DEMO_PASSWORD in root .env: ${policyErr}`);
  }

  const today = tokyoTodayISO(now);
  const m0 = today.slice(0, 7);
  const m1 = prevMonthISO(m0, -1);
  const m2 = prevMonthISO(m0, -2);
  const curDay = Number(today.slice(8, 10));
  const safeDay = (d) => padDay(m0, Math.max(1, Math.min(curDay, d)));

  const passwordHash = hashPassword(password);
  const existingUser = await UserModel.findByEmail(email);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let userId;
    if (!existingUser) {
      const [userRes] = await connection.execute(
        'INSERT INTO users (display_name, email, password_hash, google_sub, token_version) VALUES (?, ?, ?, NULL, 0)',
        [DEMO_DISPLAY_NAME, email, passwordHash]
      );
      userId = Number(userRes.insertId);
      setCachedTokenVersion(userId, 0);
    } else {
      userId = Number(existingUser.id);
      await connection.execute(
        'UPDATE users SET display_name = ?, password_hash = ?, google_sub = NULL WHERE id = ?',
        [DEMO_DISPLAY_NAME, passwordHash, userId]
      );
      setCachedTokenVersion(userId, existingUser.token_version ?? 0);
    }

    // Wipe ONLY the demo user's child rows (strictly scoped by user_id = ?)
    await connection.execute('DELETE FROM transactions WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM budgets WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM bills WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM goals WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM accounts WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM categories WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_settings WHERE user_id = ?', [userId]);

    // 1. Seed canonical categories
    const catPlaceholders = DEMO_CATEGORIES.map(() => '(?, ?, ?)').join(', ');
    const catParams = DEMO_CATEGORIES.flatMap((c) => [userId, c.name, c.kind]);
    await connection.execute(
      `INSERT INTO categories (user_id, name, kind) VALUES ${catPlaceholders}`,
      catParams
    );

    const [catRows] = await connection.execute(
      'SELECT id, name, kind FROM categories WHERE user_id = ?',
      [userId]
    );
    const catIdByName = new Map(catRows.map((r) => [r.name, Number(r.id)]));

    // 2. Seed canonical accounts (Sample Student Bank, Sample Wallet & IC, WISE, and linked WISE Master Card)
    const [bankRes] = await connection.execute(
      `INSERT INTO accounts (user_id, name, kind, manual_balance, currency, ui_details)
       VALUES (?, ?, ?, ?, 'JPY', ?)`,
      [
        userId,
        'Sample Student Bank',
        'bank',
        180000,
        JSON.stringify({
          group: 'bank',
          provider: 'Japan Post Bank',
          note: 'Sample main bank account',
        }),
      ]
    );
    const bankAccountId = Number(bankRes.insertId);

    const [cashRes] = await connection.execute(
      `INSERT INTO accounts (user_id, name, kind, manual_balance, currency, ui_details)
       VALUES (?, ?, ?, ?, 'JPY', ?)`,
      [
        userId,
        'Sample Wallet & IC',
        'cash',
        15000,
        JSON.stringify({
          group: 'cash',
          provider: '',
          note: 'Sample daily cash',
        }),
      ]
    );
    const cashAccountId = Number(cashRes.insertId);

    const [wiseRes] = await connection.execute(
      `INSERT INTO accounts (user_id, name, kind, manual_balance, currency, ui_details)
       VALUES (?, ?, ?, ?, 'JPY', ?)`,
      [
        userId,
        'WISE',
        'bank',
        63,
        JSON.stringify({
          group: 'app',
          provider: 'WISE',
          note: 'Sample multi-currency account',
        }),
      ]
    );
    const wiseAccountId = Number(wiseRes.insertId);

    const [wiseDebitRes] = await connection.execute(
      `INSERT INTO accounts (user_id, name, kind, manual_balance, currency, ui_details)
       VALUES (?, ?, ?, ?, 'JPY', ?)`,
      [
        userId,
        'WISE Master Card',
        'debit_card',
        0,
        JSON.stringify({
          group: 'debit',
          provider: 'WISE',
          parent_account_id: wiseAccountId,
          note: 'Linked debit card on WISE',
        }),
      ]
    );
    const wiseDebitAccountId = Number(wiseDebitRes.insertId);

    // 3. Batch-insert canonical 13 sample transactions
    const sampleTransactions = [
      {
        kind: 'income',
        amount: 115000,
        category: 'Part-time Salary',
        accountId: bankAccountId,
        date: padDay(m2, 25),
        title: 'Sample konbini part-time pay',
      },
      {
        kind: 'expense',
        amount: 48000,
        category: 'Housing',
        accountId: bankAccountId,
        date: padDay(m2, 27),
        title: 'Sample student apartment rent',
      },
      {
        kind: 'expense',
        amount: 22000,
        category: 'Groceries',
        accountId: cashAccountId,
        date: padDay(m2, 28),
        title: 'Sample supermarket groceries',
      },
      {
        kind: 'expense',
        amount: 6500,
        category: 'Transportation',
        accountId: cashAccountId,
        date: padDay(m2, 28),
        title: 'Sample commuter train pass',
      },
      {
        kind: 'income',
        amount: 122000,
        category: 'Part-time Salary',
        accountId: bankAccountId,
        date: padDay(m1, 25),
        title: 'Sample cafe part-time pay',
      },
      {
        kind: 'expense',
        amount: 48000,
        category: 'Housing',
        accountId: bankAccountId,
        date: padDay(m1, 26),
        title: 'Sample student apartment rent',
      },
      {
        kind: 'expense',
        amount: 24500,
        category: 'Groceries',
        accountId: cashAccountId,
        date: padDay(m1, 27),
        title: 'Sample monthly groceries',
      },
      {
        kind: 'expense',
        amount: 5800,
        category: 'Transportation',
        accountId: cashAccountId,
        date: padDay(m1, 28),
        title: 'Sample train IC recharge',
      },
      {
        kind: 'income',
        amount: 128000,
        category: 'Part-time Salary',
        accountId: bankAccountId,
        date: safeDay(1),
        title: 'Sample part-time salary',
      },
      {
        kind: 'expense',
        amount: 48000,
        category: 'Housing',
        accountId: bankAccountId,
        date: safeDay(2),
        title: 'Sample student apartment rent',
      },
      {
        kind: 'expense',
        amount: 8400,
        category: 'Groceries',
        accountId: cashAccountId,
        date: safeDay(3),
        title: 'Sample supermarket food',
      },
      {
        kind: 'expense',
        amount: 1850,
        category: 'Food & Dining',
        accountId: cashAccountId,
        date: safeDay(4),
        title: 'Sample campus cafeteria lunch',
      },
      {
        kind: 'expense',
        amount: 3200,
        category: 'Transportation',
        accountId: cashAccountId,
        date: safeDay(5),
        title: 'Sample train IC top-up',
      },
    ];

    const txPlaceholders = sampleTransactions.map(() => '(?, ?, NULL, ?, ?, ?, ?, ?, ?)').join(', ');
    const txParams = sampleTransactions.flatMap((tx) => [
      userId,
      tx.accountId,
      catIdByName.get(tx.category) || null,
      tx.kind,
      tx.title,
      tx.title,
      tx.amount,
      tx.date,
    ]);
    await connection.execute(
      `INSERT INTO transactions
         (user_id, account_id, to_account_id, category_id, kind, title, note, amount, transaction_date)
       VALUES ${txPlaceholders}`,
      txParams
    );

    // 4. Seed canonical sample budget (Groceries ¥25,000 for current month)
    const groceriesCatId = catIdByName.get('Groceries');
    if (groceriesCatId) {
      await connection.execute(
        `INSERT INTO budgets (user_id, category_id, budget_month, amount_limit)
         VALUES (?, ?, ?, ?)`,
        [userId, groceriesCatId, `${m0}-01`, 25000]
      );
    }

    // 5. Batch-insert canonical 3 sample bills
    const sampleBills = [
      {
        name: 'Sample Electricity & Gas',
        amount: 7200,
        dueDate: addDaysISO(today, 3),
        frequency: 'monthly',
        category: 'Utilities',
        isPaid: 0,
        notes: 'Sample utility bill',
      },
      {
        name: 'Sample Mobile & Fiber',
        amount: 3980,
        dueDate: addDaysISO(today, 12),
        frequency: 'monthly',
        category: 'Phone & Internet',
        isPaid: 0,
        notes: 'Sample student carrier plan',
      },
      {
        name: 'Sample Music Student Plan',
        amount: 580,
        dueDate: safeDay(2),
        frequency: 'monthly',
        category: 'Entertainment',
        isPaid: 1,
        notes: 'Sample monthly subscription',
      },
    ];

    const billPlaceholders = sampleBills.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const billParams = sampleBills.flatMap((bill) => [
      userId,
      bill.name,
      bill.amount,
      bill.dueDate,
      bill.category,
      bill.frequency,
      bill.isPaid,
      bill.notes,
    ]);
    await connection.execute(
      `INSERT INTO bills (user_id, name, amount, due_date, category, frequency, is_paid, notes)
       VALUES ${billPlaceholders}`,
      billParams
    );

    // 6. Seed canonical sample goal
    await connection.execute(
      `INSERT INTO goals (user_id, title, icon, target_amount, saved_amount, monthly_plan, target_date)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      [userId, 'Sample Graduation Laptop Fund', 180000, 65000, 20000, addMonthsISO(today, 6)]
    );

    // 7. Seed canonical user_settings
    await connection.execute(
      `INSERT INTO user_settings (user_id, preferences_json, avatar_data_url)
       VALUES (?, ?, NULL)`,
      [userId, JSON.stringify(DEFAULT_PREFERENCES)]
    );

    await connection.commit();
    return {
      userId,
      email,
      displayName: DEMO_DISPLAY_NAME,
      accounts: {
        bankAccountId,
        cashAccountId,
        wiseAccountId,
        wiseDebitAccountId,
      },
      counts: {
        categories: DEMO_CATEGORIES.length,
        accounts: 4,
        transactions: sampleTransactions.length,
        budgets: 1,
        bills: sampleBills.length,
        goals: 1,
      },
    };
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback error if connection already closed
    }
    throw err;
  } finally {
    connection.release();
  }
}
