import { useState } from "react";
import { Plus, Wallet, CreditCard, Scale } from "lucide-react";
import { EmptyState, Metric, Modal, PageHeading } from "../../components/ui";
import { useFinance } from "../../context/FinanceContext";
import { money, sum } from "../../utils/formatters";
import AccountFormModal, {
  accountGroups,
  accountGroup,
} from "./AccountFormModal";

/**
 * Accounts View Foundation
 * Owner: Rajesh Mishra (Member 1)
 *
 * Clean starter foundation without fabricated bank or cash wallet balances.
 */
export default function AccountsView() {
  const { accounts, setAccounts } = useFinance();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [initialGroup, setInitialGroup] = useState("bank");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const selectedAccounts = accounts.filter(
    (account) => accountGroup(account).id === selectedGroup?.id,
  );
  const held = sum(
    accounts.filter((account) => account.kind !== "credit_card"),
    "manual_balance",
  );
  const owed = sum(
    accounts.filter((account) => account.kind === "credit_card"),
    "manual_balance",
  );

  function openAccount(group = "bank", account = null) {
    setInitialGroup(group);
    setEditingAccount(account);
    setFormOpen(true);
  }

  function saveAccount(values, uiDetails) {
    // UI details stay in in-memory state; they are not an API payload.
    if (editingAccount) {
      setAccounts((current) =>
        current.map((account) =>
          account.id === editingAccount.id
            ? { ...account, ...values, ui_details: uiDetails }
            : account,
        ),
      );
    } else {
      const account = {
        ...values,
        id: `local-${crypto.randomUUID()}`,
        currency: "JPY",
        ui_details: uiDetails,
      };
      setAccounts((current) => [...current, account]);
    }
    setFormOpen(false);
  }

  return (
    <>
      <PageHeading
        title="Accounts"
        subtitle="Everything you hold. Everything you owe."
        action={
          <button
            className="btn primary"
            type="button"
            onClick={() => openAccount()}
            aria-label="Add Account"
          >
            <Plus size={16} aria-hidden="true" />
            Add Account
          </button>
        }
      />

      <section
        className="metrics-grid"
        aria-label="Accounts summary"
        aria-live="polite"
      >
        <Metric icon={Wallet} label="Money you hold" value={money(held)} />
        <Metric icon={CreditCard} label="Money you owe" value={money(owed)} />
        <Metric icon={Scale} label="Net balance" value={money(held - owed)} />
      </section>

      <p className="support-note">
        {accounts.length} accounts · Credit balances represent what you owe, not
        available credit.
      </p>
      <section
        aria-label="Your accounts"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
          gap: 10,
          gridAutoRows: "1fr",
        }}
      >
        {accountGroups.map((group) => {
          const items = accounts.filter(
            (account) => accountGroup(account).id === group.id,
          );
          return (
            <button
              className="btn secondary"
              key={group.id}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setSelectedGroup(group)}
              style={{
                width: "100%",
                minHeight: 72,
                height: "100%",
                whiteSpace: "normal",
                textAlign: "center",
              }}
            >
              {group.label} · {items.length}
            </button>
          );
        })}
      </section>
      {selectedGroup && !formOpen && (
        <Modal
          title={selectedGroup.label}
          onClose={() => setSelectedGroup(null)}
        >
          <div
            style={{
              maxHeight: "65dvh",
              overflowY: "auto",
              overflowWrap: "anywhere",
              paddingRight: 4,
            }}
          >
            <div className="section-title">
              <p className="muted">
                {selectedAccounts.length}{" "}
                {selectedAccounts.length === 1 ? "account" : "accounts"} · JPY
              </p>
              <button
                className="btn primary"
                type="button"
                onClick={() => openAccount(selectedGroup.id)}
              >
                <Plus size={16} aria-hidden="true" />
                Add Account
              </button>
            </div>
            {selectedAccounts.length === 0 && (
              <EmptyState
                icon="🏦"
                title="No accounts yet"
                description="Add an account to this group to get started."
              />
            )}
            <div style={{ display: "grid", gap: 12 }}>
              {selectedAccounts.map((account) => (
                <article className="account-card card" key={account.id}>
                  <h3>{account.name}</h3>
                  <p>{account.ui_details?.provider ?? selectedGroup.label}</p>
                  <strong>{money(account.manual_balance)}</strong>
                  <p>
                    {selectedGroup.id === "credit"
                      ? "Amount owed"
                      : "Manual balance"}{" "}
                    · JPY
                  </p>
                  {account.ui_details?.note && <p>{account.ui_details.note}</p>}
                  <button
                    className="btn secondary"
                    type="button"
                    aria-label={`Edit ${account.name}`}
                    onClick={() => openAccount(selectedGroup.id, account)}
                  >
                    Edit
                  </button>
                </article>
              ))}
            </div>
          </div>
        </Modal>
      )}
      <p className="support-note">
        Accounts are kept for this session only and reset when you refresh the
        page.
      </p>
      {formOpen && (
        <AccountFormModal
          account={editingAccount}
          initialGroup={initialGroup}
          onClose={() => setFormOpen(false)}
          onSave={saveAccount}
        />
      )}
    </>
  );
}
