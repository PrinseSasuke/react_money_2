import React, { useEffect } from "react";
import styles from "./TransactionModal.module.scss";
import Modal from "react-modal";
import DatePicker from "react-datepicker";
import { useState } from "react";
import "react-datepicker/dist/react-datepicker.css";

import { AppContext } from "../../App";
import { useContext } from "react";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../services/api";
function TransactionModal({
  mode = "add",
  isOpen,
  onClose,
  initialData = null,
  onSubmit,
}) {
  const { user } = useAuth();
  const INITIAL_STATE = {
    date: new Date(),
    type: "Доход",
    source: "Зарплата",
    description: "",
    summ: "",
    currency: "Рубль",
  };
  const [form, setForm] = useState(INITIAL_STATE);
  const CATEGORIES = {
    Расход: [
      "Супермаркеты",
      "Переводы",
      "Фастфуд",
      "Одежда и обувь",
      "Мобильная связь",
      "Аптеки",
      "Транспорт",
      "Остальное",
    ],
    Доход: ["Зарплата", "Доп. зарабаток", "Соц. выплата", "Остальное"],
  };
  const { setTransactions } = useContext(AppContext);
  const [startDate, setStartDate] = useState(new Date());
  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm(initialData);
      setStartDate(new Date(initialData.date));
    } else {
      setForm(INITIAL_STATE);
      setStartDate(new Date());
    }
  }, [mode, initialData, user]);
  const customFormStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      transform: "translate(-50%, -50%)",
      padding: "30px 50px",
      background: "var(--bg-surface)",
      color: "var(--text-primary)",
    },
    overlay: {
      backgroundColor: "transperent",
    },
  };

  const handleChange = (event) => {
    if (event.target.id === "type") {
      setForm({
        ...form,
        [event.target.id]: event.target.value,
        source: CATEGORIES[event.target.value][0],
      });
    } else {
      setForm({ ...form, [event.target.id]: event.target.value });
    }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      alert("Сначала авторизуйся");
      return;
    }
    if (mode === "add") {
      try {
        const created = await api.addTransaction({ ...form, date: startDate });
        setTransactions((prev) => [...prev, created]);
        setForm(INITIAL_STATE);
        onClose();
      } catch (err) {
        alert(err.message);
      }
    } else if (mode === "edit") {
      await onSubmit({ ...form, date: startDate });
    }
  };
  Modal.setAppElement("#root");

  return (
    <div>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Example Modal"
        style={customFormStyles}
        closeTimeoutMS={200}
      >
        <div className={styles.topWrapper}>
          <span className={styles.title}>
            {mode === "add" ? "Добавить запись" : "Изменить запись"}
          </span>
          <button className={styles.close} onClick={onClose}>
            <img src="./img/close_button.svg" alt="" />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.flexContainer}>
            <label className={styles.label}>Дата</label>
            <DatePicker
              id="date-picker"
              selected={startDate}
              onChange={(date) => {
                setStartDate(date);
                setForm({ ...form, date: date });
              }}
              dateFormat="dd/MM/yyyy"
              placeholderText="Выберите дату"
              className={styles.custom_date_input} // Ваши стили
            />
          </div>
          <div className={styles.flexContainer}>
            <label className={styles.label}>Тип операции</label>
            <fieldset className={styles.fieldset}>
              <label
                className={`${styles.radioLabel} ${styles.radioLabelIncome}`}
                htmlFor="Доход"
              >
                <input
                  type="radio"
                  id="type"
                  name="Доход"
                  value="Доход"
                  checked={form.type === "Доход"}
                  onChange={handleChange}
                  className={`${styles.radioInput} ${styles.radioInputIncome}`}
                />
                <span>Доход</span>
              </label>
              <label className={styles.radioLabelExpense} htmlFor="Расход">
                <input
                  type="radio"
                  id="type"
                  name="Расход"
                  value="Расход"
                  checked={form.type === "Расход"}
                  onChange={handleChange}
                  className={`${styles.radioInput} ${styles.radioInputExpense}`}
                />
                <span>Расход</span>
              </label>
            </fieldset>
          </div>
          <div className={styles.flexContainer}>
            <label className={styles.label}>Источник</label>
            <select
              id="source"
              name="source"
              className={styles.select}
              value={form.source}
              onChange={handleChange}
            >
              {CATEGORIES[form.type].map((source) => (
                <option value={source} key={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
          <label className={`${styles.label} ${styles.label__description}`}>
            Описание
          </label>
          <textarea
            className={styles.textarea}
            id="description"
            name="description"
            placeholder="Введите описание операции"
            maxLength={250}
            value={form.description}
            onChange={handleChange}
          ></textarea>
          <div className={styles.flexContainer}>
            <label className={styles.label}>Сумма</label>
            <input
              className={styles.input}
              type="number"
              id="summ"
              name="summ"
              placeholder="Введите сумму"
              value={form.summ}
              onChange={handleChange}
            />
          </div>
          <div className={styles.flexContainer}>
            <label className={styles.label}>Валюта</label>
            <select
              id="currency"
              name="currency"
              className={styles.select}
              value={form.currency}
              onChange={handleChange}
            >
              <option value="rub">Рубль</option>
              <option value="usd">Доллар</option>
            </select>
          </div>
          <button type="submit" className={styles.button__submit}>
            {mode === "add" ? "Сохранить" : "Обновить"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
export default TransactionModal;
