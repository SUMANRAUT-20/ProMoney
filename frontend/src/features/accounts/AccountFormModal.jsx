import { useState } from "react";
import { Modal } from "../../components/ui";
import { useFinance } from "../../context/FinanceContext";
import { getParentAccountId, isDebitCardAccount, isLiabilityAccount } from "../../utils/financeMath";

export const accountGroups = [
  {
    id: "bank",
    label: "Bank account",
    kind: "bank",
    providers: ["Japan Post Bank", "MUFG", "SMBC", "Mizuho", "Rakuten Bank", "WISE"],
    ruleHint: "Own money pot (counts in money-you-hold).",
  },
  {
    id: "cash",
    label: "Cash",
    kind: "cash",
    providers: [],
    ruleHint: "Own money pot (counts in money-you-hold).",
  },
  {
    id: "app",
    label: "Payment app",
    kind: "digital",
    providers: ["PayPay", "WISE", "FamiPay", "Rakuten Pay balance", "LINE Pay"],
    ruleHint: "Own money pot (counts in money-you-hold).",
  },
  {
    id: "prepaid",
    label: "Prepaid card",
    kind: "prepaid",
    providers: ["Suica", "PASMO", "ICOCA", "nanaco", "WAON"],
    ruleHint: "Own pot, filled only by TRANSFERS from an account (never income/expense).",
  },
  {
    id: "debit",
    label: "Debit card",
    kind: "debit_card",
    providers: [],
    ruleHint: "NO own balance — a tag on its parent account; spending draws from the parent directly.",
  },
  {
    id: "credit",
    label: "Credit card",
    kind: "credit_card",
    providers: [],
    ruleHint: "DEBT (counts in money-you-owe; paying it off is a transfer).",
  },
  {
    id: "loan",
    label: "Loan",
    kind: "loan",
    providers: [],
    ruleHint: "Counts in money you owe. Use Loans to compare payoff plans.",
  },
];

export function accountGroup(account) {
  if (isDebitCardAccount(account)) {
    return accountGroups.find((g) => g.id === "debit");
  }
  return (
    accountGroups.find((g) => g.id === account?.ui_details?.group) ??
    accountGroups.find((g) => g.kind === account?.kind) ??
    accountGroups[0]
  );
}

const GENERIC_TOKENS = new Set([
  "account",
  "accounts",
  "bank",
  "card",
  "cards",
  "cash",
  "wallet",
  "debit",
  "credit",
  "prepaid",
  "master",
  "mastercard",
  "visa",
  "jcb",
  "amex",
  "sample",
  "main",
  "daily",
  "app",
  "pay",
  "balance",
]);

function extractBrandTokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !GENERIC_TOKENS.has(tok));
}

/**
 * Duplicate guard: detects when a newly typed account name/provider closely matches
 * an existing non-debit account so we can warn the user to link it as a card instead.
 */
export function findCloselyMatchingAccount(inputName, inputProvider, existingAccounts = [], editingId = null) {
  const cleanName = String(inputName || "").toLowerCase().trim();
  const cleanProv = String(inputProvider || "").toLowerCase().trim();
  if (cleanName.length < 3 && cleanProv.length < 3) return null;

  const inputTokens = new Set([...extractBrandTokens(cleanName), ...extractBrandTokens(cleanProv)]);

  for (const acc of existingAccounts) {
    if (!acc || isDebitCardAccount(acc)) continue;
    if (editingId !== null && editingId !== undefined && String(acc.id) === String(editingId)) continue;

    const candName = String(acc.name || "").toLowerCase().trim();
    const candProv = String(acc.ui_details?.provider || "").toLowerCase().trim();
    if (!candName) continue;

    if (
      cleanName.length >= 3 &&
      (cleanName === candName ||
        cleanName.includes(candName) ||
        (candName.length >= 3 && candName.includes(cleanName)))
    ) {
      return acc;
    }

    const candTokens = [...extractBrandTokens(candName), ...extractBrandTokens(candProv)];
    if (candTokens.some((tok) => inputTokens.has(tok))) {
      return acc;
    }
  }
  return null;
}

const VALID_KINDS = accountGroups.map(({ kind }) => kind);

function validateAccount(values, isDebit, parentAccountId) {
  const errors = {};
  const name = values.name.trim();
  if (!name || name.length > 80) errors.name = "Enter an account or card name (1–80 characters).";
  if (!VALID_KINDS.includes(values.kind)) errors.kind = "Choose a valid account kind.";

  if (isDebit) {
    if (!parentAccountId) {
      errors.parent_account_id = "Choose the parent bank or payment app account this debit card belongs to.";
    }
  } else {
    const balText = String(values.manual_balance ?? "").trim();
    if (!/^\d+$/.test(balText) || !Number.isSafeInteger(Number(balText)) || Number(balText) > 1000000000) {
      errors.manual_balance = "Enter a non-negative whole JPY amount (no decimals).";
    }
  }
  return errors;
}

export default function AccountFormModal({ account, initialGroup = "bank", onClose, onSave }) {
  const { accounts } = useFinance();
  const startingGroup = account
    ? accountGroup(account)
    : accountGroups.find((g) => g.id === initialGroup) || accountGroups[0];

  const parentCandidates = accounts.filter(
    (a) =>
      !isDebitCardAccount(a) &&
      !isLiabilityAccount(a) &&
      (!account || String(a.id) !== String(account.id)) &&
      (["bank", "digital", "cash"].includes(a.kind) || ["bank", "app"].includes(a.ui_details?.group))
  );

  const [groupId, setGroupId] = useState(startingGroup.id);
  const [parentAccountId, setParentAccountId] = useState(() => {
    const existingParent = getParentAccountId(account);
    if (existingParent) return String(existingParent);
    return parentCandidates[0]?.id ? String(parentCandidates[0].id) : "";
  });
  const [provider, setProvider] = useState(account?.ui_details?.provider ?? "");
  const [addingProvider, setAddingProvider] = useState(false);
  const [customProvider, setCustomProvider] = useState("");
  const [note, setNote] = useState(account?.ui_details?.note ?? "");
  const [values, setValues] = useState({
    name: account?.name ?? "",
    kind: startingGroup.kind,
    manual_balance: startingGroup.id === "debit" ? "0" : String(account?.manual_balance ?? ""),
  });
  const [errors, setErrors] = useState({});

  const group = accountGroups.find((item) => item.id === groupId) || accountGroups[0];
  const isDebit = groupId === "debit";
  const isDebt = groupId === "credit" || groupId === "loan";

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
    groupId === "bank" ? "bank account" : groupId === "app" ? "payment app" : "prepaid card";
  const hintStyle = { color: "var(--red, #c43838)", fontSize: 12, fontWeight: 400 };

  const parentAccount = parentCandidates.find((a) => String(a.id) === String(parentAccountId)) || null;
  const chosenProvider = isDebit
    ? parentAccount?.ui_details?.provider || parentAccount?.name || ""
    : groupId === "cash"
      ? ""
      : (addingProvider ? customProvider : provider).trim();

  const duplicateMatch = !isDebit
    ? findCloselyMatchingAccount(values.name, chosenProvider, accounts, account?.id)
    : null;

  function update(event) {
    const { name, value } = event.target;
    setValues((cur) => ({ ...cur, [name]: value }));
    setErrors((cur) => ({ ...cur, [name]: undefined }));
  }

  function switchToLinkedDebit(targetParent) {
    setGroupId("debit");
    setParentAccountId(String(targetParent.id));
    setValues((cur) => ({
      ...cur,
      kind: "debit_card",
      manual_balance: "0",
    }));
    setErrors({});
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateAccount(values, isDebit, parentAccountId);
    if (!isDebit && groupId !== "cash" && (!chosenProvider || chosenProvider.length > 80)) {
      nextErrors.provider = "Enter or select a provider name (max 80 characters).";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const finalParentId = isDebit ? parentAccount?.id ?? parentAccountId : null;
    onSave(
      {
        name: values.name.trim(),
        kind: isDebit ? "debit_card" : values.kind,
        manual_balance: isDebit ? 0 : Number(String(values.manual_balance).trim()),
        parent_account_id: finalParentId,
      },
      {
        ...account?.ui_details,
        group: groupId,
        provider: chosenProvider,
        parent_account_id: finalParentId,
        note: note.trim().slice(0, 150),
      }
    );
  }

  return (
    <Modal title={account ? "Edit Account / Card" : "Add Account / Card"} onClose={onClose}>
      <form
        className="form"
        noValidate
        onSubmit={submit}
        style={{ maxHeight: "70dvh", overflowY: "auto", paddingRight: 4 }}
      >
        <p className="muted" style={{ margin: 0 }}>
          {group.ruleHint}
        </p>

        <div className="form-row">
          <label htmlFor="account-group">
            1. What kind is it?
            <select
              id="account-group"
              value={groupId}
              onChange={(e) => {
                const next = accountGroups.find((item) => item.id === e.target.value) || accountGroups[0];
                setGroupId(next.id);
                setProvider("");
                setAddingProvider(false);
                setCustomProvider("");
                if (next.id === "debit" && !parentAccountId && parentCandidates[0]?.id) {
                  setParentAccountId(String(parentCandidates[0].id));
                }
                setValues((cur) => ({
                  ...cur,
                  kind: next.kind,
                  manual_balance: next.id === "debit" ? "0" : cur.manual_balance === "0" ? "" : cur.manual_balance,
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

          {isDebit ? (
            <label htmlFor="account-parent">
              2. What does it belong to? (Parent account)
              <select
                id="account-parent"
                value={parentAccountId}
                onChange={(e) => {
                  setParentAccountId(e.target.value);
                  setErrors((c) => ({ ...c, parent_account_id: undefined }));
                }}
              >
                <option value="">Select parent bank / payment app</option>
                {parentCandidates.map((cand) => (
                  <option key={cand.id} value={cand.id}>
                    {cand.name}
                    {cand.ui_details?.provider ? ` (${cand.ui_details.provider})` : ""}
                  </option>
                ))}
              </select>
              {errors.parent_account_id && (
                <span role="alert" style={hintStyle}>
                  {errors.parent_account_id}
                </span>
              )}
            </label>
          ) : (
            groupId !== "cash" && (
              <label htmlFor="account-provider">
                2. What does it belong to? (Provider)
                {isDebt ? (
                  <input
                    id="account-provider"
                    value={provider}
                    maxLength={80}
                    placeholder={groupId === "loan" ? "Name of lender" : "e.g. Rakuten Card"}
                    onChange={(e) => {
                      setProvider(e.target.value);
                      setErrors((c) => ({ ...c, provider: undefined }));
                    }}
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
                  <span role="alert" style={hintStyle}>
                    {errors.provider}
                  </span>
                )}
              </label>
            )
          )}
        </div>

        {addingProvider && !isDebit && groupId !== "cash" && !isDebt && (
          <label htmlFor="custom-provider">
            Add {providerLabel}
            <input
              id="custom-provider"
              value={customProvider}
              maxLength={80}
              placeholder="e.g. SBI Sumishin Net Bank"
              onChange={(e) => {
                setCustomProvider(e.target.value);
                setErrors((c) => ({ ...c, provider: undefined }));
              }}
            />
          </label>
        )}

        <label htmlFor="account-name">
          {isDebit ? "Debit card name" : "Account nickname"}
          <input
            id="account-name"
            name="name"
            value={values.name}
            maxLength={80}
            onChange={update}
            placeholder={
              isDebit
                ? "e.g. WISE Master Card"
                : groupId === "cash"
                  ? "e.g. Daily wallet"
                  : groupId === "credit"
                    ? "e.g. Shopping card"
                    : "e.g. Salary account"
            }
          />
          {errors.name && (
            <span role="alert" style={hintStyle}>
              {errors.name}
            </span>
          )}
        </label>

        {duplicateMatch && !isDebit && (
          <div
            role="alert"
            className="duplicate-account-warning"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(217, 119, 6, 0.12)",
              border: "1px solid rgba(217, 119, 6, 0.45)",
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span>
              ⚠️ Name closely matches existing account <strong>{duplicateMatch.name}</strong> — link it as a card of that account instead so your money is not counted twice.
            </span>
            <div>
              <button
                type="button"
                className="btn secondary compact"
                onClick={() => switchToLinkedDebit(duplicateMatch)}
              >
                Link it as a card of {duplicateMatch.name} instead
              </button>
            </div>
          </div>
        )}

        <div className="form-row">
          {!isDebit ? (
            <label htmlFor="account-balance">
              {isDebt ? "Opening amount owed (JPY)" : "Opening balance (JPY)"}
              <input
                id="account-balance"
                name="manual_balance"
                type="text"
                inputMode="numeric"
                value={values.manual_balance}
                onChange={update}
                placeholder="e.g. 50000"
              />
              {errors.manual_balance && (
                <span role="alert" style={hintStyle}>
                  {errors.manual_balance}
                </span>
              )}
            </label>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span className="muted small">
                💳 Linked debit card has no own balance — spending draws directly from{" "}
                <strong>{parentAccount?.name || "its parent account"}</strong>.
              </span>
            </div>
          )}

          <label htmlFor="account-note">
            Note (Optional)
            <input
              id="account-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={150}
              placeholder={isDebit ? "e.g. Linked debit card" : "e.g. Main account"}
            />
          </label>
        </div>

        <div className="form-actions">
          <button className="btn secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            {account ? "Save Changes" : isDebit ? "Link Debit Card" : "Add Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
