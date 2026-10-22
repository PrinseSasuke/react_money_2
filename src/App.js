import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { Box, Drawer, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Sidebar, { SIDEBAR_WIDTH } from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import { useAuth } from "./context/AuthContext";
import * as api from "./services/api";
import { subscribeReceiptEvents } from "./services/receipts";
import { DEFAULT_RATES } from "./utils/currency";

export const AppContext = createContext({});

function App() {
  const [transactions, setTransactions] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const theme = useTheme();
  // noSsr: вычисляем сразу, без «мигания» мобильной раскладки на десктопе.
  // Рендерим одну из навигаций, а не прячем вторую через CSS — иначе бренд
  // и пункты меню дублировались бы в DOM.
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });

  const refreshTransactions = useCallback(async () => {
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch (err) {
      console.error("Не удалось загрузить транзакции:", err);
    }
  }, []);

  useEffect(() => {
    if (user) refreshTransactions();
  }, [user, refreshTransactions]);

  // Живое обновление: чек отсканирован на телефоне → трата появляется здесь через 1–2 с без перезагрузки.
  // receiptsVersion растёт на каждое событие — по нему раздел «Чеки» перечитывает список.
  const [receiptsVersion, setReceiptsVersion] = useState(0);
  const [receiptsLive, setReceiptsLive] = useState(false);
  useEffect(() => {
    if (!user) return undefined;
    return subscribeReceiptEvents((event) => {
      setReceiptsVersion((v) => v + 1);
      if (event.status === "parsed") refreshTransactions();
    }, setReceiptsLive);
  }, [user, refreshTransactions]);

  // Без потока (сервис чеков недоступен) — запасной путь из ТЗ: перечитать при возврате на вкладку и раз в 30 с.
  useEffect(() => {
    if (!user || receiptsLive) return undefined;
    const refresh = () => {
      if (document.visibilityState === "visible") refreshTransactions();
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, receiptsLive, refreshTransactions]);

  // Курсы ЦБ для пересчёта операций в $/€ в рубли во всех сводках.
  const [rates, setRates] = useState(DEFAULT_RATES);
  useEffect(() => {
    if (!user) return;
    api
      .getExchangeRates()
      .then((data) => setRates({ ...DEFAULT_RATES, ...data }))
      .catch((err) => console.error("Не удалось загрузить курсы валют:", err));
  }, [user]);

  const contextValue = useMemo(
    () => ({ transactions, setTransactions, refreshTransactions, rates, receiptsVersion, receiptsLive }),
    [transactions, refreshTransactions, rates, receiptsVersion, receiptsLive]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex min-h-screen">
        {isDesktop ? (
          <Box
            component="aside"
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              position: "sticky",
              top: 0,
              height: "100vh",
              overflowY: "auto",
              overflowX: "hidden",
              bgcolor: "background.sidebar",
              borderRight: 1,
              borderColor: "divider",
            }}
          >
            <Sidebar />
          </Box>
        ) : (
          <Drawer
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH, bgcolor: "background.sidebar", borderRadius: 0 } } }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar isDesktop={isDesktop} onMenuClick={() => setMobileOpen(true)} />
          <main className="w-full min-w-0 flex-1 px-4 pb-12 pt-2 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet context={contextValue} />
            </div>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}

export default App;
