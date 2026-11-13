# ProMoney — AI-Powered Personal Finance Management System

**ProMoney** helps users in Japan manage income, expenses, accounts, monthly budgets, recurring bills & subscriptions, savings goals, and financial reports in Japanese Yen (`JPY`, `¥`), with a dedicated workspace (**ProMoney Lab**) for explainable AI financial assistance.

This repository is configured as a **Clean Project Foundation** for 5-member parallel development using AI coding assistants ("vibe coding"). All demo balances, fictional transactions, hardcoded charts, and mock authentication responses have been removed while preserving the **Template 21: Ultra-Clean Finance** design system, shared UI components, routing, and backend calculation engine.

---

## 1. Confirmed Team Responsibilities

| Member | Full Name | Assigned Responsibilities | Primary Owned Paths |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Rajesh Mishra** | **Transactions & Accounts** (recording, forms, transaction list, UI categories, account management, filters, validation, API integration) | `frontend/src/features/transactions/`<br>`frontend/src/features/accounts/` |
| **Member 2** | **Renuka Karmacharya** | **Login, Registration & Authentication Frontend** (shared `AuthLayout`, form validation, auth state, route protection, error handling) | `frontend/src/features/auth/`<br>`frontend/src/context/AuthContext.jsx` |
| **Member 3** | **Roshan Khanal** | **Budgets, Bills & Subscriptions, Savings Goals** (budget creation & progress, upcoming bills, subscriptions, savings targets & goal progress) | `frontend/src/features/budgets/`<br>`frontend/src/features/bills/`<br>`frontend/src/features/goals/` |
| **Member 4** | **Arpan Khatiwada** | **Joint Backend, APIs, Database Integration, Dashboard, Reports, ProMoney Lab, Shared Architecture, QA & Deployment** | `backend/`<br>`frontend/src/features/dashboard/`<br>`frontend/src/features/analytics/`<br>`frontend/src/features/labo/`<br>`frontend/src/services/` |
| **Member 5** | **Suman Raut** | **Joint Backend, APIs, Database Integration, Dashboard, Reports, ProMoney Lab, Shared Architecture, GitHub & Deployment** | `backend/`<br>`frontend/src/features/dashboard/`<br>`frontend/src/features/analytics/`<br>`frontend/src/features/labo/`<br>`frontend/src/services/` |

---

## 2. Repository Structure

```text
ProMoney/
├── AGENTS.md                           # AI assistant coding rules & boundaries
├── README.md                           # Project overview & quickstart
├── .gitignore                          # Prevents committing .env, node_modules, dist
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
│   │   │   ├── labo/                   # Arpan & Suman: LaboView.jsx
│   │   │   └── settings/               # Shared: SettingsView.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx         # Session & auth state provider
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
│   │   └── migrations/                 # Database migrations
│   ├── tests/
│   │   └── financeMath.test.js         # Automated unit tests for financial math
│   ├── package.json
│   └── .env.example
└── design/                             # Visual references for Template 21
```

---

## 3. Quickstart Commands

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
