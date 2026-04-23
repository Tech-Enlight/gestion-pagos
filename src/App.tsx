import React, { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { RoleGate } from "./components/RoleGate";
import Dashboard from "./components/Dashboard";
import NewRequest from "./components/NewRequest";
import ApprovalManagement from "./components/ApprovalManagement";
import RequestExplorer from "./components/RequestExplorer";
import RecentRequestsTable from "./components/RecentRequestsTable";
import ExchangeChart from "./components/ExchangeChart";
import FinanceManagement from "./components/FinanceManagement";
import { mockRequests } from "./data/mockData";
import type { Request } from "./data/mockData";
import {
  fetchRequests,
  createRequest,
  updateRequestStatus,
  updateFinanceFields,
} from "./services/sheets";

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState("nueva-solicitud");
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests()
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAddRequest = async (data: any) => {
    const created = await createRequest(data);
    setRequests((prev) => [created, ...prev]);
  };

  const handleUpdateRequest = async (
    id: string,
    status: string,
    comment?: string
  ) => {
    await updateRequestStatus(id, status, user?.email || "unknown@enlight.mx", comment);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, comment: comment || r.comment } : r
      )
    );
  };

  const handleUpdateFinanceFields = async (
    id: string,
    fields: Partial<Request>
  ) => {
    await updateFinanceFields(id, fields);
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...fields } : r))
    );
  };

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#121926" }}>
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main style={{ flex: 1, overflow: "auto", padding: "2rem" }}>
        <RoleGate allowedRoles={["admin", "superadmin"]}>
          {currentView === "dashboard" && <Dashboard requests={requests} />}
        </RoleGate>

        {currentView === "nueva-solicitud" && (
          <NewRequest
            onAddRequest={handleAddRequest}
            onNavigate={setCurrentView}
          />
        )}

        {currentView === "mis-solicitudes" && (
          <RequestExplorer
            requests={requests}
            onUpdateRequest={handleUpdateRequest}
          />
        )}

        <RoleGate
          allowedRoles={[
            "mac",
            "operaciones",
            "ingenieria",
            "servicios",
            "admin",
            "superadmin",
          ]}
        >
          {currentView === "aprobaciones" && (
            <ApprovalManagement
              requests={requests}
              onUpdateRequest={handleUpdateRequest}
            />
          )}
        </RoleGate>

        <RoleGate allowedRoles={["admin", "superadmin"]}>
          {currentView === "finanzas" && (
            <FinanceManagement
              requests={requests}
              onUpdateRequest={handleUpdateRequest}
              onUpdateFinanceFields={handleUpdateFinanceFields}
            />
          )}
          {currentView === "explorador" && (
            <RequestExplorer
              requests={requests}
              onUpdateRequest={handleUpdateRequest}
            />
          )}
          {currentView === "tipo-de-cambio" && <ExchangeChart />}
        </RoleGate>

        <RoleGate allowedRoles={["superadmin"]}>
          {currentView === "configuracion" && (
            <div
              style={{ color: "#fff", fontFamily: "Alexandria, sans-serif" }}
            >
              <h2 style={{ fontSize: 20, marginBottom: 16 }}>Configuración</h2>
              <p style={{ color: "#94a3b8" }}>
                Sección de configuración — próximamente.
              </p>
            </div>
          )}
        </RoleGate>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID!}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
