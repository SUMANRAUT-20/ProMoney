import {
  Bot,
  BookOpen,
  Calculator,
  Check,
  FileSearch,
  FlaskConical,
  History,
  Info,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PageHeading } from "../../components/ui";
import { formatDate, money } from "../../utils/formatters";
import { useLaboAgent } from "./useLaboAgent";

const futureModules = [
  {
    title: "1. AI Chat Assistant & Voice",
    phase: "Phase 5–6",
    icon: Bot,
    status: "Live — chat, voice in/out, multi-add & undo",
    description:
      "Conversational assistant that answers questions and prepares transaction proposals using only figures calculated by ProMoney.",
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

/**
 * ProMoney Lab View (Phase 4 & Phase 6 Branch 1: Voice, Multi-Add, Undo)
 * Joint Owners: Arpan Khatiwada & Suman Raut (Members 4 & 5)
 *
 * Renders state from `useLaboAgent()` only — no fetch or calculation logic
 * lives inside this component.
 */
export default function LaboView() {
  const {
    messages,
    input,
    setInput,
    busy,
    error,
    pendingProposals,
    quickQuestions,
    voiceMuted,
    toggleVoiceMuted,
    voiceLang,
    setVoiceLang,
    isListening,
    isSpeaking,
    speechSupported,
    toggleListening,
    ask,
    removeProposalItem,
    confirmProposal,
    dismissProposal,
    undoSave,
  } = useLaboAgent();

  const proposalsTotal = pendingProposals.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <>
      <PageHeading
        title="ProMoney LA-BO"
        subtitle="Explainable AI Financial Workspace — Chat, Voice In/Out, Multi-Add & One-Tap Undo."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>AI Chat &amp; Voice Assistant is LIVE</strong>
          <span>
            Ask about your money or type/speak transactions like &ldquo;spent 500 on lunch and 1200 on train&rdquo;. LA-BO prepares a confirm card first — nothing saves until you tap Confirm.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <div className="section-title" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={20} color="var(--green)" />
            <h2 style={{ margin: 0 }}>Ask LA-BO</h2>
            {isListening && (
              <span className="status-pill due_soon" role="status">
                🎤 Listening ({voiceLang === "ja-JP" ? "JA" : "EN"})…
              </span>
            )}
            {isSpeaking && !voiceMuted && (
              <span className="status-pill paid" role="status">
                🔊 Speaking…
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="segmented" aria-label="Voice recognition language">
              <button
                type="button"
                className={voiceLang === "en-US" ? "selected" : ""}
                onClick={() => setVoiceLang("en-US")}
                title="English voice recognition"
              >
                EN
              </button>
              <button
                type="button"
                className={voiceLang === "ja-JP" ? "selected" : ""}
                onClick={() => setVoiceLang("ja-JP")}
                title="Japanese voice recognition (日本語)"
              >
                日本語
              </button>
            </div>

            <button
              type="button"
              className="btn secondary compact"
              onClick={toggleVoiceMuted}
              aria-pressed={voiceMuted}
              aria-label={voiceMuted ? "Unmute LA-BO voice replies" : "Mute LA-BO voice replies"}
              title={voiceMuted ? "Voice replies muted — tap to unmute" : "Voice replies on — tap to mute"}
            >
              {voiceMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span>{voiceMuted ? "Muted" : "Voice On"}</span>
            </button>
          </div>
        </div>

        <div className="labo-chat-log">
          {messages.length === 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Try one of these questions, or type/speak &ldquo;Khana 800, bus 220, coffee 500&rdquo; to test multi-add.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={m.id || i}
              className={`labo-msg ${m.role === "user" ? "labo-msg-user" : "labo-msg-ai"}`}
            >
              <div>{m.text}</div>
              {m.savedIds?.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  {m.undone ? (
                    <span className="neutral-badge" role="status">
                      ✓ Undone
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn secondary compact"
                      onClick={() => undoSave(m.id)}
                      disabled={busy}
                      aria-label="Undo saved transactions"
                    >
                      <RotateCcw size={13} /> Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="labo-msg labo-msg-ai">Thinking…</div>}
        </div>

        {/* Multi-Add Confirm Card (Constitution K2 & Feature Spec F5) */}
        {pendingProposals.length > 0 && (
          <div
            className="card"
            role="region"
            aria-label="Confirm proposed transactions"
            style={{
              padding: 14,
              marginTop: 10,
              marginBottom: 10,
              background: "var(--mint-soft)",
              border: "1px solid var(--green)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong>
                Confirm Before Saving ({pendingProposals.length}{" "}
                {pendingProposals.length === 1 ? "item" : "items"} · {money(proposalsTotal)})
              </strong>
              <button
                type="button"
                className="icon-button"
                onClick={dismissProposal}
                aria-label="Cancel proposal"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {pendingProposals.map((item) => (
                <div
                  key={item.itemId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <strong>{item.note}</strong>
                    <span className="muted" style={{ marginLeft: 8 }}>
                      {item.category_name} · {item.kind} · {formatDate(item.transaction_date)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong>{money(item.amount)}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeProposalItem(item.itemId)}
                      aria-label={`Remove ${item.note}`}
                      title="Remove this item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn secondary compact" onClick={dismissProposal} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn primary compact" onClick={confirmProposal} disabled={busy}>
                <Check size={14} /> Confirm &amp; Save ({pendingProposals.length})
              </button>
            </div>
          </div>
        )}

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
          <button
            type="button"
            className={`btn ${isListening ? "primary" : "secondary"} compact`}
            onClick={toggleListening}
            disabled={busy || !speechSupported}
            aria-pressed={isListening}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            title={
              speechSupported
                ? isListening
                  ? "Listening — tap to stop"
                  : `Speak in ${voiceLang === "ja-JP" ? "Japanese" : "English"}`
                : "Speech recognition not supported in this browser"
            }
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your money or say 'spent 500 on lunch and 1200 on train'…"
            maxLength={500}
            aria-label="Ask LA-BO a question or enter transactions"
          />

          <button type="submit" className="btn primary compact" disabled={busy || !input.trim()}>
            <Send size={15} /> Ask
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
          2. <strong>Coming next:</strong> Bill photo extraction, CSV/PDF statement import,
          custom chat reports, and what-if simulators.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          3. <strong>Strict Human-in-the-Loop Rule:</strong> AI suggestions
          (typed or spoken) cannot create, update, or delete any user financial record
          without explicit user confirmation, and every save includes one-tap Undo.
        </p>
      </section>
    </>
  );
}
