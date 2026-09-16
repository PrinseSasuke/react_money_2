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

// Счета
export const getAccounts = () => request("/accounts");
export const createAccount = (account) =>
  request("/accounts", { method: "POST", body: JSON.stringify(account) });
export const updateAccount = (id, account) =>
  request(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(account) });
export const deleteAccount = (id, reassignTo) =>
  request(`/accounts/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reassignTo }),
  });

// Курсы валют
export const getExchangeRates = () => request("/exchange-rates");

// Регулярные платежи
export const getRecurring = () => request("/recurring");
export const createRecurring = (item) =>
  request("/recurring", { method: "POST", body: JSON.stringify(item) });
export const updateRecurring = (id, item) =>
  request(`/recurring/${id}`, { method: "PUT", body: JSON.stringify(item) });
export const deleteRecurring = (id) =>
  request(`/recurring/${id}`, { method: "DELETE" });

// Экспорт — отдельная функция, а не через request(), т.к. ответ бинарный,
// а не JSON.
export async function downloadExport(type, params = {}) {
  const token = getToken();
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();

  const response = await fetch(`${API_URL}/export/${type}?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Ошибка экспорта");
  }

  const blob = await response.blob();
  const filename = type === "excel" ? "transactions.xlsx" : "transactions.pdf";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
