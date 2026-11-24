import { useRef } from "react";
import {
  Bot,
  Camera,
  Info,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PageHeading } from "../../components/ui";
import { StatementAccountPicker, StatementAttachment, StatementReview } from "./StatementImport";
import { ReportCard } from "./ReportCard";
import { AllocationCard, PurchaseCard } from "./SimulatorCards";
import ChatActionCard from "./ChatActionCard";
import LaboResources from "./LaboResources";
import TransactionProposals from "./TransactionProposals";
import { useChatScroll } from "./useChatScroll";
import { useLaboAgent } from "./useLaboAgent";
import "./laboChat.css";

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
    chatActions,
  } = useLaboAgent();

  const photoInputRef = useRef(null);
  const { logRef, onScroll, newAnswer, showLatest } = useChatScroll(
    messages, busy, pendingProposals.length, statement.rows.length,
  );
  const proposalsTotal = pendingProposals.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="labo-page">
      <PageHeading
        title="Nidhi"
        subtitle="Chat, voice, receipt scans, statement imports, and reports."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Review before saving</strong>
          <span>
            Nidhi shows a review before saving transactions from chat, receipt photos, or statements.
          </span>
        </div>
      </div>

      <section
        className="section-card card labo-chat"
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
            <h2 style={{ margin: 0 }}>Ask Nidhi</h2>
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
              aria-label={voiceMuted ? "Unmute Nidhi voice replies" : "Mute Nidhi voice replies"}
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

        <div className="labo-log-frame">
          <div className="labo-chat-log" ref={logRef} onScroll={onScroll} role="log" aria-label="Chat messages" tabIndex={0}>
            <LaboResources categories={categories} />
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
                {m.report && <ReportCard report={m.report} signature={m.signature} format={m.downloadFormat} />}
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

            {chatActions.pending && (
              <ChatActionCard key={chatActions.pending.id} proposal={chatActions.pending} busy={busy}
                onConfirm={chatActions.confirm} onCancel={chatActions.cancel} />
            )}

            {pendingProposals.length > 0 && (
              <TransactionProposals
                pendingProposals={pendingProposals}
                proposalsTotal={proposalsTotal}
                categories={categories}
                busy={busy}
                dismissProposal={dismissProposal}
                updateProposalItem={updateProposalItem}
                removeProposalItem={removeProposalItem}
                confirmProposal={confirmProposal}
              />
            )}

            {statement.rows.length > 0 && (statement.account
              ? <StatementReview statement={statement} categories={categories} busy={busy} />
              : <StatementAccountPicker statement={statement} busy={busy} />)}
            {busy && <div className="labo-thinking" role="status" aria-label="Thinking" />}
          </div>
          {newAnswer && (
            <button type="button" className="btn primary compact labo-new-answer" onClick={showLatest}>
              ↓ New answer
            </button>
          )}
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
            aria-label="Ask Nidhi a question or enter transactions"
          />

          <button type="submit" className="btn primary compact" disabled={busy || !input.trim()}>
            <Send size={15} /> Ask
          </button>
        </form>
        <StatementAttachment onAttach={statement.attach} disabled={busy || statement.rows.length > 0} />
      </section>

    </div>
  );
}
