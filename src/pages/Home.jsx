import React, { useEffect, useState } from "react";
import Calendar from "../components/Calendar";
import * as api from "../services/api";

function AccountBalances() {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    api
      .getAccounts()
      .then(setAccounts)
      .catch((err) => console.error("Не удалось загрузить счета:", err));
  }, []);

  if (accounts.length === 0) return null;

  return (
    <div
      className="stats-info"
      style={{ marginBottom: "24px", flexWrap: "wrap" }}
    >
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
