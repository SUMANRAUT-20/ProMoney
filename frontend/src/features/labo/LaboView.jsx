import {
  Bot,
  BookOpen,
  Calculator,
  FileSearch,
  FlaskConical,
  History,
  Info,
  Send,
  ShieldAlert,
} from "lucide-react";
import { PageHeading } from "../../components/ui";
import { useLaboAgent } from "./useLaboAgent";

const futureModules = [
  {
    title: "1. AI Chat Assistant",
    phase: "Phase 5",
    icon: Bot,
    status: "Live — answers from your own data",
    description:
      "Conversational assistant that answers questions about your money using only figures calculated by ProMoney itself.",
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
    description:
      "Controlled agentic workflows that propose budget or goal adjustments. Never modifies user records without explicit human approval.",
  },
  {
    title: "6. Analysis History & Evidence",
    phase: "Phase 6",
    icon: History,
    description:
      "Transparent audit log showing the exact database queries, calculation inputs, and timestamps behind every AI insight.",
  },
];

/**
 * ProMoney Lab View (Phase 4 Rule 4: View separated from logic)
 * Joint Owners: Arpan Khatiwada & Suman Raut (Members 4 & 5)
 *
 * Renders state from `useLaboAgent()` only — no fetch or API calls live
 * inside this component.
 */
export default function LaboView() {
  const { messages, input, setInput, busy, error, quickQuestions, ask } = useLaboAgent();

  return (
    <>
      <PageHeading
        title="ProMoney LA-BO"
        subtitle="Explainable AI Financial Workspace — Module 1 (AI Chat) is live."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>AI Chat Assistant is LIVE (beta)</strong>
          <span>
            Ask about your own money below. Answers use only numbers ProMoney
            calculated from your data — the AI never invents figures.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <div className="section-title">
          <h2>Ask LA-BO</h2>
          <Bot size={20} color="var(--green)" />
        </div>

        <div className="labo-chat-log">
          {messages.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Try one of these, or type your own question about this month.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`labo-msg ${m.role === "user" ? "labo-msg-user" : "labo-msg-ai"}`}>
              {m.text}
            </div>
          ))}
          {busy && <div className="labo-msg labo-msg-ai">Thinking…</div>}
        </div>

        <div className="labo-quick">
          {quickQuestions.map((q) => (
            <button key={q} type="button" className="labo-chip" onClick={() => ask(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>

        {error && (
          <p className="small" style={{ color: "var(--red, #c0392b)" }} role="alert">
            {error}
          </p>
        )}

        <form
          className="labo-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your money… e.g. How much did I spend on food?"
            maxLength={500}
            aria-label="Ask LA-BO a question"
          />
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
            <Send size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />
            Ask
          </button>
        </form>
      </section>

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
          2. <strong>Coming next:</strong> RAG Knowledge Hub over curated
          Japan personal finance guides, and live web answers with sources,
          always labelled.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          3. <strong>Strict Human-in-the-Loop Rule:</strong> AI suggestions
          cannot create, update, or delete any user financial record
          without explicit user confirmation.
        </p>
      </section>
    </>
  );
}
