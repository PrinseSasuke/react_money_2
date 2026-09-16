import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import styles from "./RecurringModal.module.scss";
import * as api from "../../services/api";

const FREQUENCY_LABELS = {
  daily: "Ежедневно",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
};

const today = () => new Date().toISOString().slice(0, 10);

const INITIAL_STATE = {
  type: "Расход",
  source: "Остальное",
  description: "",
  summ: "",
  currency: "RUB",
  frequency: "monthly",
  next_run_date: today(),
  account_id: "",
};

function RecurringModal({ isOpen, onClose, initialData = null, onSaved }) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mode = initialData ? "edit" : "add";

  useEffect(() => {
    if (initialData) {
      setForm({
        type: initialData.type,
        source: initialData.source,
        description: initialData.description || "",
        summ: String(initialData.summ),
        currency: initialData.currency,
        frequency: initialData.frequency,
        next_run_date: String(initialData.next_run_date).slice(0, 10),
        account_id: initialData.account_id || "",
      });
    } else {
      setForm(INITIAL_STATE);
    }
    setError("");
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    api
      .getAccounts()
      .then((data) => {
        setAccounts(data);
        setForm((prev) =>
          prev.account_id ? prev : { ...prev, account_id: data[0]?.id || "" }
        );
      })
      .catch((err) => console.error("Не удалось загрузить счета:", err));
  }, [isOpen]);

  const customFormStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      transform: "translate(-50%, -50%)",
      width: "90%",
      maxWidth: "420px",
      maxHeight: "90vh",
      overflowY: "auto",
      padding: "24px 20px",
      background: "var(--bg-surface)",
      color: "var(--text-primary)",
    },
    overlay: { backgroundColor: "transperent" },
  };

  const handleChange = (event) => {
    setForm({ ...form, [event.target.id]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.summ || Number(form.summ) <= 0) {
      setError("Укажите сумму больше нуля");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, summ: Number(form.summ) };
      if (mode === "add") {
        await api.createRecurring(payload);
      } else {
        await api.updateRecurring(initialData.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  Modal.setAppElement("#root");

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Recurring Modal"
      style={customFormStyles}
      closeTimeoutMS={200}
    >
      <div className={styles.topWrapper}>
        <span className={styles.title}>
          {mode === "add" ? "Новый регулярный платёж" : "Изменить платёж"}
        </span>
        <button className={styles.close} onClick={onClose} type="button">
          <img src="./img/close_button.svg" alt="" />
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.flexContainer}>
          <label className={styles.label}>Тип операции</label>
          <div className={styles.radioRow}>
            <label>
              <input
                type="radio"
                name="type"
                checked={form.type === "Доход"}
                onChange={() => setForm({ ...form, type: "Доход" })}
              />{" "}
              Доход
            </label>
            <label>
              <input
                type="radio"
                name="type"
                checked={form.type === "Расход"}
                onChange={() => setForm({ ...form, type: "Расход" })}
              />{" "}
              Расход
            </label>
          </div>
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="source">
            Источник / категория
          </label>
          <input
            className={styles.input}
            type="text"
            id="source"
            value={form.source}
            onChange={handleChange}
          />
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="description">
            Описание
          </label>
          <input
            className={styles.input}
            type="text"
            id="description"
            value={form.description}
            onChange={handleChange}
          />
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="summ">
            Сумма
          </label>
          <input
            className={styles.input}
            type="number"
            id="summ"
            value={form.summ}
            onChange={handleChange}
          />
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="frequency">
            Периодичность
          </label>
          <select
            id="frequency"
            className={styles.select}
            value={form.frequency}
            onChange={handleChange}
          >
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="next_run_date">
            Следующее списание
          </label>
          <input
            className={styles.input}
            type="date"
            id="next_run_date"
            value={form.next_run_date}
            onChange={handleChange}
          />
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="account_id">
            Счёт
          </label>
          <select
            id="account_id"
            className={styles.select}
            value={form.account_id}
            onChange={handleChange}
          >
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p style={{ color: "var(--color-expense-text)" }}>{error}</p>}
        <button type="submit" className={styles.button__submit} disabled={submitting}>
          {mode === "add" ? "Создать" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}

export default RecurringModal;
