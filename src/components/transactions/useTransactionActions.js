import { useCallback, useContext, useState } from "react";
import * as api from "../../services/api";
import { AppContext } from "../../App";

// Удаление/редактирование одной операции с синхронизацией общего списка
// в AppContext — используется и в строке таблицы, и в карточке, и на детальной.
export function useTransactionActions(transaction) {
  const { setTransactions } = useContext(AppContext);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = useCallback(async () => {
    setError("");
    try {
      await api.deleteTransaction(transaction.id);
      setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [transaction.id, setTransactions]);

  return {
    editOpen,
    openEdit: () => setEditOpen(true),
    closeEdit: () => setEditOpen(false),
    handleDelete,
    error,
  };
}

// PUT /transactions/:id не возвращает attachment_count — сохраняем его из
// текущей строки, иначе после правки пропал бы значок вложения.
export function mergeUpdatedTransaction(existing, updated) {
  return {
    ...existing,
    ...updated,
    attachment_count:
      updated.attachment_count !== undefined ? updated.attachment_count : existing?.attachment_count,
  };
}
