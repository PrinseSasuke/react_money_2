import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import TransactionsTable from "../components/TransactionsTable";
import TransactionModal from "../components/TransactionModal";
import { useParams } from "react-router-dom";
import { useDayDate } from "../hooks/useDayDate";

function Transactions() {
  const { transactions, setTransactions } = useOutletContext();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const openModal = () => setModalIsOpen(true);
  const closeModal = () => {
    setModalIsOpen(false);
  };

  // Состояние для фильтрации и сортировки
  const [sortBy, setSortBy] = useState("По умолчанию");
  const [transactionType, setTransactionType] = useState("Все");
  const [isFilterOpen, setIsFilterOpen] = useState(false); // Добавлено: состояние для показа/скрытия фильтра

  const handleSortChange = (event) => {
    setSortBy(event.target.value);
  };

  const handleTransactionTypeChange = (event) => {
    setTransactionType(event.target.value);
  };

  const [searchValue, setSearchValue] = useState("");
  const onChangeSearchInput = (event) => {
    setSearchValue(event.target.value);
  };

  const { date } = useParams();
  const { dayTransactions } = useDayDate(date);

  // Фильтрация и сортировка транзакций
  const renderTransactions = () => {
    const filteredTransactions = transactions.filter((item) => {
      return (
        item.description.toLowerCase().includes(searchValue.toLowerCase()) ||
        item.source.toLowerCase().includes(searchValue.toLowerCase())
      );
    });

    // Фильтрация по типу транзакции (Доход, Расход, Все)
    const filteredByType = filteredTransactions.filter((transaction) => {
      if (transactionType === "Все") return true;
      return transaction.type === transactionType;
    });

    // Приводим дату из бэкенда к JS Date
    const toJsDate = (value) => (value ? new Date(value) : new Date(0));

    // Сортировка транзакций
    const sortedTransactions = filteredByType.sort((a, b) => {
      if (sortBy === "Дата") {
        return toJsDate(a.date) - toJsDate(b.date);
      } else if (sortBy === "Сумма") {
        return a.summ - b.summ;
      }
      return 0; // По умолчанию, не меняем порядок
    });

    return sortedTransactions;
  };

  // Функция для переключения состояния фильтра
  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  return (
    <div className="table__container">
      <TransactionModal isOpen={modalIsOpen} onClose={closeModal} />
      <div className="table_top__wrapper">
        <button className="button__add_transaction" onClick={openModal}>
          Добавить запись
        </button>
        <div className="table__filter">
          <div className="filter_container">
            <button className="button__filter" onClick={toggleFilter}>
              <img src="/img/button_filter.svg" alt="filter" />
              <span>Filter</span>
            </button>

            {/* Выпадающий список с фильтрами, который появляется при нажатии на кнопку */}
            {isFilterOpen && (
              <div className={`filter_dropdown ${isFilterOpen ? "show" : ""}`}>
                <div className="sort_filter">
                  <span className="filter_title">Сортировать по:</span>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="sortBy"
                      value="По умолчанию"
                      checked={sortBy === "По умолчанию"}
                      onChange={handleSortChange}
                    />
                    По умолчанию
                  </label>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="sortBy"
                      value="Дата"
                      checked={sortBy === "Дата"}
                      onChange={handleSortChange}
                    />
                    Дата
                  </label>
                  <label className="radio-container">
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

                <div className="transaction_type_filter">
                  <span className="filter_title">Транзакции:</span>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="transactionType"
                      value="Все"
                      checked={transactionType === "Все"}
                      onChange={handleTransactionTypeChange}
                    />
                    Все
                  </label>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="transactionType"
                      value="Доход"
                      checked={transactionType === "Доход"}
                      onChange={handleTransactionTypeChange}
                    />
                    Доход
                  </label>
                  <label className="radio-container">
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
            )}
          </div>
          {/* Кнопка фильтра */}

          <div className="search_container">
            <span className="search_icon">
              <img src="./img/search.svg" alt="" />
            </span>
            <input
              type="text"
              placeholder="Поиск по описанию"
              className="search_input"
              value={searchValue}
              onChange={onChangeSearchInput}
            />
          </div>
        </div>
      </div>

      {/* Отображение транзакций */}
      <TransactionsTable
        transactions={date ? dayTransactions : renderTransactions()}
      />
    </div>
  );
}

export default Transactions;
