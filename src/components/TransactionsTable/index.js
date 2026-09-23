import { useState, useMemo } from "react";
import Transaction from "../Transaction";
import TransactionCard from "../TransactionCard";
import styles from "./TransactionsTable.module.scss";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TransactionsTable({ transactions }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, currentPage, pageSize]);

  return (
    <div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.date}>Дата и время</th>
              <th className={styles.details}>Детали</th>
              <th className={styles.description}>Описание</th>
              <th className={styles.summ}>Сумма</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((obj, index) => (
              <Transaction key={obj.id || index} {...obj} />
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cardList}>
        {pageItems.map((obj, index) => (
          <TransactionCard key={obj.id || index} {...obj} />
        ))}
      </div>

      {transactions.length > 0 && (
        <div className={styles.pagination}>
          <div className={styles.pageSize}>
            <label htmlFor="page-size-select">Показывать по:</label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.pageInfo}>
            Показано {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, transactions.length)} из{" "}
            {transactions.length}
          </div>

          <div className={styles.pageControls}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Предыдущая страница"
            >
              ←
            </button>
            <span className={styles.pageCurrent}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Следующая страница"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
