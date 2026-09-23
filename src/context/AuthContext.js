import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "../services/api";

const AuthContext = createContext();

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // При старте приложения проверяем, есть ли валидный токен.
  // Токен стираем только если сервер его отверг (401/403): обрыв сети или
  // перезапуск бэкенда не должны разлогинивать — пробуем ещё пару раз.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const check = async (attempt = 0) => {
      try {
        const { user } = await api.fetchMe();
        if (!cancelled) setUser(user);
      } catch (err) {
        if (cancelled) return;
        const rejected = err.status === 401 || err.status === 403;
        if (!rejected && attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          return check(attempt + 1);
        }
        if (rejected) localStorage.removeItem("token");
        setUser(null);
      }
    };
    check().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loginUser = async (email, password) => {
    const { token, user } = await api.login(email, password);
    localStorage.setItem("token", token);
    setUser(user);
    return user;
  };

  const registerUser = async (email, password, displayName) => {
    const { token, user } = await api.register(email, password, displayName);
    localStorage.setItem("token", token);
    setUser(user);
    return user;
  };

  const logoutUser = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loginUser, registerUser, logoutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
