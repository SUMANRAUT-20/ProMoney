# ProMoney — Two-Layer Constitution v2 (Best of Three)

Merged on 2026-11-13 from three sources:
**[M]** Munna's Rulebook v1 (Suman's own design decisions) ·
**[C]** ChatGPT Master Specification (PF-numbered rules) ·
**[A]** Antigravity's two-layer review.

Rule of the house: **[M] is the constitution and always wins.** [C] and [A]
contributed only the additions marked below. Everything not in this file
is out of scope until Suman writes it in — *rule first, code second.*

Currency: **JPY only**, whole-yen integers, no floating-point money.

---

## Part I — Layer 1: The Engine [M] (unchanged from v1)

### A. Core principles
- **A1.** Money never appears or disappears without a record.
- **A2.** Balances are always calculated from records, never typed in.
  Corrections happen through an Adjustment record (F4).
- **A3.** One finance core (`financeMath`) computes every figure. Pages,
  reports and LA-BO read from it; nothing else does maths.
- **A4.** No double-counting, ever.
- **A5.** Every record belongs to exactly one user; a user only ever
  sees their own data.
- **A6.** Edits/deletes are allowed; all figures recalculate from
  records, so history stays consistent.

### B. Accounts — assets and liabilities
- **B1.** Asset = money the user has (Cash, Bank, prepaid Digital,
  Savings). **B2.** Liability = money the user owes (Credit Card, BNPL,
  Loan).
- **B3.** Four payment kinds only: Cash, Bank, Card, Digital. Prepaid
  Digital = asset; BNPL (Paidy) behaves as Card.
- **B4.** A debit card is NOT an account — it is a tag on its bank
  account; debit payment = bank payment. (No double-count.)
- **B5.** A credit limit is not money: never an asset, never spendable.
- **B6.** Asset balance = opening + income − expenses + transfers in −
  transfers out. Liability balance = opening + charges − payments.

### C. Transactions — the only way money moves
- **C1. Income** into an asset. **C2. Expense** counted on the purchase
  date: from an asset it lowers the asset; by credit card it raises the
  liability the same day. **C3. Transfer** between own accounts — never
  income, never expense, excluded from all totals (an ATM withdrawal is
  a transfer, not spending [C·PF-073]). **C4. Card/BNPL payment** is a
  transfer (asset → liability), never a second expense.
- **C5.** Amounts stored positive; type carries the direction.
- **C6. Quick Add:** amount + category only → Expense from Cash, today.
  Counts in category reports; only Cash moves.
- **C7. Full entry:** account/date/note chosen; moves exactly what its
  type says.
- **C8.** Future-dated records change no balance today; they sit in
  their own month and reduce safe-to-spend now.
- **C9.** Month = calendar month of the record's date (Asia/Tokyo).

### D. Net worth — "your real money"
- **D1.** Net worth = total assets − total liabilities, computed live.
- **D2.** It may be negative; report honestly.
- **D3.** Period change in net worth must equal income − expenses ±
  adjustments (transfers and card payments cancel out) — the engine's
  built-in self-check.

### E. Budgets
- **E1–E3.** Monthly limit per category; spent = all expenses in the
  category (Quick Add and card purchases included); remaining may go
  negative and is shown true.
- **E4. Pace line:** expected spend by today = budget × days passed ÷
  days in month. Above pace = correction signal.
- **E5.** A category without a budget still reports; no limit, no alert.

### F. Special cases
- **F1. Refund** is not income: it reduces the original category's
  spent; money returns to the paying account (or lowers the card
  liability).
- **F2.** Card/loan interest and fees = Expense (Fees & Interest) on
  the charge day, liability up by the same amount.
- **F3.** Interest earned = Income (Interest).
- **F4. Adjustment** record (with note) fixes any app-vs-reality
  difference; shown as its own line in reports.
- **F5.** Money lent to friends is an asset only if created as one;
  repayment = transfer back; forgiving = Adjustment.
- **F6.** Deleting a record removes its effect everywhere at once (A2).

### G. Bills and safe-to-spend
- **G1.** A bill is a known future expense: no balance effect until
  paid, but it is reserved money.
- **G2.** Spendable = Cash + Bank + prepaid Digital only.
- **G3. Safe-to-spend (month)** = spendable + income still expected
  − bills still due − goal contributions not yet made − buffer
  (user setting, default ¥0). Negative stays negative ("over plan").
- **G4.** Per day = G3 ÷ days left including today.
- **G5.** Alerts: category over pace (E4), safe-to-spend negative,
  a category's remaining budget at or below the user's warning
  threshold (**default 20%**, set-once), and bills due inside the
  user's reminder window (**default 3 days**, set-once). Full Home
  layout + set-once list: LA-BO Feature Spec, "Home Screen
  Specification".

### H. Goals and growth
- **H1.** Goal = name, target, optional deadline, saved so far.
- **H2.** Contributing is a transfer, not an expense; contributed money
  is reserved and lowers safe-to-spend.
- **H3.** Progress = saved ÷ target × 100. If the target is ¥0, progress
  is **not a percentage at all** — the face shows "Set a target" — never
  an invented number like 43% or 100% on a ¥0/¥0 goal (bug seen on the
  Dashboard, 2026-11-13).
- **H4.** Monthly surplus = income − expenses; surplus funds growth.
- **H5.** Forecast finish = (target − saved) ÷ average monthly
  contribution (last 3 months, or the user's planned amount). Zero
  contributions → "no date yet", never an invented date.
- **H6.** Withdrawal = transfer back; everything recalculates.

### I. Health score (0–100, engine only)
- Savings behaviour 30 (savings rate ≥20% → full) · Budget control 30
  (over-budget categories lose proportionally; no budgets set → 15) ·
  Debt pressure 20 (liabilities ÷ assets; no debt → 20) · Bills safety
  20 (spendable covers next 30 days of bills).
- The score is a guide, not a judgment; the face names the weak part.

### J. Reports
- **J1.** Totals include Income (C1) and Expense (C2) only — never
  transfers, card payments, or goal contributions.
- **J2.** Category totals include Quick Add; account views include
  only records linked to that account.
- **J3.** Month decided by record date (C9).
- **J4.** Net (income − expenses) must reconcile with net-worth change
  (D3); any difference is an Adjustment, shown separately.
- **J5.** Exports (CSV/PDF) print engine figures — never a separate
  calculation.

### K. LA-BO (AI) inside the engine
- **K1.** LA-BO uses only rulebook numbers; missing data → it says so
  and names the page to add it on.
- **K2.** LA-BO never writes/edits/deletes directly: propose → user
  confirms on a card → engine saves.
- **K3.** Live-web figures labelled LIVE WEB with source + date; never
  mixed into the user's totals.
- **K4.** Replies in the user's own language.

### L. Validation and safety
- **L1.** Positive whole-yen amount, real date, own category/account.
- **L2.** Transfer accounts must differ and both be the user's.
- **L3.** An account with records is never deleted into orphans.
- **L4.** Passwords = strong one-way hashes; sessions in httpOnly
  cookies; every data route checks the logged-in user.
- **L5.** Every rule in Parts B–J has an automated test before it is
  called done.

---

## Part II — v2 additions: the best of ChatGPT [C] and Antigravity [A]

### M. Income, done properly [C]
- **M1.** Salary counts **once — the net amount actually received.**
  If gross pay and deductions are entered, they are components of one
  income, never two incomes (PF-058, PF-060).
- **M2. Reimbursement is not income.** Money paid back to the user for
  something they fronted (e.g. a friend's share of dinner) offsets the
  original expense category (PF-063, PF-367).
- **M3. Cashback, points and discounts are not income.** They reduce
  the expense they came from (PF-074).

### N. Security and privacy, presentation-grade [C]
- **N1.** The app **never asks for or stores** bank passwords, card
  PINs, CVVs or one-time codes — manual tracking needs none of them
  (PF-150, PF-276).
- **N2.** No secrets, tokens, or other users' data ever appear in logs,
  error messages, AI prompts or exports (PF-240, PF-292).
- **N3. The two-user test [test, L5 family]:** an automated test must
  prove user A cannot read, edit, export or delete user B's records
  through any route (PF-331, PF-268). *This is the direct answer to the
  teacher's "security is NOT OK" feedback.*

### O. Demo honesty [C]
- **O1.** The demo account is visibly labelled **"Sample data"** on
  every screen (PF-348) — examiners scanning the QR code must never
  mistake dummy figures for real ones.
- **O2.** Dummy/seed data and real user data are kept separate; a demo
  reset restores only demo data (PF-004).

### P. Layer 2 — how the face reflects the engine [A + M]
- **P1. Plain-words dictionary (fixed templates, no AI on screens):**
  Liability → "Money you have to pay back" · Net worth → "Your real
  money" · Assets → "Money you have" · Safe-to-spend → "Safe to spend
  today" · Budget pace → "On track / A bit fast this month" (PF-339).
- **P2. Proof on demand [A]:** tapping any headline number opens its
  **breakdown from the engine** (which accounts, which records made
  it). Simplicity by default, proof one tap away — Layer 2 may change
  its words freely but never the number (PF-010).
- **P3. Simple in, strict inside [A]:** Layer 1's strictness must
  never force long forms on the user. Quick Add (C6) and smart
  defaults are how simple input becomes strict records.
- **P4. Incomplete data is shown, not hidden:** if figures rest on
  partial data, the face says so ("Add your income to unlock this")
  instead of showing a falsely confident score (PF-345, I-rules).
- **P5. Navigation (locked 2026-11-13 from Suman's sidebar design):**
  plain words only, daily things first, monthly things grouped —
  **Home · Transactions · My Accounts · My Plans ▸ (Budgets · Bills &
  Subscriptions · Savings Goals · Loans) · Reports & Insights ·
  ProMoney LA-BO (AI badge) · Settings** (at the bottom). No page is
  removed; grouping only. On mobile the same order becomes the bottom
  sections. *(Amendment, same day, Suman's call: **Loans** added under
  My Plans — breakdown + payoff planner, LA-BO Feature Spec F12.)*

### Q. AI output verification [C]
- **Q1.** Any number appearing in an LA-BO answer is checked against
  the engine's computed output before display; a mismatch means the
  answer is regenerated or refused, never shown (PF-244, PF-233).
  *(Strengthens K1 from a promise into a check.)*

---

## Part III — Parked: good ideas, wrong deadline

Named here so nobody (human or AI) rebuilds them into the project
before **December 23**. They belong to a future public launch:

- Full double-entry ledger / chart of accounts [C·PF-031, A]
- Investments, stocks, funds [C·Part P] · NISA / iDeCo [C·Part Q]
- Tax calculation and filing helpers [C·Part R] · FX / multi-currency
  [C·Part S]
- Bank sync / open banking [C·Part AA] · Money transfers, custody,
  lending licences [C·Part AB] · Japan APPI legal programme [C·Part Z]
- Household / shared accounts [C·Part AG] · Full banking loan
  products/amortisation tables [C·Part M] *(a slim loan breakdown +
  payoff simulator is IN scope — LA-BO Spec F12; only the banking
  product depth stays parked)* · Split transactions [C·PF-039]
  *(first candidate to un-park after the presentation)*
- "Why am I seeing this?" AI-narrated insights on normal screens [A]
  — screens stay template-based (P1); narration lives in LA-BO chat.

*If an AI tool proposes anything from Part III, the answer is:
"Parked — see the Constitution, Part III."*
