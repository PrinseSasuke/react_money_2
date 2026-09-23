import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import SouthWestRounded from "@mui/icons-material/SouthWestRounded";
import NorthEastRounded from "@mui/icons-material/NorthEastRounded";
import SavingsRounded from "@mui/icons-material/SavingsRounded";
import * as api from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import MonthCalendar from "../components/dashboard/MonthCalendar";
import IncomeExpenseChart from "../components/dashboard/IncomeExpenseChart";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import AccountsWidget from "../components/dashboard/AccountsWidget";
import { formatMoney } from "../utils/format";
import { monthToDateComparison } from "../utils/stats";

function Home() {
  const { transactions } = useOutletContext();
  const [accounts, setAccounts] = useState([]);
  const [rates, setRates] = useState({ RUB: 1 });

  // Балансы счетов пересчитываются бэкендом — перечитываем их при изменении
  // списка операций (добавили/удалили трату — баланс на главной сразу верный).
  useEffect(() => {
    api
      .getAccounts()
      .then(setAccounts)
      .catch((err) => console.error("Не удалось загрузить счета:", err));
  }, [transactions]);

  useEffect(() => {
    api
      .getExchangeRates()
      .then(setRates)
      .catch((err) => console.error("Не удалось загрузить курс валют:", err));
  }, []);

  const totalRub = accounts.reduce(
    (acc, account) => acc + account.balance * (rates[account.currency] ?? 1),
    0
  );
  const month = useMemo(() => monthToDateComparison(transactions), [transactions]);

  return (
    <div>
      <PageHeader title="Обзор" subtitle="Сводка по счетам и операциям за текущий месяц" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1280px]:grid-cols-4">
        <StatCard
          highlighted
          label="Общий баланс"
          value={formatMoney(totalRub, "RUB")}
          icon={AccountBalanceWalletRounded}
        />
        <StatCard
          label="Доходы за месяц"
          value={formatMoney(month.current.income, "RUB")}
          icon={SouthWestRounded}
          change={month.change.income}
          changeLabel="к прошлому месяцу"
        />
        <StatCard
          label="Расходы за месяц"
          value={formatMoney(month.current.expense, "RUB")}
          icon={NorthEastRounded}
          change={month.change.expense}
          changeLabel="к прошлому месяцу"
          positiveIsGood={false}
        />
        <StatCard
          label="Сбережения за месяц"
          value={formatMoney(month.current.balance, "RUB")}
          icon={SavingsRounded}
          change={month.change.balance}
          changeLabel="к прошлому месяцу"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <IncomeExpenseChart transactions={transactions} />
        </div>
        <div className="min-w-0">
          <RecentTransactions transactions={transactions} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <MonthCalendar transactions={transactions} />
        </div>
        <div className="min-w-0">
          <AccountsWidget accounts={accounts} />
        </div>
      </div>
    </div>
  );
}

export default Home;
