import { useState } from "react";
import { CreditCard, Pencil, Plus, Scale, Trash2, Wallet } from "lucide-react";
import { EmptyState, Metric, Modal, PageHeading } from "../../components/ui";
import { useFinance } from "../../context/FinanceContext";
import { money, todayISO } from "../../utils/formatters";
import {
  getAccountPosition,
  getAccountTotals,
  getParentAccountId,
  isDebitCardAccount,
  isCardPaymentDestination,
  isLiabilityAccount,
} from "../../utils/financeMath";
import AccountFormModal, { accountGroup, accountGroups } from "./AccountFormModal";

export default function AccountsView() {
  const { accounts, addAccount, editAccount, removeAccount, transactions } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [initialGroup, setInitialGroup] = useState("bank");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const today = todayISO();
  const { held, owed, net } = getAccountTotals(accounts, transactions, today);
  const standaloneAccounts = accounts.filter((a) => !isDebitCardAccount(a));
  const selectedAccounts = accounts.filter((a) => accountGroup(a).id === selectedGroup?.id);

  function openAccount(group = "bank", account = null) {
    setInitialGroup(group);
    setEditingAccount(account);
    setFormOpen(true);
  }

  async function saveAccount(values, uiDetails) {
    if (editingAccount) {
      await editAccount(editingAccount.id, values, uiDetails);
    } else {
      await addAccount(values, uiDetails);
    }
    setFormOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    try {
      await removeAccount(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message || "Could not delete account.");
    }
  }

  function renderAccountCard(account) {
    const group = accountGroup(account);
    const isDebit = isDebitCardAccount(account);
    const parentId = getParentAccountId(account);
    const parentAcc = parentId ? accounts.find((a) => String(a.id) === String(parentId)) : null;

    if (isDebit) {
      return (
        <article className="account-card card" key={account.id}>
          <div className="budget-top">
            <div>
              <h3>💳 {account.name} — linked</h3>
              <p style={{ margin: 0 }}>
                Linked to <strong>{parentAcc?.name || "parent account"}</strong> (draws from parent directly)
              </p>
            </div>
            <span className="neutral-badge">{group.label}</span>
          </div>
          {account.ui_details?.note && <p style={{ marginTop: 8 }}>{account.ui_details.note}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn secondary compact" type="button" onClick={() => openAccount("debit", account)}>
              <Pencil size={14} /> Edit
            </button>
            <button
              className="btn secondary compact"
              type="button"
              onClick={() => {
                setDeleteError("");
                setDeleteTarget(account);
              }}
              aria-label={`Delete ${account.name}`}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </article>
      );
    }

    const position = getAccountPosition(account, transactions, today, accounts);
    const cardCredit = position < 0 && isCardPaymentDestination(account);
    const txDelta = position - Number(account.manual_balance || 0);
    const linkedDebitCards = accounts.filter(
      (item) => isDebitCardAccount(item) && String(getParentAccountId(item)) === String(account.id)
    );

    return (
      <article className="account-card card" key={account.id}>
        <div className="budget-top">
          <div>
            <h3>{account.name}</h3>
            <p style={{ margin: 0 }}>{account.ui_details?.provider || group.label}</p>
          </div>
          <span className="neutral-badge">{group.label}</span>
        </div>
        <div style={{ margin: "14px 0 8px" }}>
          <strong>{money(cardCredit ? -position : position)}</strong>
          <p style={{ margin: "4px 0 0" }}>
            {cardCredit ? "Card credit" : isLiabilityAccount(account) ? "Current amount owed" : "Live balance"} · Opening {money(account.manual_balance)}
            {txDelta !== 0 ? ` (${txDelta > 0 ? "+" : ""}${money(txDelta)} from tx)` : ""}
          </p>
        </div>
        {linkedDebitCards.length > 0 && (
          <div
            className="linked-debit-tags"
            style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" }}
          >
            {linkedDebitCards.map((dc) => (
              <div
                key={dc.id}
                className="linked-debit-tag"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: "var(--surface-muted, rgba(15, 23, 42, 0.06))",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>💳 {dc.name} — linked</span>
                <span style={{ display: "inline-flex", gap: 4 }}>
                  <button
                    className="icon-button"
                    type="button"
                    title={`Edit ${dc.name}`}
                    aria-label={`Edit ${dc.name}`}
                    onClick={() => openAccount("debit", dc)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={`Delete ${dc.name}`}
                    aria-label={`Delete ${dc.name}`}
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget(dc);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        {account.ui_details?.note && <p>{account.ui_details.note}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn secondary compact" type="button" onClick={() => openAccount(group.id, account)}>
            <Pencil size={14} /> Edit
          </button>
          <button
            className="btn secondary compact"
            type="button"
            onClick={() => {
              setDeleteError("");
              setDeleteTarget(account);
            }}
            aria-label={`Delete ${account.name}`}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </article>
    );
  }

  return (
    <>
      <PageHeading
        title="My Accounts"
        subtitle="Manage your JPY bank accounts, cash wallets, IC cards, and credit balances."
        action={
          <button className="btn primary" type="button" onClick={() => openAccount()}>
            <Plus size={16} /> Add Account
          </button>
        }
      />

      <section className="metrics-grid" aria-label="Accounts summary" style={{ marginBottom: 14 }}>
        <Metric icon={Wallet} label="Money you hold" value={money(held)} />
        <Metric icon={CreditCard} label="Money you owe" value={money(owed)} small="Credit card balances" />
        <Metric icon={Scale} label="Net balance" value={money(net)} small="Matches Home total" />
      </section>

      <section
        aria-label="Account groups"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 10, marginBottom: 16 }}
      >
        {accountGroups.map((group) => {
          const count = accounts.filter((a) => accountGroup(a).id === group.id).length;
          return (
            <button
              className="btn secondary"
              key={group.id}
              type="button"
              onClick={() => setSelectedGroup(group)}
              style={{ minHeight: 54, whiteSpace: "normal" }}
            >
              {group.label} · {count}
            </button>
          );
        })}
      </section>

      {standaloneAccounts.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="No accounts added yet"
          description="Add a bank account, cash wallet, or card to track live balances across transactions."
          action={
            <button className="btn primary" type="button" onClick={() => openAccount()}>
              <Plus size={15} /> Add First Account
            </button>
          }
        />
      ) : (
        <section className="account-grid">{standaloneAccounts.map(renderAccountCard)}</section>
      )}

      <p className="support-note">
        Live balances automatically include income, expenses, and transfers linked to each account.
      </p>

      {selectedGroup && !formOpen && (
        <Modal title={selectedGroup.label} onClose={() => setSelectedGroup(null)}>
          <div style={{ maxHeight: "65dvh", overflowY: "auto", paddingRight: 4 }}>
            <div className="section-title">
              <span className="muted small">{selectedAccounts.length} in group</span>
              <button className="btn primary compact" type="button" onClick={() => openAccount(selectedGroup.id)}>
                <Plus size={15} /> Add to {selectedGroup.label}
              </button>
            </div>
            {selectedAccounts.length === 0 ? (
              <EmptyState
                icon="🏦"
                title={`No ${selectedGroup.label.toLowerCase()} yet`}
                description="Add an account in this category to track its JPY balance."
                action={
                  <button className="btn primary" type="button" onClick={() => openAccount(selectedGroup.id)}>
                    <Plus size={15} /> Add Account
                  </button>
                }
              />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>{selectedAccounts.map(renderAccountCard)}</div>
            )}
          </div>
        </Modal>
      )}

      {formOpen && (
        <AccountFormModal
          account={editingAccount}
          initialGroup={initialGroup}
          onClose={() => setFormOpen(false)}
          onSave={saveAccount}
        />
      )}

      {deleteTarget && (
        <Modal title="Delete Account" onClose={() => setDeleteTarget(null)}>
          <p>Delete <strong>{deleteTarget.name}</strong>?</p>
          {deleteError && <p className="negative" role="alert">{deleteError}</p>}
          <div className="form-actions">
            <button className="btn secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn primary" type="button" onClick={confirmDelete}>Delete Account</button>
          </div>
        </Modal>
      )}
    </>
  );
}
