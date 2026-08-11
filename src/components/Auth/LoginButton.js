import React from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";

const LoginButton = () => {
  const { user } = useAuth();
  return (
    !user && (
      <Link to="/login" className="button_login">
        <span>Войти</span> <img src="./img/login.svg" alt="" />
      </Link>
    )
  );
};

export default LoginButton;
