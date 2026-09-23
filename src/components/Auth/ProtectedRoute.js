import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import FullPageLoader from "../ui/FullPageLoader";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  return user ? children : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
