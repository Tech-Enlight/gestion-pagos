import React from "react";
import { AlertTriangle } from "lucide-react";
import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";

/**
 * Vertical pipeline funnel — replaces the old donut "Distribución por Estado".
 *
 * Each row = one workflow stage. Bar width is proportional to how many
 * requests are currently in that stage. Connector lines between rows hint
 * at flow. Rejected requests show as a separate red note below (they
 * leave the pipeline, they don't advance).
 *
 * Click a stage → jumps to the relevant view (aprobaciones / finanzas /
 * explorador) via the onStageClick prop.
 */

interface PipelineFunnelProps {
  requests: Request[];
  onStageClick?: (status: string) => void;
}

const STAGES = [
  { status: STATUS.DRAFT,        label: "Borrador",        desc: "Pendiente de envío" },
  { status: STATUS.AUTORIZACION, label: "En autorización", desc: "Tu jefe directo revisa" },
  { status: STATUS.PENDING_FIN,  label: "Revisión Finanzas", desc: "Finanzas valida" },
  { status: STATUS.APPROVED,     label: "Lista para pago", desc: "Pendiente de ejecución" },
  { status: STATUS.PAID,         label: "Pagada",          desc: "Ciclo cerrado" },
];

// Hex equivalents of statusColors (Tailwind classes) — used by charts.
export const STATUS_HEX: Record<string, string> = {
  Draft:           "#828080",
  "Autorización":  "#eab308",
  "Pending Fin":   "#3D7D80",
  Approved:        "#00AA85",
  Paid:            "#a855f7",
  Rejected:        "#ef4444",
};

const PipelineFunnel: React.FC<PipelineFunnelProps> = ({ requests, onStageClick }) => {
  const stages = STAGES.map((s) => ({
    ...s,
    count: requests.filter((r) => r.status === s.status).length,
    color: STATUS_HEX[s.status] || "#828080",
  }));
  const max = Math.max(...stages.map((s) => s.count), 1);
  const total = requests.length;
  const rejected = requests.filter((r) => r.status === STATUS.REJECTED).length;

  return (
    <div>
      {stages.map((s, i) => {
        const widthPct = 22 + (s.count / max) * 78;
        const pctOfTotal = total > 0 ? (s.count / total) * 100 : 0;
        const isLast = i === stages.length - 1;
        const clickable = !!onStageClick;
        return (
          <div key={s.status}>
            <button
              type="button"
              onClick={() => onStageClick?.(s.status)}
              disabled={!clickable}
              className="w-full block bg-transparent border-0 text-left font-inherit rounded transition-colors"
              style={{
                padding: "6px 0",
                cursor: clickable ? "pointer" : "default",
              }}
              onMouseEnter={(e) => {
                if (clickable) e.currentTarget.style.background = "rgba(255,255,255,0.025)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Header row */}
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: s.color,
                      boxShadow: s.count > 0 ? `0 0 0 3px ${s.color}26` : "none",
                    }}
                  />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: s.count > 0 ? "white" : "rgba(255,255,255,0.55)" }}
                  >
                    {s.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-shrink-0">
                  <span
                    className="text-[11px] tabular-nums"
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "var(--font-secondary)",
                    }}
                  >
                    {pctOfTotal.toFixed(0)}%
                  </span>
                  <span
                    className="text-white font-semibold text-sm tabular-nums text-right"
                    style={{ minWidth: 22 }}
                  >
                    {s.count}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="relative" style={{ height: 22, marginLeft: 17 }}>
                <div
                  className="absolute left-0 top-0 bottom-0 flex items-center"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, ${s.color} 0%, color-mix(in oklab, ${s.color} 70%, transparent) 100%)`,
                    borderRadius: 4,
                    paddingLeft: 10,
                    opacity: s.count > 0 ? 1 : 0.25,
                    transition: "width 600ms cubic-bezier(.4,0,.2,1)",
                  }}
                >
                  <span
                    className="text-[10.5px] font-semibold"
                    style={{
                      color: "rgba(255,255,255,0.92)",
                      fontFamily: "var(--font-secondary)",
                      letterSpacing: "0.04em",
                      textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                    }}
                  >
                    {s.desc}
                  </span>
                </div>
              </div>
            </button>

            {/* Connector */}
            {!isLast && (
              <div className="relative" style={{ marginLeft: 19, height: 10 }}>
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{
                    width: 1.5,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Rejected — out of the funnel */}
      {rejected > 0 && (
        <div
          className="mt-3.5 flex items-center gap-2.5 rounded-lg"
          style={{
            padding: "10px 12px",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.18)",
          }}
        >
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <span className="text-[12.5px] flex-1" style={{ color: "rgba(255,255,255,0.85)" }}>
            <strong className="text-white font-semibold">{rejected}</strong>
            {" "}
            {rejected === 1 ? "rechazada" : "rechazadas"} fuera del flujo
          </span>
          <span
            className="text-[11px]"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontFamily: "var(--font-secondary)",
            }}
          >
            {total > 0 ? ((rejected / total) * 100).toFixed(0) : 0}% del total
          </span>
        </div>
      )}
    </div>
  );
};

export default PipelineFunnel;
