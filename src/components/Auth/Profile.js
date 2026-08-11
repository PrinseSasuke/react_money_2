import React from "react";
import "./styles.scss";
import { useAuth } from "../../context/AuthContext";

function Profile() {
  const { user } = useAuth();
  return (
    user && (
      <div className="profile">
        <span>{user.displayName || user.email}</span>
      </div>
    )
  );
}

export default Profile;
