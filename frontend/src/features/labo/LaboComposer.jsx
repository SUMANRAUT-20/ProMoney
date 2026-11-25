import { useRef } from 'react';
import { Camera, Mic, MicOff, Paperclip, Send, X } from 'lucide-react';

function fileSize(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export default function LaboComposer({
  input, setInput, attachment, stageFiles, removeAttachment, send, busy, statementPending,
  voiceLang, isListening, speechSupported, toggleListening,
}) {
  const statementInput = useRef(null);
  const photoInput = useRef(null);
  const textInput = useRef(null);
  const onFileSelection = (event) => {
    stageFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  };

  return (
    <>
      {attachment && (
        <div className="labo-attachment" aria-label="Staged attachment">
          <Paperclip size={14} aria-hidden="true" />
          <span className="labo-attachment-name" title={attachment.file.name}>{attachment.file.name}</span>
          <span className="muted small">{fileSize(attachment.file.size)}</span>
          <button type="button" className="icon-button"
            onClick={() => { removeAttachment(); textInput.current?.focus(); }}
            aria-label={`Remove ${attachment.file.name}`}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <form className="labo-input-row" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <input ref={statementInput} type="file" accept=".csv,.pdf,.xlsx" hidden
          aria-label="Upload bank statement" onChange={onFileSelection} />
        <input ref={photoInput} type="file" accept="image/*" hidden
          aria-label="Upload receipt or bill photo" onChange={onFileSelection} />
        <button type="button" className="btn secondary compact" onClick={() => statementInput.current?.click()}
          disabled={busy || statementPending} aria-label="Attach statement"
          title="Attach a statement. Files needing cleaning may be sent to Meta after you send.">
          <Paperclip size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn secondary compact" onClick={() => photoInput.current?.click()}
          disabled={busy} aria-label="Attach bill or receipt photo" title="Attach a bill or receipt photo">
          <Camera size={16} aria-hidden="true" />
        </button>
        <button type="button" className={`btn ${isListening ? 'primary' : 'secondary'} compact`}
          onClick={toggleListening} disabled={busy || !speechSupported} aria-pressed={isListening}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          title={speechSupported
            ? (isListening ? 'Listening — tap to stop' : `Speak in ${voiceLang === 'ja-JP' ? 'Japanese' : 'English'}`)
            : 'Speech recognition not supported in this browser'}>
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <input ref={textInput} className="filter-input" type="text" value={input}
          onChange={(event) => setInput(event.target.value)} placeholder="Message Nidhi…"
          maxLength={500} aria-label="Ask Nidhi a question or enter transactions" />
        <button type="submit" className="btn primary compact" disabled={busy || (!input.trim() && !attachment)}>
          <Send size={16} aria-hidden="true" /> Send
        </button>
      </form>
    </>
  );
}
