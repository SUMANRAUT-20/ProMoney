import { useState } from "react";
import { Modal } from "../../components/ui";
import { useFinance } from "../../context/FinanceContext";

// UI-only choices: these are not additional API account kinds.
export const accountGroups = [
  { id: "cash", label: "Cash", kind: "cash", providers: [] },
  {
    id: "bank",
    label: "Bank accounts",
    kind: "bank",
    providers: ["Japan Post Bank", "MUFG", "SMBC", "Mizuho", "Rakuten Bank"],
  },
  {
    id: "app",
    label: "Payment apps",
    kind: "cash",
    providers: ["PayPay", "FamiPay", "Rakuten Pay balance"],
  },
  {
    id: "prepaid",
    label: "Transport & prepaid cards",
    kind: "cash",
    providers: ["Suica", "PASMO", "ICOCA", "nanaco", "WAON"],
  },
  { id: "credit", label: "Credit Card", kind: "credit_card", providers: [] },
];

export function accountGroup(account) {
  return (
    accountGroups.find((group) => group.id === account.ui_details?.group) ??
    accountGroups.find((group) => group.kind === account.kind) ??
    accountGroups[0]
  );
}

export function validateAccount(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Enter an account name.";
  if (!["cash", "bank", "credit_card"].includes(values.kind)) {
    errors.kind = "Choose a valid account kind.";
  }
  if (
    !/^\d+$/.test(values.manual_balance) ||
    !Number.isSafeInteger(Number(values.manual_balance))
  ) {
    errors.manual_balance =
      "Enter a non-negative whole JPY amount (no decimals).";
  }
  return errors;
}

export default function AccountFormModal({
  account,
  initialGroup = "bank",
  onClose,
  onSave,
}) {
  const { accounts } = useFinance();
  const startingGroup = account
    ? accountGroup(account)
    : accountGroups.find((group) => group.id === initialGroup);
  const [groupId, setGroupId] = useState(startingGroup.id);
  const [provider, setProvider] = useState(account?.ui_details?.provider ?? "");
  const [addingProvider, setAddingProvider] = useState(false);
  const [customProvider, setCustomProvider] = useState("");
  const [note, setNote] = useState(account?.ui_details?.note ?? "");
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
  const providerLabel =
    groupId === "bank"
      ? "bank account"
      : groupId === "app"
        ? "payment app"
        : "prepaid card";
  const hintStyle = {
    color: "var(--red, #c43838)",
    fontSize: 12,
    fontWeight: 400,
  };
  const chosenProvider =
    groupId === "cash"
      ? ""
      : (addingProvider ? customProvider : provider).trim();
  const [values, setValues] = useState({
    name: account?.name ?? "",
    kind: startingGroup.kind,
    manual_balance: String(account?.manual_balance ?? ""),
  });
  const [errors, setErrors] = useState({});

  function update(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateAccount(values);
    if (groupId !== "cash" && !chosenProvider)
      nextErrors.provider = "Enter or select a provider name.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(
      {
        name: values.name.trim(),
        kind: values.kind,
        manual_balance: Number(values.manual_balance),
      },
      { group: groupId, provider: chosenProvider, note: note.trim() },
    );
  }

  return (
    <Modal title={account ? "Edit Account" : "Add Account"} onClose={onClose}>
      <form
        className="form"
        noValidate
        onSubmit={submit}
        style={{ maxHeight: "70dvh", overflowY: "auto", paddingRight: 4 }}
      >
        <p className="muted">
          Balances are set manually in JPY. Changes are kept for this session
          only.
        </p>
        <div className="form-row">
          <label htmlFor="account-group">
            Account group
            <select
              id="account-group"
              value={groupId}
              onChange={(event) => {
                const next = accountGroups.find(
                  (item) => item.id === event.target.value,
                );
                setGroupId(next.id);
                setProvider("");
                setAddingProvider(false);
                setCustomProvider("");
                setValues((current) => ({
                  ...current,
                  kind: next.kind,
                  manual_balance: "",
                }));
                setErrors({});
              }}
            >
              {accountGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
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
                  placeholder="e.g. Mastercard"
                  required
                  aria-invalid={Boolean(errors.provider)}
                  aria-describedby={
                    errors.provider ? "provider-error" : undefined
                  }
                  onChange={(event) => {
                    setProvider(event.target.value);
                    setErrors((current) => ({
                      ...current,
                      provider: undefined,
                    }));
                  }}
                />
              ) : (
                <select
                  id="account-provider"
                  value={addingProvider ? "__add__" : provider}
                  aria-invalid={Boolean(errors.provider)}
                  aria-describedby={
                    errors.provider ? "provider-error" : undefined
                  }
                  onChange={(event) => {
                    setAddingProvider(event.target.value === "__add__");
                    setProvider(
                      event.target.value === "__add__"
                        ? ""
                        : event.target.value,
                    );
                    setErrors((current) => ({
                      ...current,
                      provider: undefined,
                    }));
                  }}
                >
                  <option value="" disabled>
                    Select a {providerLabel}
                  </option>
                  {providerOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                  <option value="__add__">+ Add {providerLabel}</option>
                </select>
              )}
              {errors.provider && (
                <span id="provider-error" role="alert" style={hintStyle}>
                  {errors.provider}
                </span>
              )}
            </label>
          )}
        </div>
        {addingProvider && groupId !== "cash" && groupId !== "credit" && (
          <label htmlFor="custom-provider">
            Add {providerLabel}
            <input
              id="custom-provider"
              value={customProvider}
              required
              placeholder={
                groupId === "bank"
                  ? "e.g. SBI Sumishin Net Bank"
                  : groupId === "app"
                    ? "e.g. My payment app"
                    : "e.g. My prepaid card"
              }
              aria-invalid={Boolean(errors.provider)}
              aria-describedby={errors.provider ? "provider-error" : undefined}
              onChange={(event) => {
                setCustomProvider(event.target.value);
                setErrors((current) => ({ ...current, provider: undefined }));
              }}
            />
          </label>
        )}
        <label htmlFor="account-name">
          Account nickname
          <input
            id="account-name"
            name="name"
            value={values.name}
            onChange={update}
            autoFocus
            required
            placeholder={
              groupId === "cash"
                ? "e.g. Daily wallet"
                : groupId === "credit"
                  ? "e.g. Shopping card"
                  : "e.g. Salary account"
            }
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "account-name-error" : undefined}
          />
          {errors.name && (
            <span id="account-name-error" role="alert" style={hintStyle}>
              {errors.name}
            </span>
          )}
        </label>
        <div className="form-row">
          <label htmlFor="account-balance">
            {groupId === "credit"
              ? "Amount you owe (JPY)"
              : "Current balance (JPY)"}
            <input
              id="account-balance"
              name="manual_balance"
              type="text"
              inputMode="numeric"
              value={values.manual_balance}
              onChange={update}
              required
              placeholder="e.g. 50000"
              aria-invalid={Boolean(errors.manual_balance)}
              aria-describedby={
                errors.manual_balance ? "account-balance-error" : undefined
              }
            />
            {errors.manual_balance && (
              <span id="account-balance-error" role="alert" style={hintStyle}>
                {errors.manual_balance}
              </span>
            )}
          </label>
        </div>
        <details>
          <summary>Optional details</summary>
          <label htmlFor="account-note">
            Note
            <input
              id="account-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={150}
              placeholder="e.g. For daily groceries"
            />
          </label>
        </details>
        <div className="form-actions">
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            {account ? "Save Changes" : "Add Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
