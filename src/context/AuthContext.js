import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "../services/api";

const AuthContext = createContext();

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // При старте приложения проверяем, есть ли валидный токен
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .fetchMe()
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
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
