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
  LogOut
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  roles: Role[] | "all";
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    roles: ["admin", "superadmin"],
    icon: <LayoutDashboard size={18} />,
  },
  { id: "nueva-solicitud", label: "Nueva Solicitud", roles: "all", icon: <FilePlus2 size={18} /> },
  { id: "mis-solicitudes", label: "Mis Solicitudes", roles: "all", icon: <ListTodo size={18} /> },
  {
    id: "aprobaciones",
    label: "Aprobaciones",
    roles: [
      "mac",
      "operaciones",
      "ingenieria",
      "servicios",
      "admin",
      "superadmin",
    ],
    icon: <ShieldCheck size={18} />,
  },
  {
    id: "finanzas",
    label: "Finanzas",
    roles: ["admin", "superadmin"],
    icon: <CreditCard size={18} />,
  },
  {
    id: "explorador",
    label: "Explorador",
    roles: ["admin", "superadmin"],
    icon: <Search size={18} />,
  },
  {
    id: "tipo-de-cambio",
    label: "Tipo de Cambio",
    roles: ["admin", "superadmin"],
    icon: <TrendingUp size={18} />,
  },
  {
    id: "configuracion",
    label: "Configuración",
    roles: ["superadmin"],
    icon: <Settings size={18} />,
  },
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

  return (
    <aside
      style={{
        width: 250,
        minWidth: 250,
        background: "#293C47",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Alexandria, sans-serif",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 6,
            padding: 6,
            display: "inline-flex",
          }}
        >
          <img
            src="https://res.cloudinary.com/duzs3pl6a/image/upload/v1770255192/diezx/logos/company_6983bd925f1914255ed16b85.png"
            alt="Logo"
            style={{ height: 28 }}
          />
        </div>
        <p
          style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            margin: "10px 0 0",
          }}
        >
          Portal de Gestión de Pagos
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        {visible.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 12px",
                marginBottom: 2,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: "Alexandria, sans-serif",
                color: active ? "#00AA85" : "#cbd5e1",
                background: active ? "rgba(0,170,133,0.1)" : "transparent",
                borderLeft: active
                  ? "3px solid #00AA85"
                  : "3px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <img
              src={user.picture}
              alt={user.name}
              style={{ width: 34, height: 34, borderRadius: "50%" }}
              referrerPolicy="no-referrer"
            />
            <div>
              <p
                style={{
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {user.name}
              </p>
              <p
                style={{
                  color: "#00AA85",
                  fontSize: 11,
                  margin: 0,
                  textTransform: "capitalize",
                }}
              >
                {user.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "8px 0",
              background: "rgba(239,68,68,0.12)",
              color: "#f87171",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "Alexandria, sans-serif",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
};
