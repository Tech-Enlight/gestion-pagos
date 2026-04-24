import React, { useState } from "react";
import { 
  CheckCircle2, 
  HelpCircle, 
  XCircle 
} from "lucide-react";
import StatusPill from "./StatusPill";
import RejectModal from "./RejectModal";
import { STATUS } from "../data/mockData";
import type { Request } from "../data/mockData";

interface Props {
  requests: Request[];
  onUpdateRequest: (id: string, status: string, extra?: any) => void;
}

const ApprovalManagement: React.FC<Props> = ({ requests, onUpdateRequest }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [clarifyTarget, setClarifyTarget] = useState<string | null>(null);

  const pendingRequests = requests.filter(
    (r) => r.status === STATUS.AUTORIZACION
  );

  const selected = pendingRequests.find((r) => r.id === selectedId) ?? null;

  const canAct = selected
    ? selected.status === STATUS.AUTORIZACION
    : false;

  const handleApprove = () => {
    if (!selected) return;
    onUpdateRequest(selected.id, STATUS.PENDING_FIN);
    setSelectedId(null);
  };

  const handleReject = (id: string, comment: string) => {
    onUpdateRequest(id, STATUS.REJECTED, { rejectReason: comment });
    setRejectTarget(null);
    setSelectedId(null);
  };

  const handleClarification = () => {
    if (!selected) return;
    setClarifyTarget(selected.id);
  };

  const handleClarifyConfirm = (id: string, comment: string) => {
    onUpdateRequest(id, STATUS.DRAFT, { clarificationRequest: comment });
    setClarifyTarget(null);
    setSelectedId(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2
          className="text-white text-2xl font-bold mb-1"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Gestión de Aprobaciones
        </h2>
        <p className="text-gray-400 text-sm">
          {pendingRequests.length} solicitud
          {pendingRequests.length !== 1 ? "es" : ""} requiere
          {pendingRequests.length !== 1 ? "n" : ""} atención
        </p>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border border-gray-700 overflow-hidden"
        style={{ backgroundColor: "#1e2d3d" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#293C47" }}>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                ID
              </th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                Beneficiario
              </th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                Proyecto
              </th>
              <th className="text-right px-4 py-3 text-gray-300 font-semibold">
                Monto
              </th>
              <th className="text-center px-4 py-3 text-gray-300 font-semibold">
                Estado
              </th>
              <th className="text-center px-4 py-3 text-gray-300 font-semibold">
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {pendingRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No hay solicitudes pendientes
                </td>
              </tr>
            )}
            {pendingRequests.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-gray-700 transition-colors cursor-pointer ${
                  selectedId === r.id ? "bg-[#243545]" : "hover:bg-[#243545]"
                }`}
                onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
              >
                <td className="px-4 py-3 text-[#00aa85] font-medium">{r.id}</td>
                <td className="px-4 py-3 text-gray-300">{r.beneficiary}</td>
                <td className="px-4 py-3 text-gray-400">{r.projectNumber}</td>
                <td className="px-4 py-3 text-gray-200 text-right">
                  {r.amount.toLocaleString("es-MX")} {r.currency}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(r.id);
                    }}
                    className="px-3 py-1 rounded text-xs font-medium text-white transition-colors"
                    style={{ backgroundColor: "#3d7d80" }}
                  >
                    Revisar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline detail + actions (replaces side panel) */}
      {selected && (
        <div
          className="rounded-xl border border-gray-700 overflow-hidden"
          style={{ backgroundColor: "#1e2d3d" }}
        >
          {/* Detail header */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-gray-700"
            style={{ backgroundColor: "#293C47" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-white font-semibold"
                style={{ fontFamily: "Alexandria, sans-serif" }}
              >
                {selected.id}
              </span>
              <StatusPill status={selected.status} />
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Detail body — 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            <Field label="Beneficiario" value={selected.beneficiary} />
            <Field label="Proyecto / Depto." value={selected.projectNumber} />
            <Field label="OC" value={selected.poNumber} />
            <Field label="Concepto" value={selected.concept} />
            <Field label="Departamento" value={selected.department} />
            <Field label="Solicitante" value={selected.submittedBy} />
            <Field
              label="Subtotal"
              value={`$${selected.subtotal.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}`}
            />
            <Field
              label="IVA"
              value={`$${selected.iva.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}`}
            />
            <Field
              label="Monto Total"
              value={`$${selected.amount.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })} ${selected.currency}`}
              highlight
            />
            <Field label="Fecha" value={selected.date} />
          </div>

          {/* Comment (if any) */}
          {selected.comment && (
            <div className="px-5 pb-4">
              <div
                className="rounded-lg p-3 border border-yellow-600"
                style={{ backgroundColor: "#2a2a1a" }}
              >
                <p className="text-yellow-400 text-xs font-medium mb-1">
                  Comentario
                </p>
                <p className="text-yellow-200 text-xs">{selected.comment}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-700 flex-wrap">
            {canAct && (
              <>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-green-600 hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20"
                >
                  <CheckCircle2 size={16} />
                  Aprobar
                </button>
                <button
                  onClick={handleClarification}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 transition-colors shadow-lg shadow-yellow-900/20"
                >
                  <HelpCircle size={16} />
                  Aclaración
                </button>
                <button
                  onClick={() => setRejectTarget(selected.id)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                >
                  <XCircle size={16} />
                  Rechazar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          requestId={rejectTarget}
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Clarification Modal */}
      {clarifyTarget && (
        <ClarifyModal
          requestId={clarifyTarget}
          onConfirm={handleClarifyConfirm}
          onCancel={() => setClarifyTarget(null)}
        />
      )}
    </div>
  );
};

/* Inline field display */
const Field: React.FC<{
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

const ClarifyModal: React.FC<{
  requestId: string;
  onConfirm: (id: string, comment: string) => void;
  onCancel: () => void;
}> = ({ requestId, onConfirm, onCancel }) => {
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState("");

  const handleConfirm = () => {
    if (!comment.trim()) {
      setError("Describe qué necesitas que el solicitante aclare.");
      return;
    }
    onConfirm(requestId, comment.trim());
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="rounded-xl p-6 border border-yellow-700 shadow-2xl max-w-md w-full mx-4"
        style={{ backgroundColor: "#1e2d3d" }}
      >
        <h3
          className="text-white text-lg font-bold mb-2"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Solicitar Aclaración — {requestId}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Describe qué información necesitas que el solicitante corrija o
          aclare.
        </p>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setError("");
          }}
          placeholder="Ej: Falta factura anexa, verificar monto..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-yellow-500 resize-none"
          style={{
            backgroundColor: "#293C47",
            fontFamily: "Alexandria, sans-serif",
          }}
        />
        {error && <p className="text-yellow-400 text-xs mt-1">{error}</p>}
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-gray-300 text-sm font-medium border border-gray-600 hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 transition-colors"
          >
            Enviar Aclaración
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalManagement;
