import React from "react";
import StatusPill from "./StatusPill";
import type { Request } from "../data/mockData";
import { X } from "lucide-react";

interface Props {
  request: Request;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClarification: (id: string) => void;
  onClose: () => void;
}

const DetailPanel: React.FC<Props> = ({
  request,
  onApprove,
  onReject,
  onClarification,
  onClose,
}) => {
  const canApprove =
    request.status === "Solicitada" || request.status === "Autorización" || request.status === "Pending Fin";

  return (
    <div
      className="w-80 shrink-0 rounded-xl border border-white/10 flex flex-col"
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
          {request.id}
        </h3>
        <button
          onClick={onClose}
          className="btn-close" aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/60 text-xs">Estado Actual</span>
          <StatusPill status={request.status} />
        </div>

        <DetailRow label="Proyecto" value={request.projectNumber} />
        <DetailRow label="Número de OC" value={request.poNumber} />
        <DetailRow label="Beneficiario" value={request.beneficiary} />
        <DetailRow
          label="Monto"
          value={`${request.amount.toLocaleString("es-MX")} ${request.currency
            }`}
          highlight
        />
        <DetailRow label="Solicitante" value={request.submittedBy} />
        <DetailRow label="Fecha" value={request.date} />

        {request.comment && (
          <div
            className="rounded-lg p-3 border border-yellow-600"
            style={{ backgroundColor: "var(--surface-warn)" }}
          >
            <p className="text-yellow-400 text-xs font-medium mb-1">
              Comentario
            </p>
            <p className="text-yellow-200 text-xs">{request.comment}</p>
          </div>
        )}
      </div>

      {canApprove && (
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            onClick={() => onApprove(request.id)}
            className="w-full py-2 rounded-lg text-white text-sm font-semibold bg-green-600 hover:bg-green-700 transition-colors"
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => onClarification(request.id)}
            className="w-full py-2 rounded-lg text-white text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 transition-colors"
          >
            ? Solicitar Aclaración
          </button>
          <button
            onClick={() => onReject(request.id)}
            className="w-full py-2 rounded-lg text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition-colors"
          >
            ✗ Rechazar
          </button>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-white/60 text-xs">{label}</span>
    <span
      className={`text-sm font-medium ${highlight ? "text-jade" : "text-white/90"
        }`}
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {value}
    </span>
  </div>
);

export default DetailPanel;
