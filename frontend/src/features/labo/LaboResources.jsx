import { BookOpen, Bot, Calculator, FileSearch, FlaskConical, History, ShieldAlert } from 'lucide-react';
import { WhatIfPanel } from './WhatIfPanel';

const futureModules = [
  {
    title: "1. AI Chat Assistant, Voice & Photo Scan",
    phase: "Phase 5–6",
    icon: Bot,
    status: "Live — chat, voice, receipt scans, statement import, multi-add and Undo",
    description:
      "Conversational assistant that answers questions, scans receipt/bill photos with Muse Ember vision, and prepares transaction proposals using only figures verified by ProMoney.",
  },
  {
    title: "2. Financial X-Ray",
    phase: "Phase 5",
    icon: FileSearch,
    description:
      "Automated cash-flow diagnostics, category spike detection, and budget health summaries backed by verified SQL evidence.",
  },
  {
    title: "3. Future Lab Simulations",
    phase: "Phase 6",
    icon: Calculator,
    description:
      "Deterministic JPY what-if simulations for savings targets, debt payoff timelines, and monthly cash-flow changes.",
  },
  {
    title: "4. RAG Knowledge Hub",
    phase: "Phase 6",
    icon: BookOpen,
    description:
      "Retrieval-Augmented Generation over curated Japan personal finance guides (tax, NISA, household budgeting).",
  },
  {
    title: "5. Approval-Based AI Action Agent",
    phase: "Phase 6",
    icon: ShieldAlert,
    status: "Live — confirm-before-save & one-tap undo",
    description:
      "Controlled agentic workflows that propose single or multi-item additions. Never modifies user records without explicit human approval.",
  },
  {
    title: "6. Analysis History & Evidence",
    phase: "Phase 6",
    icon: History,
    description:
      "Transparent audit log showing the exact database queries, calculation inputs, and timestamps behind every AI insight.",
  },
];

export default function LaboResources({ categories }) {
  return (
    <details className="labo-resources">
      <summary>What-if tools and app information</summary>
      <WhatIfPanel categories={categories} />
      <section className="section-card card">
        <div className="section-title">
          <h2>ProMoney Lab Capabilities</h2>
          <FlaskConical size={20} color="var(--green)" />
        </div>

        <div className="lab-grid">
          {futureModules.map(({ title, phase, icon: Icon, description, status }) => (
            <article key={title} className="lab-card card">
              <div className="lab-card-head">
                <h3>{title}</h3>
                <span className="neutral-badge">{phase}</span>
              </div>
              <p>{description}</p>
              <div
                className="muted small"
                style={{ marginTop: "auto", paddingTop: 6 }}
              >
                <Icon
                  size={14}
                  style={{ verticalAlign: "middle", marginRight: 5 }}
                />
                Status: {status || "Feature not implemented yet"}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card card">
        <h2>Integration &amp; Safety Architecture</h2>
        <p className="muted">
          1. <strong>Verified Data Pipeline:</strong> React calculates a
          snapshot with the app&apos;s own finance math → Express
          (`/api/labo/chat`, login required) → AI provider phrases the answer from
          that snapshot only.
        </p>
        <p className="muted">
          2. <strong>Planning:</strong> Ask “Can I buy a ¥30,000 jacket?” for a purchase simulation.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          3. <strong>Strict Human-in-the-Loop Rule:</strong> AI suggestions
          (typed or spoken) cannot create, update, or delete any user financial record
          without explicit user confirmation, and every save includes one-tap Undo.
        </p>
      </section>
    </details>
  );
}
