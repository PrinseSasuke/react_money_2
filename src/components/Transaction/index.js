import React from "react";
import styles from "./Transaction.module.scss";
import * as api from "../../services/api";
import TransactionModal from "../TransactionModal";
import { Link } from "react-router-dom";
import { useTransactionActions } from "./useTransactionActions";
import { formatDate } from "./formatDate";

function Transaction(props) {
  const { date, type, source, description, summ, currency, id, attachment_count } =
    props;
  const {
    isMenuOpen,
    setIsMenuOpen,
    toggleMenu,
    isEditModalOpen,
    setIsEditModalOpen,
    transactionToEdit,
    handleDelete,
    handleEdit,
    handleUpdate,
    colors,
  } = useTransactionActions(props);

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

  return (
    <>
      <tr>
        <td className={styles.date_td}>
          {formatDate(date)}
          {props.is_auto_generated && (
            <span title="Создано автоматически" style={{ marginLeft: "6px" }}>
              🔁
            </span>
          )}
          {attachment_count > 0 && (
            <span title="Есть вложение" style={{ marginLeft: "6px" }}>
              📎
            </span>
          )}
        </td>
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
