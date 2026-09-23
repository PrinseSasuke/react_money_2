import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { StyledEngineProvider } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import "./index.css";
import App from "./App";
import { AuthContextProvider } from "./context/AuthContext";
import { ColorModeProvider } from "./theme/ColorModeContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import Authorize from "./pages/Authorize";
import Home from "./pages/Home";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import Stats from "./pages/Stats";
import LimitsPage from "./pages/LimitsPage";
import Excel from "./pages/Excel";
import ForecastPage from "./pages/Forecast";
import AccountsPage from "./pages/AccountsPage";
import RecurringPage from "./pages/RecurringPage";
import SettingsPage from "./pages/Settings";

dayjs.locale("ru");

const router = createBrowserRouter([
  { path: "/login", element: <Authorize /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "transactions", element: <Transactions /> },
      { path: "transactions/date/:date", element: <Transactions /> },
      { path: "transactions/:id", element: <TransactionDetail /> },
      { path: "stats", element: <Stats /> },
      { path: "import", element: <Excel /> },
      { path: "forecast", element: <ForecastPage /> },
      { path: "limit", element: <LimitsPage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "recurring", element: <RecurringPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* injectFirst: стили Emotion/MUI вставляются в начало <head>, поэтому
        Tailwind-утилиты (подключены позже) могут их переопределять без !important. */}
    <StyledEngineProvider injectFirst>
      <ColorModeProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
          <AuthContextProvider>
            <RouterProvider router={router} />
          </AuthContextProvider>
        </LocalizationProvider>
      </ColorModeProvider>
    </StyledEngineProvider>
  </React.StrictMode>
);
