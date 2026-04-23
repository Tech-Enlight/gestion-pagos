import React from "react";
import type { Request } from "../data/mockData";

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
    desc: "En revisión por el equipo autorizador",
  },
  {
    key: "Pending Fin",
    label: "Revisión Finanzas",
    desc: "En revisión por Finanzas",
  },
  { key: "Approved", label: "Aprobado", desc: "Aprobado por todas las partes" },
  { key: "Paid", label: "Pagado", desc: "Pago procesado" },
];

const getStageIndex = (status: string): number => {
  if (status === "Rejected") return -1;
  const idx = stages.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
};

const WorkflowTracker: React.FC<Props> = ({ request, onClose }) => {
  const currentIdx = getStageIndex(request.status);
  const isRejected = request.status === "Rejected";

  return (
    <div
      className="rounded-xl border border-gray-700"
      style={{ backgroundColor: "#1e2d3d" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-700"
        style={{ backgroundColor: "#293C47", borderRadius: "12px 12px 0 0" }}
      >
        <h3
          className="text-white font-semibold text-sm"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Seguimiento: {request.id}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        <p className="text-gray-400 text-xs mb-1">
          Solicitante:{" "}
          <span className="text-gray-200">{request.submittedBy}</span>
        </p>
        <p className="text-gray-400 text-xs mb-4">
          Enviado: <span className="text-gray-200">{request.date}</span>
        </p>

        {isRejected ? (
          <div
            className="rounded-lg p-3 border border-red-700"
            style={{ backgroundColor: "#2a1a1a" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-white text-xs">
                ✗
              </div>
              <span className="text-red-400 font-semibold text-sm">
                Solicitud Rechazada
              </span>
            </div>
            {(() => {
              const rejEvent = request.statusHistory?.find(
                (e) => e.status === "Rejected"
              );
              return rejEvent ? (
                <p className="text-gray-500 text-[10px] mb-1">
                  {new Date(rejEvent.timestamp).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {rejEvent.changedBy}
                </p>
              ) : null;
            })()}
            {request.comment && (
              <p className="text-red-300 text-xs">{request.comment}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {stages.map((stage, i) => {
              const isCompleted = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isPending = i > currentIdx;
              const historyEvent = request.statusHistory?.find(
                (e) => e.status === stage.key
              );
              return (
                <div key={stage.key} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                        isCompleted
                          ? "bg-[#00aa85] border-[#00aa85] text-white"
                          : isCurrent
                          ? "bg-[#3d7d80] border-[#00aa85] text-white"
                          : "bg-transparent border-gray-600 text-gray-600"
                      }`}
                    >
                      {isCompleted ? "✓" : i + 1}
                    </div>
                    {i < stages.length - 1 && (
                      <div
                        className={`w-0.5 h-6 mt-1 ${
                          isCompleted ? "bg-[#00aa85]" : "bg-gray-700"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pb-2">
                    <p
                      className={`text-xs font-semibold ${
                        isCompleted
                          ? "text-[#00aa85]"
                          : isCurrent
                          ? "text-white"
                          : "text-gray-600"
                      }`}
                      style={{ fontFamily: "Alexandria, sans-serif" }}
                    >
                      {stage.label}
                      {isCurrent && (
                        <span className="ml-2 text-[#3d7d80]">(Actual)</span>
                      )}
                    </p>
                    {historyEvent && (isCompleted || isCurrent) ? (
                      <p className="text-gray-500 text-[10px] mt-0.5">
                        {new Date(historyEvent.timestamp).toLocaleString(
                          "es-MX",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                        {" · "}
                        <span className="text-gray-400">
                          {historyEvent.changedBy}
                        </span>
                      </p>
                    ) : (
                      <p
                        className={`text-xs mt-0.5 ${
                          isPending ? "text-gray-600" : "text-gray-400"
                        }`}
                      >
                        {stage.desc}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowTracker;
