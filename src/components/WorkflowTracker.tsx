import React from "react";
import type { Request } from "../data/mockData";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  XCircle,
  User,
  Calendar
} from "lucide-react";

interface Props {
  request: Request;
  onClose: () => void;
}

const stages = [
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

// "Approved" (legacy) equivale a la etapa de pago aprobado en el flujo actual
const normalizeStatus = (status: string): string =>
  status === "Approved" ? "Payment Approved" : status;

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
      className="rounded-xl border border-gray-700 overflow-hidden"
      style={{ backgroundColor: "#1e2d3d" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-700"
        style={{ backgroundColor: "#293C47" }}
      >
        <h3
          className="text-white font-semibold text-sm"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Seguimiento: {request.id}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <XCircle size={20} />
        </button>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
          <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-wider font-medium">
            <User size={12} className="text-[#3d7d80]" />
            <span>Solicitante:</span>
            <span className="text-gray-200">{request.submittedBy}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-wider font-medium">
            <Calendar size={12} className="text-[#3d7d80]" />
            <span>Enviado:</span>
            <span className="text-gray-200">{request.date}</span>
          </div>
          {request.estimatedPaymentDate && request.status !== "Paid" && (
            <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-wider font-medium">
              <Clock size={12} className="text-[#00aa85]" />
              <span>Pago programado:</span>
              <span className="text-[#00aa85] font-bold">{request.estimatedPaymentDate}</span>
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
                        ? "bg-[#00aa85] border-[#00aa85] text-white"
                        : isCurrent
                        ? "bg-[#3d7d80] border-[#00aa85] text-white shadow-[0_0_10px_rgba(0,170,133,0.3)]"
                        : "bg-transparent border-gray-600 text-gray-600"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={14} /> : isCurrent ? <Clock size={14} /> : <Circle size={10} />}
                  </div>
                  {(i < stages.length - 1 || isRejected) && (
                    <div
                      className={`w-0.5 h-8 mt-1 transition-colors duration-500 ${
                        isCompleted ? "bg-[#00aa85]" : "bg-gray-700"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-4">
                  <p
                    className={`text-xs font-semibold tracking-wide ${
                      isCompleted ? "text-[#00aa85]" : isCurrent ? "text-white" : "text-gray-500"
                    }`}
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    {stage.label}
                  </p>
                  {historyEvent ? (
                    <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-tighter">
                      {new Date(historyEvent.timestamp).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      <span className="text-gray-400 font-bold">{historyEvent.changedBy}</span>
                    </p>
                  ) : (
                    <p className={`text-[10px] mt-0.5 ${isPending ? "text-gray-600" : "text-gray-400"}`}>
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
                    <p className="text-red-500/70 text-[9px] mb-2 uppercase tracking-tighter font-bold">
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
