import React from "react";
import { ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import type { Request } from "../../data/mockData";
import StatusPill from "../StatusPill";

/**
 * "Necesita tu atención" — cola de solicitudes que le toca trabajar al rol
 * actual. El filtrado por rol lo hace el padre (Dashboard); aquí solo se
 * muestran las 5 más antiguas y se avisa cuántas más hay.
 */

const MAX_ROWS = 5;

interface PriorityQueueProps {
  /** Ya filtrada por rol y ordenada de más antigua a más reciente. */
  queue: Request[];
  loading: boolean;
  viewAllLabel: string;
  onViewAll: () => void;
  /** Recibe el estado de la solicitud; el padre decide a qué vista llevar. */
  onOpen: (status: string) => void;
}

const fmtCurrency = (amount: number, currency: string) =>
  `${currency === "USD" ? "USD " : "$"}${amount.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const daysWaiting = (iso: string) => {
  const start = new Date(`${iso}T00:00:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
};

interface QueueRowProps {
  req: Request;
  urgent: boolean;
  onOpen: () => void;
}

const QueueRow: React.FC<QueueRowProps> = ({ req, urgent, onOpen }) => {
  const days = daysWaiting(req.date);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3.5 mb-1.5 rounded-lg text-left transition-colors hover:bg-white/[0.03] hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--enl-jade)]"
      style={{
        padding: "12px 14px",
        background: "transparent",
        border: "1px solid var(--border-on-dark)",
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {urgent && (
        <span
          aria-hidden
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
            className="text-xs font-semibold flex-shrink-0"
            style={{ color: "var(--enl-jade)", fontFamily: "var(--font-secondary)" }}
          >
            {req.id}
          </span>
          <span className="text-white text-[13.5px] font-medium truncate">
            {req.beneficiary}
          </span>
        </div>
        <div className="text-[11.5px] truncate" style={{ color: "rgba(255,255,255,0.6)" }}>
          {req.projectNumber}
          {days > 0 && ` · hace ${days} ${days === 1 ? "día" : "días"}`}
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
      <ChevronRight size={14} aria-hidden style={{ color: "rgba(255,255,255,0.4)" }} />
    </button>
  );
};

const PriorityQueue: React.FC<PriorityQueueProps> = ({
  queue,
  loading,
  viewAllLabel,
  onViewAll,
  onOpen,
}) => {
  const rows = queue.slice(0, MAX_ROWS);
  const extra = queue.length - rows.length;

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "var(--bg-card-dark, #1e2d3d)",
        border: "1px solid var(--border-on-dark)",
      }}
    >
      <div className="flex items-start justify-between gap-3" style={{ padding: "16px 20px 8px" }}>
        <div>
          <h3
            className="m-0 text-white font-semibold"
            style={{ fontFamily: "var(--font-primary)", fontSize: 16 }}
          >
            Necesita tu atención
          </h3>
          <p className="m-0 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            Las más antiguas primero
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 min-h-9 rounded transition-colors flex-shrink-0 text-white/70 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--enl-jade)]"
          style={{ background: "transparent" }}
        >
          {viewAllLabel}
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {loading ? (
          <p className="m-0 text-center text-xs" style={{ padding: "32px 16px", color: "rgba(255,255,255,0.6)" }}>
            Cargando solicitudes…
          </p>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: "32px 16px", color: "rgba(255,255,255,0.7)" }}
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
              <CheckCircle2 size={26} aria-hidden />
            </div>
            <p className="m-0 text-white font-medium">Estás al día</p>
            <p className="m-0 mt-1 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              No hay solicitudes esperando tu acción.
            </p>
          </div>
        ) : (
          <>
            {rows.map((r, i) => (
              <QueueRow key={r.id} req={r} urgent={i < 2} onOpen={() => onOpen(r.status)} />
            ))}
            {extra > 0 && (
              <p className="m-0 mt-2 text-xs text-center" style={{ color: "rgba(255,255,255,0.6)" }}>
                +{extra} {extra === 1 ? "solicitud más" : "solicitudes más"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PriorityQueue;
