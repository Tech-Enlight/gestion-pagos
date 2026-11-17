import React from "react";
import { FLUJO_PROPUESTAS } from "../config/flujo";
import type { Request } from "../data/mockData";
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  User,
  Calendar,
  FileText
} from "lucide-react";

interface Props {
  request: Request;
  onClose: () => void;
}

const STAGES_ANTERIOR = [
  {
    key: "Draft",
    label: "Borrador",
    desc: "Solicitud creada por el colaborador",
  },
  {
    key: "Autorización",
    label: "Autorización",
    desc: "En revisión por Dirección",
  },
  {
    key: "Pending Fin",
    label: "Decisión de Pagos",
    desc: "En revisión por Administración",
  },
  {
    key: "Payment Approved",
    label: "Pago Aprobado",
    desc: "Contabilidad programa y procesa el pago",
  },
  { key: "Paid", label: "Pagado", desc: "Pago procesado" },
];

// Flujo de propuestas: Solicitada → (Finanzas la incluye en una propuesta aprobada por dos niveles) → Pago aprobado → Pagado
const STAGES_PROPUESTAS = [
  { key: "Draft", label: "Borrador", desc: "Solicitud creada por el colaborador" },
  { key: "Solicitada", label: "Solicitada", desc: "Finanzas la incluye en una propuesta de pagos" },
  { key: "Payment Approved", label: "Pago Aprobado", desc: "Propuesta aprobada; Finanzas programa y ejecuta el pago" },
  { key: "Paid", label: "Pagado", desc: "Pago procesado" },
];
const stages = FLUJO_PROPUESTAS ? STAGES_PROPUESTAS : STAGES_ANTERIOR;

// "Approved" (legacy) equivale a la etapa de pago aprobado en el flujo actual
const normalizeStatus = (status: string): string =>
  status === "Approved"
    ? "Payment Approved"
    // Estados del flujo anterior que aún no se hayan migrado se leen como "Solicitada"
    : FLUJO_PROPUESTAS && (status === "Autorización" || status === "Pending Fin") ? "Solicitada" : status;

const getStageIndex = (status: string): number => {
  if (status === "Rejected") return -1;
  const idx = stages.findIndex((s) => s.key === normalizeStatus(status));
  return idx >= 0 ? idx : 0;
};

const WorkflowTracker: React.FC<Props> = ({ request, onClose }) => {
  const currentIdx = getStageIndex(request.status);
  const isRejected = request.status === "Rejected";

  // Find the last successful stage index before rejection
  const lastValidStatus = isRejected 
    ? request.statusHistory?.filter(h => h.status !== "Rejected").slice(-1)[0]?.status 
    : request.status;
  
  const lastValidIdx = lastValidStatus ? stages.findIndex(s => s.key === normalizeStatus(lastValidStatus)) : 0;

  return (
    <div
      className="rounded-xl border border-white/10 overflow-hidden"
      style={{ backgroundColor: "var(--surface-modal)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ backgroundColor: "var(--enl-acero)" }}
      >
        <h3
          className="text-white font-semibold text-sm"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Seguimiento: {request.id}
        </h3>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors"
        >
          <XCircle size={20} />
        </button>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
          {request.poNumber && (
            <div className="flex items-center gap-1.5 text-white/60 text-[11px] uppercase tracking-wider font-medium">
              <FileText size={12} className="text-cerceta" />
              <span>OC:</span>
              <span className="text-white/90 font-bold">{request.poNumber}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-white/60 text-[11px] uppercase tracking-wider font-medium">
            <User size={12} className="text-cerceta" />
            <span>Solicitante:</span>
            <span className="text-white/90">{request.submittedBy}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/60 text-[11px] uppercase tracking-wider font-medium">
            <Calendar size={12} className="text-cerceta" />
            <span>Enviado:</span>
            <span className="text-white/90">{request.date}</span>
          </div>
          {request.estimatedPaymentDate && request.status !== "Paid" && (
            <div className="flex items-center gap-1.5 text-white/60 text-[11px] uppercase tracking-wider font-medium">
              <Clock size={12} className="text-jade" />
              <span>Pago programado:</span>
              <span className="text-jade font-bold">{request.estimatedPaymentDate}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {stages.map((stage, i) => {
            const isCompleted = isRejected ? i < lastValidIdx : i < currentIdx;
            const isCurrent = !isRejected && i === currentIdx;
            const isPending = isRejected ? i >= lastValidIdx : i > currentIdx;
            
            const historyEvent = request.statusHistory?.find(
              (e) => normalizeStatus(e.status) === stage.key
            );

            return (
              <div key={stage.key} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors duration-300 ${
                      isCompleted
                        ? "bg-jade border-jade text-white"
                        : isCurrent
                        ? "bg-cerceta border-jade text-white shadow-[0_0_10px_rgba(0,170,133,0.3)]"
                        : "bg-transparent border-white/20 text-white/40"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={14} /> : isCurrent ? <Clock size={14} /> : <Circle size={10} />}
                  </div>
                  {(i < stages.length - 1 || isRejected) && (
                    <div
                      className={`w-0.5 h-8 mt-1 transition-colors duration-500 ${
                        isCompleted ? "bg-jade" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-4">
                  <p
                    className={`text-xs font-semibold tracking-wide ${
                      isCompleted ? "text-jade" : isCurrent ? "text-white" : "text-white/60"
                    }`}
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    {stage.label}
                  </p>
                  {historyEvent ? (
                    <p className="text-white/60 text-[11px] mt-0.5 uppercase tracking-tighter">
                      {new Date(historyEvent.timestamp).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      <span className="text-white/60 font-bold">{historyEvent.changedBy}</span>
                    </p>
                  ) : (
                    <p className={`text-[11px] mt-0.5 ${isPending ? "text-white/60" : "text-white/80"}`}>
                      {stage.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Show Rejection step if applicable */}
          {isRejected && (
            <div className="flex gap-4 items-start mt-2">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-red-600 border-2 border-red-500 flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                  <XCircle size={14} />
                </div>
              </div>
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 w-full">
                <p className="text-red-400 font-bold text-xs uppercase tracking-wider mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
                  Solicitud Rechazada
                </p>
                {(() => {
                  const rejEvent = request.statusHistory?.find(e => e.status === "Rejected");
                  return rejEvent && (
                    <p className="text-red-500/70 text-[11px] mb-2 uppercase tracking-tighter font-bold">
                      {new Date(rejEvent.timestamp).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {rejEvent.changedBy}
                    </p>
                  );
                })()}
                {request.comment && (
                  <div className="bg-black/20 rounded p-2 border-l-2 border-red-500">
                    <p className="text-red-200 text-xs italic">"{request.comment}"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowTracker;
