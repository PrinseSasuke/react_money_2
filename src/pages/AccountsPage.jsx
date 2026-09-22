import React, { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import AccountModal from "../components/AccountModal";

const TYPE_LABELS = {
  cash: "Наличные",
  card: "Карта",
  savings: "Накопительный",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [reassignFor, setReassignFor] = useState(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [error, setError] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openAdd = () => {
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEdit = (account) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const handleDelete = async (account, reassignTo) => {
    setError("");
    try {
      await api.deleteAccount(account.id, reassignTo);
      setReassignFor(null);
      setReassignTarget("");
      loadAccounts();
    } catch (err) {
      if (err.message.includes("reassignTo")) {
        setReassignFor(account.id);
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div className="container">
      <h2 className="h3">Счета</h2>
      <button type="button" className="button__add_transaction" onClick={openAdd}>
        Добавить счёт
      </button>

      {error && <p style={{ color: "var(--color-expense-text)" }}>{error}</p>}
      {loading && <p>Загрузка...</p>}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        {accounts.map((account) => (
          <div
            key={account.id}
            className="income"
            style={{ minWidth: "220px", flex: "1 1 220px" }}
          >
            <div className="income-text">{account.name}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              {TYPE_LABELS[account.type]} · {account.currency}
            </div>
            <div className="income-count">
              {account.balance.toFixed(2)} {account.currency}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button type="button" onClick={() => openEdit(account)}>
                Изменить
              </button>
              <button type="button" onClick={() => handleDelete(account, null)}>
                Удалить
              </button>
            </div>

            {reassignFor === account.id && (
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  У счёта есть транзакции. Выберите счёт для переноса:
                </p>
                <select
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                >
                  <option value="">Выберите счёт</option>
                  {accounts
                    .filter((a) => a.id !== account.id)
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!reassignTarget}
                  onClick={() => handleDelete(account, reassignTarget)}
                  style={{ marginLeft: "8px" }}
                >
                  Перенести и удалить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <AccountModal
        mode={editingAccount ? "edit" : "add"}
        isOpen={modalOpen}
        initialData={editingAccount}
        onClose={() => setModalOpen(false)}
        onSaved={loadAccounts}
      />
    </div>
  );
}
