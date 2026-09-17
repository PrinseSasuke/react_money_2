import React from "react";
import * as api from "../../services/api";
import { useOutletContext } from "react-router-dom";

const COLORS = {
  Доход: ["var(--color-income-bg)", "var(--color-income-text)"],
  Расход: ["var(--color-expense-bg)", "var(--color-expense-text)"],
};

// Общая логика меню/редактирования/удаления транзакции, переиспользуемая
// и в табличной строке (Transaction), и в мобильной карточке (TransactionCard).
export function useTransactionActions({
  id,
  date,
  type,
  source,
  description,
  summ,
  currency,
  account_id,
}) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { setTransactions } = useOutletContext();
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [transactionToEdit, setTransactionToEdit] = React.useState(false);

  const handleDelete = async () => {
    try {
      await api.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
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
      account_id,
    });
    setIsEditModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleUpdate = (updatedTr) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updatedTr.id ? updatedTr : t))
    );
    setIsEditModalOpen(false);
  };

  const toggleMenu = () => setIsMenuOpen((v) => !v);

  return {
    isMenuOpen,
    setIsMenuOpen,
    toggleMenu,
    isEditModalOpen,
    setIsEditModalOpen,
    transactionToEdit,
    handleDelete,
    handleEdit,
    handleUpdate,
    colors: COLORS[type],
  };
}
