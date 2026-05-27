// ============================================================
// src/components/Sidebar.tsx — REEMPLAZO COMPLETO
// Drop-in para tu Sidebar actual. Mantiene la firma:
//   props: { currentView: string, setCurrentView: (v: string) => void }
// y usa tu hook `useAuth` igual que antes.
//
// Mejoras vs la versión anterior:
//   - Logo Enlight oficial (no Cloudinary)
//   - Agrupación por secciones (Principal / Gestión / Datos)
//   - Avatar con iniciales en gradient jade→acero (no <img> de Google)
//   - Cerrar sesión más sobrio (no rojo agresivo)
//   - Indicador activo con borde jade a la izquierda
// ============================================================

import React from "react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types/auth";
import {
  LayoutDashboard,
  FilePlus2,
  ListTodo,
  ShieldCheck,
  CreditCard,
  Search,
  TrendingUp,
  Settings,
  LogOut,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  roles: Role[] | "all";
  icon: React.ReactNode;
  group: "principal" | "gestion" | "datos";
  badge?: number;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Panel general", roles: ["admin", "superadmin"], icon: <LayoutDashboard size={17} />, group: "principal" },
  { id: "nueva-solicitud", label: "Nueva solicitud", roles: "all", icon: <FilePlus2 size={17} />, group: "principal" },
  { id: "mis-solicitudes", label: "Mis solicitudes", roles: "all", icon: <ListTodo size={17} />, group: "principal" },
  { id: "aprobaciones", label: "Aprobaciones", roles: ["mac", "operaciones", "ingenieria", "servicios", "admin", "superadmin"], icon: <ShieldCheck size={17} />, group: "gestion" },
  { id: "finanzas", label: "Finanzas", roles: ["admin", "superadmin"], icon: <CreditCard size={17} />, group: "gestion" },
  { id: "explorador", label: "Explorador", roles: ["admin", "superadmin"], icon: <Search size={17} />, group: "gestion" },
  { id: "tipo-de-cambio", label: "Tipo de cambio", roles: ["admin", "superadmin"], icon: <TrendingUp size={17} />, group: "datos" },
  { id: "configuracion", label: "Configuración", roles: ["superadmin"], icon: <Settings size={17} />, group: "datos" },
];

interface Props {
  currentView: string;
  setCurrentView: (v: string) => void;
}

export const Sidebar: React.FC<Props> = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();

  const visible = navItems.filter(
    (item) => item.roles === "all" || (user && item.roles.includes(user.role))
  );

  const principales = visible.filter((n) => n.group === "principal");
  const gestion = visible.filter((n) => n.group === "gestion");
  const datos = visible.filter((n) => n.group === "datos");

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = currentView === item.id;
      return (
        <button
          key={item.id}
          onClick={() => setCurrentView(item.id)}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "10px 12px",
            marginBottom: 2,
            border: "none",
            borderRadius: 8,
            background: active ? "rgba(0,170,133,0.12)" : "transparent",
            color: active ? "#fff" : "rgba(255,255,255,0.74)",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "Alexandria, sans-serif",
            fontWeight: active ? 600 : 400,
            textAlign: "left",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
        >
          {active && (
            <span style={{
              position: "absolute", left: -10, top: 8, bottom: 8, width: 3,
              background: "#00AA85", borderRadius: "0 2px 2px 0",
            }} />
          )}
          <span style={{ display: "inline-flex", width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
            {item.icon}
          </span>
          {item.label}
          {item.badge !== undefined && (
            <span style={{
              marginLeft: "auto",
              background: "rgba(0,170,133,0.18)", color: "#00AA85",
              fontSize: 10, fontWeight: 700, padding: "2px 7px",
              borderRadius: 999, letterSpacing: 0.2,
            }}>{item.badge}</span>
          )}
        </button>
      );
    });

  const groupLabel = (text: string) => (
    <div style={{
      fontFamily: "Albert Sans, sans-serif",
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.4)",
      padding: "14px 12px 6px",
    }}>{text}</div>
  );

  return (
    <aside style={{
      width: 256, minWidth: 256,
      background: "#293C47",
      display: "flex", flexDirection: "column",
      fontFamily: "Alexandria, sans-serif",
      borderRight: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Brand */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <img src="/enlight/logo-white.svg" alt="Enlight" style={{ height: 28, display: "block" }} />
        <div style={{ marginTop: 18, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em" }}>
          Portal de Pagos
        </div>
        <div style={{
          marginTop: 2, fontFamily: "Albert Sans, sans-serif", fontSize: 11,
          color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", textTransform: "uppercase",
        }}>
          Clean Energy Microgrids
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {principales.length > 0 && groupLabel("Principal")}
        {renderItems(principales)}
        {gestion.length > 0 && groupLabel("Gestión")}
        {renderItems(gestion)}
        {datos.length > 0 && groupLabel("Datos")}
        {renderItems(datos)}
      </nav>

      {/* User */}
      {user && (
        <div style={{ padding: "14px 16px 18px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(90deg, #00AA85 0%, #293C47 100%)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>
              <img
                src={user.picture}
                alt={user.name}
                style={{ width: 36, height: 36, borderRadius: "50%" }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <p style={{ color: "#fff", fontSize: 12.5, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
                {user.name}
              </p>
              <p style={{
                color: "#00AA85", fontSize: 10.5, margin: "2px 0 0",
                textTransform: "capitalize", fontFamily: "Albert Sans, sans-serif",
                letterSpacing: "0.04em",
              }}>
                {user.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: 8,
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "Alexandria, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            }}
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
};
