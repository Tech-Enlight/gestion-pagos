import React from "react";
import { ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";
import StatusPill from "../StatusPill";

/**
 * "Necesita tu atención" — priority queue of requests waiting on the user.
 * Renders the 5 oldest items in AUTORIZACION or PENDING_FIN. Clicking a
 * row navigates to the right view.
 */

interface PriorityQueueProps {
  requests: Request[];
  onView: (view: string) => void;
}

const fmtCurrency = (amount: number, currency: string) =>
  `${currency === "USD" ? "USD " : "$"}${amount.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

interface QueueRowProps {
  req: Request;
  urgent: boolean;
  onOpen: () => void;
}

const QueueRow: React.FC<QueueRowProps> = ({ req, urgent, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className="w-full flex items-center gap-3.5 mb-1.5 rounded-lg text-left transition-colors"
    style={{
      padding: "12px 14px",
      background: "transparent",
      border: "1px solid var(--border-on-dark)",
      fontFamily: "inherit",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.borderColor = "var(--border-on-dark)";
    }}
  >
    {urgent && (
      <span
        className="rounded-full flex-shrink-0"
        style={{
          width: 6,
          height: 6,
          background: "var(--enl-jade)",
          boxShadow: "0 0 0 4px rgba(0,170,133,0.18)",
        }}
      />
    )}
    <div className="min-w-0 flex-1">
      <div className="flex gap-2 items-baseline mb-0.5">
        <span
          className="text-xs font-semibold"
          style={{
            color: "var(--enl-jade)",
            fontFamily: "var(--font-secondary)",
          }}
        >
          {req.id}
        </span>
        <span className="text-white text-[13.5px] font-medium truncate">
          {req.beneficiary}
        </span>
      </div>
      <div
        className="text-[11.5px] truncate"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {req.projectNumber}
      </div>
    </div>
    <div className="text-right flex-shrink-0">
      <div className="text-white font-semibold text-[13.5px] tabular-nums">
        {fmtCurrency(req.amount, req.currency)}
      </div>
      <div className="mt-1">
        <StatusPill status={req.status} />
      </div>
    </div>
    <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
  </button>
);

const PriorityQueue: React.FC<PriorityQueueProps> = ({ requests, onView }) => {
  const queue = [...requests]
    .filter(
      (r) =>
        r.status === STATUS.AUTORIZACION || r.status === STATUS.PENDING_FIN
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "var(--bg-card-dark, #1e2d3d)",
        border: "1px solid var(--border-on-dark)",
      }}
    >
      <div
        className="flex items-start justify-between"
        style={{ padding: "16px 20px 8px" }}
      >
        <div>
          <h3
            className="m-0 text-white font-semibold"
            style={{ fontFamily: "var(--font-primary)", fontSize: 16 }}
          >
            Necesita tu atención
          </h3>
          <p
            className="m-0 mt-0.5 text-xs"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Solicitudes en espera, ordenadas por antigüedad
          </p>
        </div>
        <button
          type="button"
          onClick={() => onView("aprobaciones")}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors"
          style={{
            color: "rgba(255,255,255,0.7)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
          }}
        >
          Ver todas
          <ArrowRight size={13} />
        </button>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {queue.length === 0 ? (
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: "32px 16px", color: "rgba(255,255,255,0.6)" }}
          >
            <div
              className="flex items-center justify-center rounded-full mb-3"
              style={{
                width: 48,
                height: 48,
                background: "rgba(0,170,133,0.12)",
                color: "var(--enl-jade)",
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <p className="m-0 text-white font-medium">Estás al día</p>
            <p
              className="m-0 mt-1 text-xs"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              No hay solicitudes pendientes en este momento.
            </p>
          </div>
        ) : (
          queue.map((r, i) => (
            <QueueRow
              key={r.id}
              req={r}
              urgent={i < 2}
              onOpen={() =>
                onView(
                  r.status === STATUS.AUTORIZACION ? "aprobaciones" : "finanzas"
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;
