import React from "react";
import StatusPill from "./StatusPill";
import type { Request } from "../data/mockData";

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
    request.status === "Autorización" || request.status === "Pending Fin";

  return (
    <div
      className="w-80 shrink-0 rounded-xl border border-gray-700 flex flex-col"
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
          {request.id}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Estado Actual</span>
          <StatusPill status={request.status} />
        </div>

        <DetailRow label="Proyecto" value={request.projectNumber} />
        <DetailRow label="Número de OC" value={request.poNumber} />
        <DetailRow label="Beneficiario" value={request.beneficiary} />
        <DetailRow
          label="Monto"
          value={`${request.amount.toLocaleString("es-MX")} ${
            request.currency
          }`}
          highlight
        />
        <DetailRow label="Solicitante" value={request.submittedBy} />
        <DetailRow label="Fecha" value={request.date} />

        {request.comment && (
          <div
            className="rounded-lg p-3 border border-yellow-600"
            style={{ backgroundColor: "#2a2a1a" }}
          >
            <p className="text-yellow-400 text-xs font-medium mb-1">
              Comentario
            </p>
            <p className="text-yellow-200 text-xs">{request.comment}</p>
          </div>
        )}
      </div>

      {canApprove && (
        <div className="p-4 border-t border-gray-700 space-y-2">
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
    <span className="text-gray-500 text-xs">{label}</span>
    <span
      className={`text-sm font-medium ${
        highlight ? "text-[#00aa85]" : "text-gray-200"
      }`}
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {value}
    </span>
  </div>
);

export default DetailPanel;
