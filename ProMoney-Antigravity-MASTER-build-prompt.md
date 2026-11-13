# ProMoney — MASTER BUILD (for Antigravity)

**How to use:** Open the ProMoney folder in Antigravity, start a NEW
chat, attach these three files, then paste this whole document:
1. `AGENTS.md` (repo root — ProMoney rules + Ponytail)
2. `ProMoney-Layer1-Rulebook-v2.md` (the Constitution)
3. `ProMoney-LABO-Feature-Spec.md` (LA-BO + Home spec)

Work **phase by phase**. After each phase: run the checks, commit on
that phase's branch, write the phase report, and **STOP and wait for
my "go"** before the next phase. Never work on `main`. Never commit
`.env` or any secret. If a phase's checks fail and you cannot fix them
within the phase's scope, STOP and report — do not improvise.

Global style: **Ponytail** — smallest complete change, reuse what
exists, deletion beats addition, no new dependency without asking.
Global law: **the Constitution wins** — any behaviour not in it gets
asked about, not invented.

---

## PHASE 0 — Baseline and safety (branch: none yet)

1. `git status` — report every modified/untracked file. If `.env`
   appears anywhere in that list, STOP and report.
2. Run `cd backend && npm test` and `cd frontend && npm run build`.
   Record the numbers.
3. Commit ALL current work on the current branch (`feat/labo`) with
   message "LA-BO v1 + work in progress (pre two-layer build)" and
   push. This is the safety snapshot — nothing after this point may
   lose it.

## PHASE 1 — Cleanup (branch: `chore/cleanup`)

Ponytail cleanup, zero behaviour change:
1. Inventory first (report, wait for my "go"): unused files, unused
   exports, unused dependencies in both `package.json` files, dead
   code, stale comments — each with grep evidence. Unsure = kept,
   listed as UNSURE.
2. After my "go": delete group by group; after EACH group re-run
   backend tests + frontend build; a failure reverts that group.
   One commit per group.
3. Report: removed totals, before/after test count and build size,
   UNSURE list.

## PHASE 2 — Layer 1 engine: the data core (branch: `feat/layer1-engine`)

Goal: one engine, real data, per Constitution Parts A–L. The frontend
stops keeping its own money data.

1. **Backend data routes, completed and protected:** transactions,
   budgets and goals controllers are stubs (budgets returns 501) —
   implement them fully against the TiDB models. **Every** data route
   mounts `requireAuth`. Accounts and bills get real backend routes if
   any are missing.
2. **Settings into the database** (Step 2c): settings + avatar
   currently live in memory and die on restart — move them to SQL so
   the Home set-once settings (Feature Spec) survive.
3. **financeMath = the only calculator.** Move/confirm every figure
   the UI shows (balances B6, net worth D1, budget pace E4,
   safe-to-spend G3/G4, health score Part I, goal progress H3 —
   **including the ¥0-target guard: target ¥0 → no percentage**)
   into the shared finance core, computed from DB records. Any page
   still doing its own maths gets rewired to the core.
4. **Frontend wiring (Step 2b):** `FinanceContext` reads/writes the
   API instead of localStorage demo data. Demo/seed data remains
   available ONLY as the labelled demo account (Constitution O1/O2).
5. **Tests (Constitution L5 + N3):** every engine rule in Parts B–J
   has at least one automated test, including: transfer is not income,
   card payment is not an expense, debit never double-counts, refund
   offsets its category, and the **two-user test** — user A cannot
   read/edit/delete user B's records on any route.
6. Checks: backend tests all pass (report count), frontend build
   passes. Report: which routes/pages moved, test list added.

## PHASE 3 — Security hardening, best options auto-selected (branch: `feat/security-hardening`)

Apply the secure option wherever a choice exists — do not ask, these
are pre-decided:
1. Session token in an **httpOnly cookie** (`pm_session`); the
   frontend never stores a token in localStorage.
2. **Revocation:** `users.token_version` (apply migration
   `004_add_token_version.sql` to the schema file set); JWT carries
   it; password change bumps it and signs out all devices; add
   logout and logout-all endpoints.
3. **Login rate limit:** 10 failed attempts per email+IP per 15
   minutes → 429, and even the correct password waits while limited.
4. **Password policy:** minimum 10 characters, at least one letter
   and one digit (register + password change).
5. **No account-existence leaks:** identical login error for unknown
   email and wrong password; a dummy hash-verify runs for unknown
   emails so timing does not leak either.
6. **Security headers** on API responses: `X-Content-Type-Options:
   nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
   CORS: explicit client origin with credentials — never `*`.
7. Password hashing stays **scrypt** (already in the codebase —
   Ponytail: do not swap a working control).
8. Checks: full backend suite passes, including new tests for rate
   limit, revocation (old token dies after password change) and the
   two-user test from Phase 2. Report each control in one line.

## PHASE 4 — LA-BO engine switch: Meta Model API (branch: `feat/meta-api`)

1. Add a provider layer inside the LA-BO backend service:
   `AI_PROVIDER` in `.env` selects `meta` (primary) or `groq`
   (fallback). Both behind one interface; the rest of LA-BO does not
   know which is answering. Groq code is KEPT, not deleted.
2. Meta Model API (Llama 4) handles chat + parse exactly as Groq did:
   same system-prompt rules (Constitution K1–K4, Q1 — numbers only
   from the engine snapshot, same-language replies, parse → confirm
   card, never save directly).
3. The API key goes in `backend/.env` ONLY (`META_API_KEY`). Never in
   code, never in a commit, never printed in logs or reports.
4. **LA-BO view: DO NOT redesign it.** Keep the current chat UI
   exactly as it is in this phase and all LA-BO phases. BUT structure
   the LA-BO frontend code so the view can be replaced later without
   touching logic: all LA-BO behaviour (send, parse, confirm, voice,
   import, reports) lives in service/hook modules; React components
   only render state and call them. No fetch calls inside components.
5. Checks: build passes; chat answers from Meta with the local demo
   data; switching `AI_PROVIDER=groq` also works. Report which one
   answered.

## PHASE 5 — Menus + Home (branch: `feat/nav-home`)

1. **Sidebar, exactly as locked (Constitution P5):** Home ·
   Transactions · My Accounts · My Plans ▸ (Budgets · Bills &
   Subscriptions · Savings Goals · Loans — Loans is a simple
   placeholder page in this phase: "Coming in the simulator phase")
   · Reports & Insights · ProMoney LA-BO (with **AI** badge) ·
   Settings (bottom). Rename routes/labels: Dashboard→Home,
   Accounts→My Accounts, Reports→Reports & Insights. Keep old routes
   redirecting to the new ones. Same order on mobile.
2. **Home, per the Feature Spec "Home Screen Specification":**
   money-you-hold card (with real-money + to-pay-back lines) →
   safe-to-spend-today card with formula breakdown on tap → bills to
   pay (overdue pinned, red) → warnings strip (engine ranking;
   budget-remaining warning uses the user's threshold, default 20%)
   → goal rings (¥0-target guard from Phase 2) → recent 5
   transactions **with titles shown** → LA-BO one-line alert card.
3. **Set-once settings UI** (Settings page), stored via Phase 2's DB
   settings: budget warning % (default 20), bill reminder days
   (default 3), minimum buffer ¥ (default 0), payday day-of-month,
   expected monthly income (optional), per-card closing + payment
   days, warning on/off switches. Sensible defaults — Home must be
   fully correct before anything is set.
4. Also fix here: **remove the leftover "Username" field** from the
   Register form (it was never used by the backend).
5. Checks: build passes; phone-width screenshot of Home with demo
   data; every card's numbers match the engine (spot-check two
   against Transactions/Accounts). Report with the screenshot.

## PHASE 6 — LA-BO features (branch per feature: `feat/labo-voice`, `feat/labo-photo`, `feat/labo-import`, `feat/labo-reports`, `feat/labo-simulators`)

Build in this order, one branch each, STOP after each for my "go".
ALL of them: current chat view unchanged (Phase 4 rule 4); numbers
only from the engine; propose → confirm → save (K2).

1. **Voice communication + multi-add + undo** (Spec F2/F5/F6):
   Web Speech API in (EN/JA), speech-synthesis replies out with a
   mute toggle; several transactions in one message become one
   confirm list; every LA-BO save shows Undo.
2. **Bill photo** (F3): Meta vision reads shop/date/total → confirm
   card; unreadable → say so, offer manual entry, never guess.
3. **Chat file import** (F4): CSV parsed by backend code (AI only
   maps unknown columns); PDF via Meta extraction with unsure rows
   flagged; review list with tick boxes; likely duplicates
   pre-unticked and marked.
4. **Custom chat reports** (F7): user describes the report → LA-BO
   reads back its understanding → on yes, generates in-chat card +
   PDF / CSV / PNG **in the format the user asked for** (default:
   card + PDF). Responsive: one column on phone, wide on desktop.
5. **Simulators + Loans page** (F9–F12): Check Before You Buy,
   What Can I Do With My Money, What-If — all labelled SIMULATION,
   saving nothing. Loans page replaces the Phase 5 placeholder:
   per-debt breakdown (borrowed / paid / remaining / interest paid /
   payoff date), totals + debt-free date, and the payoff planner:
   Avalanche vs Snowball side by side + extra-payment slider, all
   engine maths.
6. **Docs + web** (last): Gemini embeddings over the 18 research
   sources for document answers; Tavily for live web, always
   labelled LIVE WEB with source + date (K3). Keys in `.env` only.

## PHASE 7 — Final verification (no branch — report only)

1. Full backend test suite + frontend build, report both numbers.
2. A one-page summary: what each phase changed, what was deleted in
   cleanup, every UNSURE/parked item, and the Ponytail closing lines
   (skipped / not checked / risks).
3. Do NOT deploy, do NOT merge to main, do NOT publish the Google
   OAuth app — those are Suman's steps, done with Munna separately.

---

## Things the owner did not list but are included on purpose

- Phase 0's commit-first rule and Phase 1 cleanup: new work on an
  uncommitted, messy tree is how code gets lost.
- Phase 2's settings-to-DB and stub controllers: the Home set-once
  settings and the engine cannot work while settings die on restart
  and budgets return 501.
- Phase 3 exists because the teacher's interim feedback was
  "security is NOT OK" — it is cheaper to harden before the new
  features than after.
- The demo account's "Sample data" label (Constitution O1) ships in
  Phase 2 so no later phase builds on unlabelled dummy data.
- Live deploy, QR code and Google OAuth publishing are deliberately
  NOT in this build — they are the separate Step 3, after Dec 23
  features are frozen.
