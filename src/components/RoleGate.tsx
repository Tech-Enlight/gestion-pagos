import React from "react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/auth";

interface Props {
  allowedRoles: Role[];
  children: React.ReactNode;
}

export const RoleGate: React.FC<Props> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
};
