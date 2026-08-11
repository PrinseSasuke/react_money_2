import "./App.scss";
import React, { useState, useEffect, createContext } from "react";
import Side from "./components/Side";
import { Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import * as api from "./services/api";

export const AppContext = createContext({});

function App() {
  const [transactions, setTransactions] = useState([]);
  const { user, loading } = useAuth();

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await api.getTransactions();
        setTransactions(data);
      } catch (err) {
        console.error("Не удалось загрузить транзакции:", err);
      }
    };

    if (user) {
      fetchTransactions();
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AppContext.Provider value={{ transactions, setTransactions }}>
      <div className="App">
        <Side />
        <Outlet context={{ transactions, setTransactions }} />
      </div>
    </AppContext.Provider>
  );
}

export default App;
