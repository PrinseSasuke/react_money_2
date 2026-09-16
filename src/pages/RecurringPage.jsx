import React, { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import RecurringModal from "../components/RecurringModal";

const FREQUENCY_LABELS = {
  daily: "Ежедневно",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
};

const formatDate = (value) => String(value).slice(0, 10);

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.getRecurring();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (item) => {
    try {
      await api.updateRecurring(item.id, { active: !item.active });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (item) => {
    try {
      await api.deleteRecurring(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <h2 className="h3">Регулярные платежи</h2>
      <button
        type="button"
        className="button__add_transaction"
        onClick={() => {
          setEditingItem(null);
          setModalOpen(true);
        }}
      >
        Добавить платёж
      </button>

      {error && <p style={{ color: "var(--color-expense-text)" }}>{error}</p>}
      {loading && <p>Загрузка...</p>}
      {!loading && items.length === 0 && (
        <p style={{ color: "var(--text-secondary)", marginTop: "16px" }}>
          Пока нет регулярных платежей
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        {items.map((item) => (
          <div
            key={item.id}
            className="income"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: item.active ? 1 : 0.5,
            }}
          >
            <div>
              <div className="income-text">
                {item.source} {item.description && `— ${item.description}`}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                {FREQUENCY_LABELS[item.frequency]} · следующее списание{" "}
                {formatDate(item.next_run_date)}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  color:
                    item.type === "Доход"
                      ? "var(--color-income-text)"
                      : "var(--color-expense-text)",
                }}
              >
                {item.type === "Доход" ? "+" : "-"}
                {item.summ} {item.currency}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(item);
                  setModalOpen(true);
                }}
              >
                Изменить
              </button>
              <button type="button" onClick={() => toggleActive(item)}>
                {item.active ? "Отключить" : "Включить"}
              </button>
              <button type="button" onClick={() => handleDelete(item)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <RecurringModal
        isOpen={modalOpen}
        initialData={editingItem}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
