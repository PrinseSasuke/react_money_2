import React from "react";
import styles from "./Transaction.module.scss";
import * as api from "../../services/api";
import { useOutletContext } from "react-router-dom";
import TransactionModal from "../TransactionModal";
import { Link } from "react-router-dom";
function Transaction({ date, type, source, description, summ, currency, id }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { transactions, setTransactions } = useOutletContext();
  //Модалка
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [transactionToEdit, setTransactionToEdit] = React.useState(false);

  const deleteTransaction = (id) => {
    setTransactions((prev) =>
      prev.filter((transaction) => transaction.id !== id)
    );
  };
  const handleDelete = async () => {
    try {
      await api.deleteTransaction(id);
      deleteTransaction(id);
      setIsMenuOpen(false);
    } catch (error) {
      alert(error.message);
    }
  };
  const handleEdit = () => {
    setTransactionToEdit({
      id,
      date,
      type,
      source,
      description,
      summ,
      currency,
    });
    setIsEditModalOpen(true);
    setIsMenuOpen(false);
  };
  const handleUpdate = (updatedTr) => {
    setTransactions((prev) => {
      return prev.map((transaction) =>
        transaction.id === updatedTr.id ? updatedTr : transaction
      );
    });
    setIsEditModalOpen(false);
  };
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  const handleOutsideClick = (e) => {
    if (e.target.closest(`.${styles.dots}`)) return;
    setIsMenuOpen(false);
  };
  React.useEffect(() => {
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);
  const COLORS = {
    Доход: ["#CDFFCD", "#007F00"],
    Расход: ["#FFE0E0", "#D30000"],
  };
  const colors = COLORS[type];
  // const formatDate = (date) => {
  //   const dateObj = new Date(date);
  //   return new Intl.DateTimeFormat("ru-RU", {
  //     day: "numeric",
  //     month: "long",
  //     year: "numeric",
  //   }).format(dateObj);
  // };
  const formatDate = (date) => {
    if (!date) return "Некорректная дата";

    const dateObj = new Date(date);

    if (isNaN(dateObj)) return "Некорректная дата";

    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(dateObj);
  };
  return (
    <>
      <tr>
        <td className={styles.date_td}>{formatDate(date)}</td>
        <td className={styles.details_td}>
          <span
            className={styles.table__status}
            style={{
              backgroundColor: colors[0],
            }}
          >
            <span
              className={styles.circle}
              style={{
                backgroundColor: colors[1],
              }}
            ></span>
            <span
              className={styles.table__status_text}
              style={{
                color: colors[1],
              }}
            >
              {type}
            </span>
          </span>
          <div className={styles.table__details_text}>
            <span>Получено от: </span>
            <span
              className={styles.source}
              style={{
                color: colors[1],
                backgroundColor: colors[0],
              }}
            >
              {source}
            </span>
          </div>
        </td>
        <td className={styles.desription_td}>
          <span>{description}</span>
        </td>
        <td>
          <div className={styles.table__amount}>
            <span className={styles.amount}>{summ}</span>
            <span className={styles.currency}>{currency}</span>
          </div>
        </td>
        <td className={styles.about}>
          <span>Подробнее</span>
        </td>
        <td className={styles.dots} onClick={toggleMenu}>
          <img src="./img/more.svg" alt="" />
          {isMenuOpen && (
            <div className={styles.dropdownMenu}>
              <button
                className={styles.dropdownMenuClose}
                onClick={() => setIsMenuOpen(false)}
              >
                {" "}
                <img src="./img/dropdown_close.svg" alt="" />
              </button>
              <ul>
                <li onClick={handleEdit}>Изменить</li>
                <Link to={`/transactions/${id}`}>
                  <li>Посмотреть</li>
                </Link>

                <li className={styles.deleteItem} onClick={handleDelete}>
                  Удалить
                </li>
              </ul>
            </div>
          )}
        </td>
      </tr>
      {isEditModalOpen && (
        <TransactionModal
          mode="edit"
          isOpen={isEditModalOpen}
          initialData={transactionToEdit}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={async (form) => {
            const { id: _, ...rest } = form;
            await api.updateTransaction(form.id, rest);
            handleUpdate(form);
          }}
        />
      )}
    </>
  );
}
export default Transaction;
