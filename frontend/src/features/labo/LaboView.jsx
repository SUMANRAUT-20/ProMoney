import { useState } from "react";
import {
  Bot,
  BellRing,
  Info,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { StatementReview } from "./StatementImport";
import LaboComposer from "./LaboComposer";
import { sendChatDraft, stageChatAttachment } from "./composerDraft";
import { ReportCard } from "./ReportCard";
import { AllocationCard, PurchaseCard } from "./SimulatorCards";
import ChatActionCard from "./ChatActionCard";
import MemoryReview from "./MemoryReview";
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
    decideMemory,
  } = useLaboAgent();

  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const { logRef, onScroll, newAnswer, showLatest } = useChatScroll(
    messages, busy, pendingProposals.length, statement.rows.length,
  );
  const proposalsTotal = pendingProposals.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  function stageFiles(files) {
    if (!files.length) return;
    try {
      setAttachment(stageChatAttachment(files));
      setAttachmentError("");
    } catch (err) {
      setAttachmentError(err.message);
    }
  }

  function removeAttachment() {
    setAttachment(null);
    setAttachmentError("");
  }

  function send() {
    if (busy || (!input.trim() && !attachment)) return;
    if (attachment && attachment.format !== "photo" && statement.rows.length) {
      setAttachmentError("Finish or cancel the current statement review before sending another statement.");
      return;
    }
    setAttachmentError("");
    if (attachment) {
      setAttachment(null);
      setInput("");
    }
    sendChatDraft(input, attachment, { ask, scanPhoto, importStatement: statement.attach });
  }

  return (
      <section
        className="labo-page"
        aria-label="Nidhi chat"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          stageFiles(event.dataTransfer.files);
        }}
      >
        <header className="labo-header">
          <div className="labo-heading">
            <Bot size={20} color="var(--green)" />
            <h1>Nidhi</h1>
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

          <div className="labo-voice-controls">
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
            <button type="button" className="btn secondary compact" disabled={busy} aria-label="Hear alerts" title="Hear alerts"
              onClick={() => ask(voiceLang === "ja-JP" ? "アラートを聞く" : "Hear alerts")}>
              <BellRing size={15} aria-hidden="true" /> <span>Hear alerts</span>
            </button>
          </div>
        </header>

        <div className="labo-log-frame">
          <div className="labo-chat-log" ref={logRef} onScroll={onScroll} role="log" aria-label="Chat messages" tabIndex={0}>
            <p className="labo-review-note muted small">
              <Info size={15} aria-hidden="true" /> Review proposed transactions before saving.
            </p>
            <LaboResources categories={categories} />
            {messages.length === 0 && (
              <p className="muted small" style={{ margin: 0 }}>
                Quick add or question: ask here. See or fix everything: use the pages. Keep a copy: download a report.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={m.id || i}
                className={`labo-msg ${m.role === "user" ? "labo-msg-user" : "labo-msg-ai"}`}
              >
                <div>{m.text}</div>
                {m.memoryProposal && <MemoryReview proposal={m.memoryProposal} onDecision={(remembered) => decideMemory(m.id, remembered)} />}
                {m.remembered && <p className="muted small" role="status">Remembered</p>}
                {m.report && <ReportCard report={m.report} signature={m.signature} downloadFormat={m.downloadFormat} />}
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

            {statement.rows.length > 0 && <StatementReview statement={statement} categories={categories} busy={busy} />}
            {busy && <div className="labo-thinking" role="status" aria-label="Thinking" />}
          </div>
          {newAnswer && (
            <button type="button" className="btn primary compact labo-new-answer" onClick={showLatest}>
              ↓ New answer
            </button>
          )}
        </div>

        <div className="labo-composer">
          <div className="labo-quick">
            {quickQuestions.map((q) => (
              <button key={q} type="button" className="labo-chip" onClick={() => ask(q)} disabled={busy}>
                {q}
              </button>
            ))}
          </div>
          {(attachmentError || error) && (
            <p className="labo-composer-error small" role="alert">{attachmentError || error}</p>
          )}
          <LaboComposer
            input={input} setInput={setInput} attachment={attachment} stageFiles={stageFiles}
            removeAttachment={removeAttachment} send={send} busy={busy} statementPending={statement.rows.length > 0}
            voiceLang={voiceLang} isListening={isListening} speechSupported={speechSupported} toggleListening={toggleListening}
          />
        </div>
      </section>
  );
}
