import { useState } from "react";
import { Modal } from "../../components/ui";
import { useFinance } from "../../context/FinanceContext";

export const accountGroups = [
  { id: "cash", label: "Cash", kind: "cash", providers: [] },
  { id: "bank", label: "Bank accounts", kind: "bank", providers: ["Japan Post Bank", "MUFG", "SMBC", "Mizuho", "Rakuten Bank"] },
  { id: "app", label: "Payment apps", kind: "cash", providers: ["PayPay", "FamiPay", "Rakuten Pay balance"] },
  { id: "prepaid", label: "Transport & prepaid cards", kind: "cash", providers: ["Suica", "PASMO", "ICOCA", "nanaco", "WAON"] },
  { id: "credit", label: "Credit Card", kind: "credit_card", providers: [] },
];

export function accountGroup(account) {
  return (
    accountGroups.find((g) => g.id === account.ui_details?.group) ??
    accountGroups.find((g) => g.kind === account.kind) ??
    accountGroups[0]
  );
}

function validateAccount(values) {
  const errors = {};
  const name = values.name.trim();
  const balText = String(values.manual_balance ?? "").trim();
  if (!name || name.length > 80) errors.name = "Enter an account name (1–80 characters).";
  if (!["cash", "bank", "credit_card"].includes(values.kind)) errors.kind = "Choose a valid account kind.";
  if (!/^\d+$/.test(balText) || !Number.isSafeInteger(Number(balText)) || Number(balText) > 1000000000) {
    errors.manual_balance = "Enter a non-negative whole JPY amount (no decimals).";
  }
  return errors;
}

export default function AccountFormModal({ account, initialGroup = "bank", onClose, onSave }) {
  const { accounts } = useFinance();
  const startingGroup = account ? accountGroup(account) : accountGroups.find((g) => g.id === initialGroup) || accountGroups[1];
  const [groupId, setGroupId] = useState(startingGroup.id);
  const [provider, setProvider] = useState(account?.ui_details?.provider ?? "");
  const [addingProvider, setAddingProvider] = useState(false);
  const [customProvider, setCustomProvider] = useState("");
  const [note, setNote] = useState(account?.ui_details?.note ?? "");
  const [values, setValues] = useState({
    name: account?.name ?? "",
    kind: startingGroup.kind,
    manual_balance: String(account?.manual_balance ?? ""),
  });
  const [errors, setErrors] = useState({});

  const group = accountGroups.find((item) => item.id === groupId);
  const providerOptions = [
    ...new Set([
      ...group.providers,
      ...accounts
        .filter((item) => accountGroup(item).id === groupId)
        .map((item) => item.ui_details?.provider)
        .filter((item) => item && item !== "Other"),
    ]),
  ];
  const providerLabel = groupId === "bank" ? "bank account" : groupId === "app" ? "payment app" : "prepaid card";
  const hintStyle = { color: "var(--red, #c43838)", fontSize: 12, fontWeight: 400 };
  const chosenProvider = groupId === "cash" ? "" : (addingProvider ? customProvider : provider).trim();

  function update(event) {
    const { name, value } = event.target;
    setValues((cur) => ({ ...cur, [name]: value }));
    setErrors((cur) => ({ ...cur, [name]: undefined }));
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateAccount(values);
    if (groupId !== "cash" && (!chosenProvider || chosenProvider.length > 80)) {
      nextErrors.provider = "Enter or select a provider name (max 80 characters).";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(
      { name: values.name.trim(), kind: values.kind, manual_balance: Number(String(values.manual_balance).trim()) },
      { group: groupId, provider: chosenProvider, note: note.trim().slice(0, 150) },
    );
  }

  return (
    <Modal title={account ? "Edit Account" : "Add Account"} onClose={onClose}>
      <form className="form" noValidate onSubmit={submit} style={{ maxHeight: "70dvh", overflowY: "auto", paddingRight: 4 }}>
        <p className="muted" style={{ margin: 0 }}>
          Set your opening manual balance in JPY. Linked transactions adjust the live balance automatically.
        </p>
        <div className="form-row">
          <label htmlFor="account-group">
            Account group
            <select
              id="account-group"
              value={groupId}
              onChange={(e) => {
                const next = accountGroups.find((item) => item.id === e.target.value);
                setGroupId(next.id);
                setProvider("");
                setAddingProvider(false);
                setCustomProvider("");
                setValues((cur) => ({ ...cur, kind: next.kind, manual_balance: "" }));
                setErrors({});
              }}
            >
              {accountGroups.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          {groupId !== "cash" && (
            <label htmlFor="account-provider">
              Provider
              {groupId === "credit" ? (
                <input
                  id="account-provider"
                  value={provider}
                  maxLength={80}
                  placeholder="e.g. Rakuten Card"
                  onChange={(e) => { setProvider(e.target.value); setErrors((c) => ({ ...c, provider: undefined })); }}
                />
              ) : (
                <select
                  id="account-provider"
                  value={addingProvider ? "__add__" : provider}
                  onChange={(e) => {
                    setAddingProvider(e.target.value === "__add__");
                    setProvider(e.target.value === "__add__" ? "" : e.target.value);
                    setErrors((c) => ({ ...c, provider: undefined }));
                  }}
                >
                  <option value="" disabled>Select a {providerLabel}</option>
                  {providerOptions.map((item) => <option key={item}>{item}</option>)}
                  <option value="__add__">+ Add {providerLabel}</option>
                </select>
              )}
              {errors.provider && <span role="alert" style={hintStyle}>{errors.provider}</span>}
            </label>
          )}
        </div>
        {addingProvider && groupId !== "cash" && groupId !== "credit" && (
          <label htmlFor="custom-provider">
            Add {providerLabel}
            <input
              id="custom-provider"
              value={customProvider}
              maxLength={80}
              placeholder="e.g. SBI Sumishin Net Bank"
              onChange={(e) => { setCustomProvider(e.target.value); setErrors((c) => ({ ...c, provider: undefined })); }}
            />
          </label>
        )}
        <label htmlFor="account-name">
          Account nickname
          <input
            id="account-name"
            name="name"
            value={values.name}
            maxLength={80}
            onChange={update}
            placeholder={groupId === "cash" ? "e.g. Daily wallet" : groupId === "credit" ? "e.g. Shopping card" : "e.g. Salary account"}
          />
          {errors.name && <span role="alert" style={hintStyle}>{errors.name}</span>}
        </label>
        <div className="form-row">
          <label htmlFor="account-balance">
            {groupId === "credit" ? "Opening amount owed (JPY)" : "Opening balance (JPY)"}
            <input
              id="account-balance"
              name="manual_balance"
              type="text"
              inputMode="numeric"
              value={values.manual_balance}
              onChange={update}
              placeholder="e.g. 50000"
            />
            {errors.manual_balance && <span role="alert" style={hintStyle}>{errors.manual_balance}</span>}
          </label>
          <label htmlFor="account-note">
            Note (Optional)
            <input
              id="account-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={150}
              placeholder="e.g. Main account"
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="submit">{account ? "Save Changes" : "Add Account"}</button>
        </div>
      </form>
    </Modal>
  );
}
