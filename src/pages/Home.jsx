import React, { useEffect, useState } from "react";
import Calendar from "../components/Calendar";
import * as api from "../services/api";

function AccountBalances() {
  const [accounts, setAccounts] = useState([]);
  const [rates, setRates] = useState({ RUB: 1 });

  useEffect(() => {
    api
      .getAccounts()
      .then(setAccounts)
      .catch((err) => console.error("Не удалось загрузить счета:", err));
    api
      .getExchangeRates()
      .then(setRates)
      .catch((err) => console.error("Не удалось загрузить курс валют:", err));
  }, []);

  if (accounts.length === 0) return null;

  const totalRub = accounts.reduce(
    (acc, account) => acc + account.balance * (rates[account.currency] ?? 1),
    0
  );

  return (
    <div style={{ marginBottom: "24px" }}>
      <div className="income" style={{ marginBottom: "16px" }}>
        <span className="income-text">Общий баланс</span>
        <div className="income__container">
          <span className="income-count">{totalRub.toFixed(2)}</span>
          <span className="income-percent">RUB</span>
        </div>
      </div>
      <div className="stats-info" style={{ flexWrap: "wrap" }}>
        {accounts.map((account) => (
          <div className="income" key={account.id} style={{ minWidth: "200px" }}>
            <span className="income-text">{account.name}</span>
            <div className="income__container">
              <span className="income-count">{account.balance.toFixed(2)}</span>
              <span className="income-percent">{account.currency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Home() {
  return (
    <div>
      <AccountBalances />
      <Calendar />
    </div>
  );
}
export default Home;
