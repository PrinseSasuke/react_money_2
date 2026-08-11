import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Transactions from "./pages/Transactions";
import Home from "./pages/Home";
import { AuthContextProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import Authorize from "./pages/Authorize";
import Stats from "./pages/Stats";
import TransactionDetail from "./components/TransactionDetail";
import LimitsPage from "./pages/LimitsPage";
import Excel from "./pages/Excel";
import ForecastPage from "./pages/Forecast";
const root = ReactDOM.createRoot(document.getElementById("root"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: (
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        ),
      },
      {
        path: "/transactions",
        element: (
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        ),
      },
      {
        path: "/transactions/date/:date",
        element: (
          <ProtectedRoute>
            <Transactions />
          </ProtectedRoute>
        ),
      },
      {
        path: "/transactions/:id",
        element: (
          <ProtectedRoute>
            <TransactionDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "/login",
        element: <Authorize />,
      },
      {
        path: "/stats",
        element: (
          <ProtectedRoute>
            <Stats />
          </ProtectedRoute>
        ),
      },
      {
        path: "/import",
        element: (
          <ProtectedRoute>
            <Excel />
          </ProtectedRoute>
        ),
      },
      {
        path: "/forecast",
        element: (
          <ProtectedRoute>
            <ForecastPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/limit",
        element: (
          <ProtectedRoute>
            <LimitsPage />
          </ProtectedRoute>
        ),
      }
    ],
  },
]);
root.render(
  <React.StrictMode>
    <AuthContextProvider>
      <RouterProvider router={router} />
    </AuthContextProvider>
  </React.StrictMode>
);
reportWebVitals();
