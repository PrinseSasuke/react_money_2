import React, { useState } from "react";

function FilterComponent({ transactions, setFilteredTransactions }) {
  const [sortBy, setSortBy] = useState("По умолчанию"); // Сортировка по
  const [transactionType, setTransactionType] = useState("Все"); // Тип транзакций

  // Функция для обработки изменения сортировки
  const handleSortChange = (event) => {
    setSortBy(event.target.value);
  };

  // Функция для обработки изменения типа транзакций
  const handleTransactionTypeChange = (event) => {
    setTransactionType(event.target.value);
  };

  // Функция для фильтрации транзакций по типу
  const filteredByType = transactions.filter((transaction) => {
    if (transactionType === "Все") return true;
    return transaction.type === transactionType;
  });

  // Функция для сортировки транзакций
  const sortedTransactions = filteredByType.sort((a, b) => {
    if (sortBy === "Дата") {
      return new Date(a.date) - new Date(b.date);
    } else if (sortBy === "Сумма") {
      return a.summ - b.summ;
    }
    return 0; // По умолчанию, не меняем порядок
  });

  // Обновляем состояние фильтрованных и отсортированных транзакций
  setFilteredTransactions(sortedTransactions);

  return (
    <div className="filter-container">
      <div className="filter-section">
        <h3>Сортировать по:</h3>
        <label>
          <input
            type="radio"
            name="sortBy"
            value="По умолчанию"
            checked={sortBy === "По умолчанию"}
            onChange={handleSortChange}
          />
          По умолчанию
        </label>
        <label>
          <input
            type="radio"
            name="sortBy"
            value="Дата"
            checked={sortBy === "Дата"}
            onChange={handleSortChange}
          />
          Дата
        </label>
        <label>
          <input
            type="radio"
            name="sortBy"
            value="Сумма"
            checked={sortBy === "Сумма"}
            onChange={handleSortChange}
          />
          Сумма
        </label>
      </div>

      <div className="filter-section">
        <h3>Транзакции:</h3>
        <label>
          <input
            type="radio"
            name="transactionType"
            value="Все"
            checked={transactionType === "Все"}
            onChange={handleTransactionTypeChange}
          />
          Все
        </label>
        <label>
          <input
            type="radio"
            name="transactionType"
            value="Доход"
            checked={transactionType === "Доход"}
            onChange={handleTransactionTypeChange}
          />
          Доход
        </label>
        <label>
          <input
            type="radio"
            name="transactionType"
            value="Расход"
            checked={transactionType === "Расход"}
            onChange={handleTransactionTypeChange}
          />
          Расход
        </label>
      </div>
    </div>
  );
}

export default FilterComponent;
