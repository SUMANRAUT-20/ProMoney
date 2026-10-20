# ProMoney — AI-Powered Personal Finance Management System for Japan

**ProMoney** helps users in Japan manage income, expenses, accounts, monthly budgets, recurring bills & subscriptions, savings goals, and financial reports in Japanese Yen (`JPY`, `¥`), with a dedicated workspace (**ProMoney Lab**) for explainable AI financial assistance.

This repository is configured as a **Clean Project Foundation** for 5-member parallel development using AI coding assistants ("vibe coding"). All demo balances, fictional transactions, hardcoded charts, and mock authentication responses have been removed while preserving the **Template 21: Ultra-Clean Finance** design system, shared UI components, routing, and backend calculation engine.

---

## 1. Confirmed Team Responsibilities

| Member | Full Name | Assigned Responsibilities | Primary Owned Paths |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Rajesh Mishra** | **Transactions & Accounts** (recording, forms, transaction list, UI categories, account management, filters, validation, API integration) | `frontend/src/features/transactions/`<br>`frontend/src/features/accounts/` |
| **Member 2** | **Renuka Karmacharya** | **Login, Registration & Authentication Frontend** (shared `AuthLayout`, form validation, auth state, route protection, error handling) | `frontend/src/features/auth/`<br>`frontend/src/context/AuthContext.jsx` *(planned)* |
| **Member 3** | **Roshan Khanal** | **Budgets, Bills & Subscriptions, Savings Goals** (budget creation & progress, upcoming bills, subscriptions, savings targets & goal progress) | `frontend/src/features/budgets/`<br>`frontend/src/features/bills/`<br>`frontend/src/features/goals/` |
| **Member 4** | **Arpan Khatiwada** | **Joint Backend, APIs, Database Integration, Dashboard, Reports, ProMoney Lab, Shared Architecture, QA & Deployment** | `backend/`<br>`frontend/src/features/dashboard/`<br>`frontend/src/features/analytics/`<br>`frontend/src/features/labo/`<br>`frontend/src/services/` |
| **Member 5** | **Suman Raut** | **Joint Backend, APIs, Database Integration, Dashboard, Reports, ProMoney Lab, Shared Architecture, GitHub & Deployment** | `backend/`<br>`frontend/src/features/dashboard/`<br>`frontend/src/features/analytics/`<br>`frontend/src/features/labo/`<br>`frontend/src/services/` |

---

## 2. Essential Documentation & Handbooks

Before writing any code or prompting an AI assistant, read the project governance and your personal handbook:

### Core Contracts & AI Rules
- [`AGENTS.md`](./AGENTS.md) — Mandatory rules for all AI coding assistants (ChatGPT, Cursor, Claude, Copilot).
- [`docs/INTEGRATION_CONTRACT.md`](./docs/INTEGRATION_CONTRACT.md) — Approved MySQL schema (`promoney`), `snake_case` REST API contracts, and shared JPY calculation formulas.
- [`docs/TEAM_OWNERSHIP_ADDENDUM.md`](./docs/TEAM_OWNERSHIP_ADDENDUM.md) — Complete 5-member responsibility matrix and Arpan/Suman lead-reviewer coordination plan.

### Team & Individual Handbooks (`docs/handbooks/`)
- [`docs/handbooks/COMMON_TEAM_HANDBOOK.md`](./docs/handbooks/COMMON_TEAM_HANDBOOK.md) — Beginner-friendly guide from installing Node.js/Git to GitHub Pull Requests, Vibe Coding, Testing, and Deployment.
- [`docs/handbooks/RAJESH_GUIDE.md`](./docs/handbooks/RAJESH_GUIDE.md) — Member 1 Guide (Transactions & Accounts).
- [`docs/handbooks/RENUKA_GUIDE.md`](./docs/handbooks/RENUKA_GUIDE.md) — Member 2 Guide (Login, Registration & Auth Frontend).
- [`docs/handbooks/ROSHAN_GUIDE.md`](./docs/handbooks/ROSHAN_GUIDE.md) — Member 3 Guide (Budgets, Bills & Subscriptions, Savings Goals).
- [`docs/handbooks/ARPAN_GUIDE.md`](./docs/handbooks/ARPAN_GUIDE.md) — Member 4 Guide (Joint Backend, APIs, DB, Dashboard, Reports, ProMoney Lab).
- [`docs/handbooks/SUMAN_GUIDE.md`](./docs/handbooks/SUMAN_GUIDE.md) — Member 5 Guide (Joint Backend, Math Engine, Dashboard, Reports, ProMoney Lab, DevOps).

### Prompts & Project Management (`docs/`)
- [`docs/prompts/MASTER_VIBE_CODING_PROMPT.md`](./docs/prompts/MASTER_VIBE_CODING_PROMPT.md) — Reusable AI session prompt template and member-specific starter prompts.
- [`docs/PROJECT_ROADMAP.md`](./docs/PROJECT_ROADMAP.md) — Phases 0 through 7 development roadmap.
- [`docs/TASK_ASSIGNMENTS.md`](./docs/TASK_ASSIGNMENTS.md) — Detailed task breakdown and GitHub Issue templates.
- [`docs/INTEGRATION_CHECKLIST.md`](./docs/INTEGRATION_CHECKLIST.md) — Pre-merge verification checklist.
- [`docs/DEFINITION_OF_DONE.md`](./docs/DEFINITION_OF_DONE.md) — Quality and completion standards.

---

## 3. Repository Structure

```text
promoney-starter/
├── AGENTS.md                           # AI assistant coding rules & boundaries
├── README.md                           # Project overview & quickstart
├── .gitignore                          # Prevents committing .env, node_modules, dist
├── .github/                            # Pull Request & Issue templates
├── docs/
│   ├── INTEGRATION_CONTRACT.md         # MySQL schema, REST API & calculation rules
│   ├── TEAM_OWNERSHIP_ADDENDUM.md      # 5-member responsibility matrix
│   ├── PROJECT_ROADMAP.md              # Phase 0–7 execution plan
│   ├── TASK_ASSIGNMENTS.md             # Member tasks & GitHub Issue format
│   ├── INTEGRATION_CHECKLIST.md        # PR & integration verification steps
│   ├── DEFINITION_OF_DONE.md           # Feature & release completion criteria
│   ├── handbooks/
│   │   ├── COMMON_TEAM_HANDBOOK.md     # Complete beginner guide (Setup, Git, Vibe Coding)
│   │   ├── RAJESH_GUIDE.md             # Member 1: Transactions & Accounts
│   │   ├── RENUKA_GUIDE.md             # Member 2: Login, Registration & Auth Frontend
│   │   ├── ROSHAN_GUIDE.md             # Member 3: Budgets, Bills & Goals
│   │   ├── ARPAN_GUIDE.md              # Member 4: Joint Backend, Dashboard, Reports, Lab
│   │   └── SUMAN_GUIDE.md              # Member 5: Joint Backend, Dashboard, Reports, Lab
│   └── prompts/
│       └── MASTER_VIBE_CODING_PROMPT.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                 # Shared Sidebar.jsx & Topbar.jsx
│   │   │   └── ui/                     # Shared UI primitives (PageHeading, Modal, Metric, etc.)
│   │   ├── features/
│   │   │   ├── auth/                   # Renuka: AuthLayout.jsx, LoginView.jsx, RegisterView.jsx
│   │   │   ├── transactions/           # Rajesh: TransactionsView.jsx
│   │   │   ├── accounts/               # Rajesh: AccountsView.jsx
│   │   │   ├── budgets/                # Roshan: BudgetsView.jsx
│   │   │   ├── bills/                  # Roshan: BillsView.jsx
│   │   │   ├── goals/                  # Roshan: GoalsView.jsx
│   │   │   ├── dashboard/              # Arpan & Suman: DashboardView.jsx
│   │   │   ├── analytics/              # Arpan & Suman: ReportsView.jsx
│   │   │   ├── labo/                   # Arpan & Suman: LaboView.jsx & simulationMath.js
│   │   │   └── settings/               # Shared: SettingsView.jsx
│   │   ├── context/
│   │   │   └── FinanceContext.jsx      # Clean state & theme provider
│   │   ├── data/
│   │   │   └── initialData.js          # Clean empty defaults & JPY categories
│   │   ├── services/
│   │   │   └── api.js                  # Centralized HTTP client
│   │   ├── utils/
│   │   │   └── formatters.js           # JPY currency (¥) & math formatters
│   │   ├── styles.css                  # Shared Template 21 Ultra-Clean Finance styles
│   │   ├── App.jsx                     # 11 application routes
│   │   └── main.jsx                    # React entry point
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── controllers/                # Arpan & Suman: Express route controllers
│   │   ├── routes/                     # Arpan & Suman: Express route definitions
│   │   ├── middleware/                 # Arpan & Suman: Auth & error middleware
│   │   ├── models/                     # Arpan & Suman: MySQL query models
│   │   ├── services/                   # Arpan & Suman: financeMath.js calculation engine
│   │   ├── ai/                         # Arpan & Suman: ProMoney Lab AI services (Phases 5–6)
│   │   ├── db.js                       # MySQL connection pool
│   │   └── server.js                   # Express server entry point
│   ├── sql/
│   │   ├── schema.sql                  # Core 6 MySQL tables (promoney)
│   │   ├── seeds.sql                   # Clean reference category seed template
│   │   └── migrations/                 # Planned migrations (bills, ProMoney Lab)
│   ├── tests/
│   │   └── financeMath.test.js         # Automated unit tests for financial math
│   ├── package.json
│   └── .env.example
└── design/                             # Visual references for Template 21
```

---

## 4. Quickstart Commands

### Start the Frontend (Port 5173)
```powershell
cd frontend
npm install
npm run dev
```

### Build the Frontend for Verification
```powershell
cd frontend
npm run build
```

### Start the Backend API (Port 4000)
```powershell
cd backend
npm install
npm run dev
```

### Run Backend Automated Financial Math Tests
```powershell
cd backend
npm test
```
