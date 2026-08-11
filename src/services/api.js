const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

const getToken = () => localStorage.getItem("token");

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Ошибка запроса к серверу");
  }
  return data;
}

// Авторизация
export const register = (email, password, displayName) =>
  request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });

export const login = (email, password) =>
  request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const fetchMe = () => request("/auth/me");

// Транзакции
export const getTransactions = () => request("/transactions");
export const getTransaction = (id) => request(`/transactions/${id}`);
export const addTransaction = (tr) =>
  request("/transactions", { method: "POST", body: JSON.stringify(tr) });
export const bulkAddTransactions = (transactions) =>
  request("/transactions/bulk", {
    method: "POST",
    body: JSON.stringify({ transactions }),
  });
export const updateTransaction = (id, tr) =>
  request(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(tr) });
export const deleteTransaction = (id) =>
  request(`/transactions/${id}`, { method: "DELETE" });

// Лимит
export const getLimit = () => request("/limits");
export const setLimit = (amount) =>
  request("/limits", { method: "PUT", body: JSON.stringify({ amount }) });
