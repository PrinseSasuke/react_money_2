import React from "react";
import styles from "./TransactionCard.module.scss";
import * as api from "../../services/api";
import TransactionModal from "../TransactionModal";
import DropdownMenu from "../DropdownMenu";
import { Link, useNavigate } from "react-router-dom";
import { useTransactionActions } from "../Transaction/useTransactionActions";
import { formatDate } from "../Transaction/formatDate";

function TransactionCard(props) {
  const {
    date,
    type,
    source,
    description,
    summ,
    currency,
    id,
    is_auto_generated,
    attachment_count,
  } = props;
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
  const navigate = useNavigate();
  const dotsRef = React.useRef(null);
  const menuRef = React.useRef(null);

  const closeMenu = React.useCallback(() => setIsMenuOpen(false), [setIsMenuOpen]);

  const handleOutsideClick = React.useCallback(
    (e) => {
      if (dotsRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      closeMenu();
    },
    [closeMenu]
  );
  React.useEffect(() => {
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [handleOutsideClick]);

  return (
    <>
      <div
        className={styles.card}
        onDoubleClick={() => navigate(`/transactions/${id}`)}
      >
        <div className={styles.cardHeader}>
          <span className={styles.date}>
            {formatDate(date)}
            {is_auto_generated && (
              <span title="Создано автоматически" style={{ marginLeft: "6px" }}>
                🔁
              </span>
            )}
            {attachment_count > 0 && (
              <span title="Есть вложение" style={{ marginLeft: "6px" }}>
                📎
              </span>
            )}
          </span>
          <div className={styles.dots} ref={dotsRef} onClick={toggleMenu}>
            <img src="./img/more.svg" alt="Меню" />
            <DropdownMenu
              anchorRef={dotsRef}
              isOpen={isMenuOpen}
              onClose={closeMenu}
              className={styles.dropdownMenu}
            >
              <div ref={menuRef}>
                <button
                  className={styles.dropdownMenuClose}
                  onClick={() => setIsMenuOpen(false)}
                >
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
            </DropdownMenu>
          </div>
        </div>

        <div className={styles.cardBody}>
          <span
            className={styles.status}
            style={{ backgroundColor: colors[0], color: colors[1] }}
          >
            {type}
          </span>
          <span
            className={styles.source}
            style={{ backgroundColor: colors[0], color: colors[1] }}
          >
            {source}
          </span>
        </div>

        {description && <p className={styles.description}>{description}</p>}

        <div className={styles.cardFooter}>
          <span className={styles.amount}>{summ}</span>
          <span className={styles.currency}>{currency}</span>
        </div>
      </div>
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

export default TransactionCard;
