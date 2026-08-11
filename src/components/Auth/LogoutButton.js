import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const LogoutButton = () => {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  return (
    user && (
      <button onClick={handleLogout} className="button_logout">
        <span>Выйти</span> <img src="./img/logout.svg" alt="" />
      </button>
    )
  );
};

export default LogoutButton;
