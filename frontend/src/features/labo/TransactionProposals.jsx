import { Check, Trash2, X } from "lucide-react";
import { money } from "../../utils/formatters";

export default function TransactionProposals({
  pendingProposals, proposalsTotal, categories, busy,
  dismissProposal, updateProposalItem, removeProposalItem, confirmProposal,
}) {
  return (
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
  );
}
