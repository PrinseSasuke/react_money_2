import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import styles from "./AccountModal.module.scss";
import * as api from "../../services/api";

const TYPE_LABELS = {
  cash: "Наличные",
  card: "Карта",
  savings: "Накопительный",
};

const CURRENCIES = ["RUB", "USD", "EUR"];

const INITIAL_STATE = {
  name: "",
  type: "card",
  currency: "RUB",
  initialBalance: "",
};

function AccountModal({ mode = "add", isOpen, onClose, initialData = null, onSaved }) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        name: initialData.name,
        type: initialData.type,
        currency: initialData.currency,
        initialBalance: String(initialData.initialBalance),
      });
    } else {
      setForm(INITIAL_STATE);
    }
    setError("");
  }, [mode, initialData, isOpen]);

  const customFormStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      transform: "translate(-50%, -50%)",
      width: "90%",
      maxWidth: "400px",
      padding: "24px 20px",
      background: "var(--bg-surface)",
      color: "var(--text-primary)",
    },
    overlay: {
      backgroundColor: "transperent",
    },
  };

  const handleChange = (event) => {
    setForm({ ...form, [event.target.id]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Введите название счёта");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        currency: form.currency,
        initialBalance: form.initialBalance === "" ? 0 : Number(form.initialBalance),
      };
      if (mode === "add") {
        await api.createAccount(payload);
      } else {
        await api.updateAccount(initialData.id, payload);
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
      contentLabel="Account Modal"
      style={customFormStyles}
      closeTimeoutMS={200}
    >
      <div className={styles.topWrapper}>
        <span className={styles.title}>
          {mode === "add" ? "Добавить счёт" : "Изменить счёт"}
        </span>
        <button className={styles.close} onClick={onClose} type="button">
          <img src="./img/close_button.svg" alt="" />
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="name">
            Название
          </label>
          <input
            className={styles.input}
            type="text"
            id="name"
            placeholder="Например, Основной"
            value={form.name}
            onChange={handleChange}
          />
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="type">
            Тип счёта
          </label>
          <select id="type" className={styles.select} value={form.type} onChange={handleChange}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="currency">
            Валюта
          </label>
          <select
            id="currency"
            className={styles.select}
            value={form.currency}
            onChange={handleChange}
          >
            {CURRENCIES.map((code) => (
              <option value={code} key={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.flexContainer}>
          <label className={styles.label} htmlFor="initialBalance">
            Начальный баланс
          </label>
          <input
            className={styles.input}
            type="number"
            id="initialBalance"
            placeholder="0"
            value={form.initialBalance}
            onChange={handleChange}
          />
        </div>
        {error && <p style={{ color: "var(--color-expense-text)" }}>{error}</p>}
        <button type="submit" className={styles.button__submit} disabled={submitting}>
          {mode === "add" ? "Создать" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}

export default AccountModal;
