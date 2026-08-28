import { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { RoleGate } from "./components/RoleGate";
import TopBar from "./components/TopBar";
import Feed from "./components/Feed";
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

// Views deep-linkable via ?view=... (e.g. from an email CTA) — anything else
// falls back to the default landing view. RoleGate still hides content the
// user's role can't see, so an inapplicable deep link just renders nothing.
const VALID_VIEWS = new Set([
  "inicio", "dashboard", "nueva-solicitud", "mis-solicitudes", "aprobaciones",
  "finanzas", "explorador", "decision-pagos", "tipo-de-cambio", "configuracion",
]);
const getInitialView = () => {
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested && VALID_VIEWS.has(requested) ? requested : "nueva-solicitud";
};

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState(getInitialView);
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
      concept?: string;
      department?: string;
      subtotal?: number;
      iva?: number;
      amount?: number;
      paymentType?: string;
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar onNavigate={setCurrentView} />
        <main style={{ flex: 1, overflow: "auto", padding: "2rem" }}>
        {/* Los gates replican la matriz de visibilidad del Sidebar (2026-07-15).
            "inicio" queda intencionalmente sin RoleGate: todos los roles la leen (2026-08-20). */}
        {currentView === "inicio" && <Feed />}

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
            existingRequests={requests}
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
