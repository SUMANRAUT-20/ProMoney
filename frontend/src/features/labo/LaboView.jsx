import {
  Bot,
  BookOpen,
  Calculator,
  FileSearch,
  FlaskConical,
  History,
  Info,
  ShieldAlert
} from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

const futureModules = [
  {
    title: '1. AI Chat Assistant',
    phase: 'Phase 5',
    icon: Bot,
    description:
      'Explainable conversational assistant powered by local Ollama models and read-only financial tool calling.'
  },
  {
    title: '2. Financial X-Ray',
    phase: 'Phase 5',
    icon: FileSearch,
    description:
      'Automated cash-flow diagnostics, category spike detection, and budget health summaries backed by verified SQL evidence.'
  },
  {
    title: '3. Future Lab Simulations',
    phase: 'Phase 6',
    icon: Calculator,
    description:
      'Deterministic JPY what-if simulations for savings targets, debt payoff timelines, and monthly cash-flow changes.'
  },
  {
    title: '4. RAG Knowledge Hub',
    phase: 'Phase 6',
    icon: BookOpen,
    description:
      'Retrieval-Augmented Generation over curated Japan personal finance guides (tax, NISA, household budgeting).'
  },
  {
    title: '5. Approval-Based AI Action Agent',
    phase: 'Phase 6',
    icon: ShieldAlert,
    description:
      'Controlled agentic workflows that propose budget or goal adjustments. Never modifies user records without explicit human approval.'
  },
  {
    title: '6. Analysis History & Evidence',
    phase: 'Phase 6',
    icon: History,
    description:
      'Transparent audit log showing the exact database queries, calculation inputs, and timestamps behind every AI insight.'
  }
];

/**
 * ProMoney Lab View Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Members 4 & 5)
 *
 * Clean landing page for future AI capabilities. Contains zero simulated AI
 * responses, zero fabricated debt balances, and clear architectural guardrails.
 */
export default function LaboView() {
  return (
    <>
      <PageHeading
        title="ProMoney Lab"
        subtitle="Explainable AI Financial Workspace — Planned for Phases 5 & 6."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>ProMoney Lab Foundation (Phases 5 &amp; 6 — Arpan &amp; Suman)</strong>
          <span>
            Feature not implemented yet. This workspace is a clean architectural foundation. No AI
            model is currently active and no fabricated recommendations are displayed.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <div className="section-title">
          <h2>Planned ProMoney Lab Capabilities</h2>
          <FlaskConical size={20} color="var(--green)" />
        </div>

        <div className="lab-grid">
          {futureModules.map(({ title, phase, icon: Icon, description }) => (
            <article key={title} className="lab-card card">
              <div className="lab-card-head">
                <h3>{title}</h3>
                <span className="neutral-badge">{phase}</span>
              </div>
              <p>{description}</p>
              <div className="muted small" style={{ marginTop: 'auto', paddingTop: 6 }}>
                <Icon size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                Status: Feature not implemented yet
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card card">
        <h2>Intended Integration &amp; Safety Architecture</h2>
        <p className="muted">
          1. <strong>Verified Data Pipeline:</strong> React → Express (`/api/lab/*`) → Authenticated
          Financial Tools (`financeMath.js`) → MySQL (`promoney`).
        </p>
        <p className="muted">
          2. <strong>Local AI Runtime (Later):</strong> Express → Local Ollama LLM / RAG Retrieval /
          Controlled Agent Workflows.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          3. <strong>Strict Human-in-the-Loop Rule:</strong> AI suggestions cannot create, update, or
          delete any user financial record in MySQL without explicit user confirmation.
        </p>

        <EmptyState
          icon="🧪"
          title="Feature not implemented yet."
          description="ProMoney Lab AI modules will be enabled after core MySQL CRUD, authentication, and shared calculations are verified in Phases 1–4."
        />
      </section>
    </>
  );
}
