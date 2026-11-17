import { useRef } from "react";
import {
  Bot,
  BookOpen,
  Calculator,
  Camera,
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
import { money } from "../../utils/formatters";
import { StatementAttachment, StatementReview } from "./StatementImport";
import { ReportCard } from "./ReportCard";
import { AllocationCard, PurchaseCard } from "./SimulatorCards";
import { WhatIfPanel } from "./WhatIfPanel";
import { useLaboAgent } from "./useLaboAgent";

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
    scanPhoto,
    updateProposalItem,
    removeProposalItem,
    confirmProposal,
    dismissProposal,
    undoSave,
    categories,
    statement,
    confirmAllocation,
  } = useLaboAgent();

  const photoInputRef = useRef(null);
  const proposalsTotal = pendingProposals.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <>
      <PageHeading
        title="ProMoney LA-BO"
        subtitle="Chat, voice, receipt scans, statement imports, and reports."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Review before saving</strong>
          <span>
            LA-BO shows a review before saving transactions from chat, receipt photos, or statements.
          </span>
        </div>
      </div>

      <section
        className="section-card card"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          statement.attach(event.dataTransfer.files);
        }}
      >
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

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            <button type="button" className="btn secondary compact" disabled={busy}
              onClick={() => ask(voiceLang === "ja-JP" ? "アラートを聞く" : "Hear alerts")}>
              <Volume2 size={15} /> Hear alerts
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
              {m.report && <ReportCard report={m.report} signature={m.signature} />}
              {m.purchase && <PurchaseCard plan={m.purchase} />}
              {m.allocation && <AllocationCard plan={m.allocation} closed={m.allocationClosed} busy={busy}
                onConfirm={(proposal) => confirmAllocation(m.id, proposal)} />}
              {m.warnings?.length > 0 && (
                <ul>{m.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              )}
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

            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              {pendingProposals.map((item) => {
                const catsOfKind = categories.filter((c) => c.kind === item.kind);
                return (
                  <div
                    key={item.itemId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px",
                      borderRadius: 8,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      fontSize: 12.5,
                    }}
                  >
                    <label style={{ display: "flex", flexDirection: "column", gap: 2, margin: 0 }}>
                      <span className="muted small">Payee / Title</span>
                      <input
                        type="text"
                        value={item.note ?? ""}
                        maxLength={120}
                        aria-label="Proposed payee or title"
                        onChange={(e) => updateProposalItem(item.itemId, { note: e.target.value })}
                        style={{ padding: "5px 8px", fontSize: 12.5 }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 2, margin: 0 }}>
                      <span className="muted small">Amount (JPY)</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.amount ?? ""}
                        aria-label="Proposed amount JPY"
                        onChange={(e) => updateProposalItem(item.itemId, { amount: e.target.value })}
                        style={{ padding: "5px 8px", fontSize: 12.5 }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 2, margin: 0 }}>
                      <span className="muted small">Date</span>
                      <input
                        type="date"
                        value={item.transaction_date ?? ""}
                        aria-label="Proposed transaction date"
                        onChange={(e) => updateProposalItem(item.itemId, { transaction_date: e.target.value })}
                        style={{ padding: "5px 8px", fontSize: 12.5 }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 2, margin: 0 }}>
                      <span className="muted small">Category</span>
                      <select
                        value={item.category_id ?? ""}
                        aria-label="Proposed category"
                        onChange={(e) => updateProposalItem(item.itemId, { category_id: e.target.value })}
                        style={{ padding: "5px 8px", fontSize: 12.5 }}
                      >
                        {catsOfKind.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <strong>{money(Math.round(Number(item.amount || 0)))}</strong>
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
                );
              })}
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

        {statement.rows.length > 0 && <StatementReview statement={statement} categories={categories} busy={busy} />}

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
            ref={photoInputRef}
            type="file"
            accept="image/*"
            hidden
            aria-label="Upload receipt or bill photo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) scanPhoto(file);
            }}
          />

          <button
            type="button"
            className="btn secondary compact"
            onClick={() => photoInputRef.current?.click()}
            disabled={busy}
            aria-label="Attach bill or receipt photo"
            title="Attach a photo of a bill or receipt (📷)"
          >
            <Camera size={15} />
          </button>

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
        <StatementAttachment onAttach={statement.attach} disabled={busy || statement.rows.length > 0} />
      </section>

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
    </>
  );
}
