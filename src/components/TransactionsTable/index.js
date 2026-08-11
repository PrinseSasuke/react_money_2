import Transaction from "../Transaction";
import styles from "./TransactionsTable.module.scss";

export default function TransactionsTable({ transactions }) {
  return (
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
        {transactions.map((obj, index) => (
          <Transaction key={obj.id || index} {...obj} />
        ))}
      </tbody>
    </table>
  );
}
