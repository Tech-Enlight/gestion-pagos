import React from "react";
import { Lock } from "lucide-react";

interface Props {
  viewLabel?: string;
  onGoHome: () => void;
}

// Reemplaza la pantalla vacía que dejaba RoleGate (null) cuando un rol llegaba
// a una vista que no le corresponde (deep link por email, botón mal ruteado).
export const NoAccess: React.FC<Props> = ({ viewLabel, onGoHome }) => (
  <div
    role="alert"
    style={{
      maxWidth: 480,
      margin: "10vh auto 0",
      textAlign: "center",
      color: "#fff",
      fontFamily: "Alexandria, sans-serif",
    }}
  >
    <Lock size={28} style={{ opacity: 0.6, marginBottom: 12 }} />
    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
      No tienes acceso a {viewLabel ?? "esta vista"}
    </h2>
    <p style={{ color: "rgba(255,255,255,0.65)", fontWeight: 300, marginBottom: 20 }}>
      Tu rol no incluye esta sección. Si crees que es un error, avisa al equipo TECH.
    </p>
    <button
      type="button"
      onClick={onGoHome}
      className="px-4 py-2 rounded-lg text-white font-medium text-sm"
      style={{ background: "var(--enl-jade)" }}
    >
      Ir a Mis solicitudes
    </button>
  </div>
);
