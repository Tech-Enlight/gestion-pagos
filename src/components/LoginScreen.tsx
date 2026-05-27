import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

export const LoginScreen: React.FC = () => {
  const { login, authError } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F1923",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Alexandria, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(41,60,71,0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "3rem 2.5rem",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <img src="/enlight/logo-white.svg" alt="Enlight" style={{ height: 32, marginBottom: 28 }} />
        <h1
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          Portal de Gestión de Pagos
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: 14,
            margin: "0 0 32px",
            lineHeight: 1.5,
          }}
        >
          Inicia sesión con tu cuenta de Google Workspace para continuar.
        </p>

        <div style={{ display: "inline-flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={login}
            onError={() => { }}
            theme="filled_black"
            size="large"
            shape="pill"
          />
        </div>

        {authError && (
          <p
            style={{
              color: "#ef4444",
              fontSize: 13,
              marginTop: 20,
              fontWeight: 500,
            }}
          >
            {authError}
          </p>
        )}

        <p style={{ color: "#475569", fontSize: 12, marginTop: 40 }}>
          Solo accesible para usuarios de la organización
        </p>
      </div>
    </div>
  );
};
