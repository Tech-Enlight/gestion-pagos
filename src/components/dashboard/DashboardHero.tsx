import React from "react";
import { Shield, Plus } from "lucide-react";

/**
 * Editorial hero card for the top of the dashboard.
 *
 * Visual elements:
 *  - 120° gradient Marino → Acero → Cerceta
 *  - Jade radial glow + faded isotype watermark on the right (the "curva")
 *  - Eyebrow with today's date
 *  - 40px display headline ending in a gradient-jade number
 *  - Two CTAs (primary jade + secondary outline)
 *
 * Assumes /enlight/isotype.svg exists (added in step 1 of the
 * main migration guide).
 */

interface DashboardHeroProps {
  userFirstName: string;
  pendingAuth: number;
  pendingFin: number;
  approved: number;
  onGoToApprovals: () => void;
  onNewRequest: () => void;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
  userFirstName,
  pendingAuth,
  pendingFin,
  approved,
  onGoToApprovals,
  onNewRequest,
}) => {
  const totalWaiting = pendingAuth + pendingFin;
  const today = new Date();
  const dayName = today.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background:
          "linear-gradient(120deg, var(--enl-marino) 0%, var(--enl-acero) 65%, var(--enl-cerceta) 130%)",
        border: "1px solid var(--border-on-dark)",
        padding: "32px 36px",
        minHeight: 188,
      }}
    >
      {/* Jade radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: -180,
          top: -120,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,170,133,0.22) 0%, rgba(0,170,133,0) 65%)",
        }}
      />
      {/* Isotype watermark */}
      <img
        src="./isotype.svg"
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          right: 30,
          top: -10,
          width: 200,
          height: 200,
          opacity: 0.18,
        }}
      />

      <div className="relative" style={{ maxWidth: "65%" }}>
        <p
          className="m-0 mb-3.5 text-[11px] font-medium uppercase"
          style={{
            fontFamily: "var(--font-secondary)",
            letterSpacing: "0.2em",
            color: "var(--enl-jade)",
          }}
        >
          {dayCapitalized} · Panel general
        </p>

        <h1
          className="m-0 text-white"
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 300,
            fontSize: "clamp(28px, 3.5vw, 40px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          Buen día, {userFirstName}.{" "}
          <span
            style={{
              background: "var(--grad-jade-to-white)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              fontWeight: 400,
            }}
          >
            {totalWaiting}
          </span>{" "}
          <span style={{ fontWeight: 300 }}>
            {totalWaiting === 1
              ? "solicitud espera"
              : "solicitudes esperan"}{" "}
            tu atención.
          </span>
        </h1>

        <p
          className="mt-3.5 mb-5"
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: 15,
            lineHeight: 1.5,
            fontWeight: 300,
            maxWidth: 600,
          }}
        >
          {pendingAuth > 0
            ? `${pendingAuth} ${pendingAuth === 1 ? "está en" : "están en"
            } autorización y ${pendingFin} en revisión por Finanzas. Tu ciclo promedio es de 2.1 días.`
            : `Todo está al corriente. Aprovecha para revisar las ${approved} solicitudes listas para pagar.`}
        </p>

        <div className="flex gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onGoToApprovals}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors"
            style={{ background: "var(--enl-jade)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#009577";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--enl-jade)";
            }}
          >
            <Shield size={14} />
            Ir a aprobaciones
            {pendingAuth > 0 && (
              <span
                className="text-[11px] ml-1"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  padding: "1px 8px",
                  borderRadius: 999,
                }}
              >
                {pendingAuth}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onNewRequest}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            style={{
              background: "transparent",
              color: "white",
              border: "1px solid var(--border-on-dark)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Plus size={14} />
            Nueva solicitud
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHero;
