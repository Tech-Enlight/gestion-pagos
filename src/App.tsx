import { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { RoleGate } from "./components/RoleGate";
import Dashboard from "./components/Dashboard";
import NewRequest from "./components/NewRequest";
import ApprovalManagement from "./components/ApprovalManagement";
import RequestExplorer from "./components/RequestExplorer";
import ExchangeChart from "./components/ExchangeChart";
import FinanceManagement from "./components/FinanceManagement";
import DecisionPagos from "./components/DecisionPagos";
import type { Request, ExchangeRate } from "./data/mockData";
import {
  fetchRequests,
  createRequest,
  updateRequestStatus,
  updateFinanceFields,
  fetchExchangeRates,
} from "./services/sheets";

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState("nueva-solicitud");
  const [requests, setRequests] = useState<Request[]>([]);
  const [lastExchangeRate, setLastExchangeRate] = useState<ExchangeRate>({
    date: "2023-10-30",
    rate: 17.72,
  });

  useEffect(() => {
    fetchRequests()
      .then(setRequests)
      .catch(console.error);

    fetchExchangeRates()
      .then((rates) => {
        if (rates && rates.length > 0) {
          setLastExchangeRate(rates[rates.length - 1]);
        }
      })
      .catch(console.error);
  }, []);

  const handleAddRequest = async (data: any) => {
    const created = await createRequest(data);
    setRequests((prev) => [created, ...prev]);
  };

  const handleUpdateRequest = async (
    id: string,
    status: string,
    extra?: {
      comment?: string;
      rejectReason?: string;
      clarificationRequest?: string;
      clarificationResponse?: string;
    }
  ) => {
    await updateRequestStatus(id, status, user?.email || "unknown@enlight.mx", extra);
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, ...extra } : r
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
        {/* Los gates replican la matriz de visibilidad del Sidebar (2026-07-15) */}
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
          {currentView === "dashboard" && (
            <Dashboard
              requests={requests}
              lastExchangeRate={lastExchangeRate}
              onNavigate={setCurrentView}
            />
          )}
        </RoleGate>

        {currentView === "nueva-solicitud" && (
          <NewRequest
            onAddRequest={handleAddRequest}
            onNavigate={setCurrentView}
          />
        )}

        {currentView === "mis-solicitudes" && (
          <RequestExplorer
            mode="mine"
            requests={requests.filter((r) =>
              r.submittedByEmail
                ? r.submittedByEmail === user?.email
                : r.submittedBy === user?.name
            )}
            onUpdateRequest={handleUpdateRequest}
          />
        )}

        <RoleGate
          allowedRoles={[
            "mac",
            "operaciones",
            "ingenieria",
            "servicios",
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

        <RoleGate allowedRoles={["analista_contable", "superadmin"]}>
          {currentView === "finanzas" && (
            <FinanceManagement
              requests={requests}
              lastExchangeRate={lastExchangeRate}
              onUpdateRequest={handleUpdateRequest}
              onUpdateFinanceFields={handleUpdateFinanceFields}
            />
          )}
        </RoleGate>

        <RoleGate allowedRoles={["admin", "superadmin", "analista_contable"]}>
          {currentView === "explorador" && (
            <RequestExplorer
              requests={requests}
              onUpdateRequest={handleUpdateRequest}
            />
          )}
          {currentView === "decision-pagos" && (
            <DecisionPagos onUpdateRequest={handleUpdateRequest} />
          )}
        </RoleGate>

        {currentView === "tipo-de-cambio" && <ExchangeChart />}

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
