import React, { useState } from "react";
import StatusPill from "./StatusPill";
import WorkflowTracker from "./WorkflowTracker";
import { STATUS } from "../data/mockData";
import type { Request } from "../data/mockData";

interface Props {
  requests: Request[];
  onUpdateRequest: (id: string, status: string, comment?: string) => void;
}

const statuses = [
  "Todos",
  "Draft",
  "Autorización",
  "Pending Fin",
  "Approved",
  "Paid",
  "Rejected",
];

const isClarification = (r: Request): boolean =>
  r.status === "Draft" && !!r.comment && r.comment.length > 0;

const RequestExplorer: React.FC<Props> = ({ requests, onUpdateRequest }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selected, setSelected] = useState<Request | null>(null);
  const [clarificationNote, setClarificationNote] = useState("");

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      r.beneficiary.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.projectNumber.toLowerCase().includes(q);
    const matchStatus = statusFilter === "Todos" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSelect = (r: Request) => {
    setSelected(r);
    setClarificationNote("");
  };

  const handleResubmit = () => {
    if (!selected) return;
    const note = clarificationNote.trim();
    onUpdateRequest(selected.id, STATUS.AUTORIZACION, note || undefined);
    setSelected(null);
    setClarificationNote("");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2
          className="text-white text-2xl font-bold mb-1"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Explorador de Solicitudes
        </h2>
        <p className="text-gray-400 text-sm">
          Busca y filtra el historial completo de solicitudes de pago.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por beneficiario, ID o proyecto..."
          className="flex-1 px-4 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
          style={{
            backgroundColor: "#1e2d3d",
            fontFamily: "Alexandria, sans-serif",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
          style={{
            backgroundColor: "#1e2d3d",
            fontFamily: "Alexandria, sans-serif",
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="text-gray-500 text-xs">
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado
        {filtered.length !== 1 ? "s" : ""}
      </p>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">
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
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No se encontraron solicitudes
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className={`border-t border-gray-700 cursor-pointer transition-colors ${
                      selected?.id === r.id
                        ? "bg-[#243545]"
                        : "hover:bg-[#243545]"
                    }`}
                  >
                    <td className="px-4 py-3 text-[#00aa85] font-medium">
                      <span className="flex items-center gap-2">
                        {r.id}
                        {isClarification(r) && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-yellow-300 border border-yellow-600"
                            style={{
                              backgroundColor: "rgba(234, 179, 8, 0.12)",
                            }}
                            title="Requiere aclaración"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Aclaración
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.beneficiary}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {r.projectNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-right">
                      {r.amount.toLocaleString("es-MX")} {r.currency}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel */}
        {selected && (
          <div className="w-80 shrink-0 space-y-3">
            {/* Workflow Tracker (always shown) */}
            <WorkflowTracker
              request={selected}
              onClose={() => setSelected(null)}
            />

            {/* Clarification Panel */}
            {isClarification(selected) && (
              <div
                className="rounded-xl border border-yellow-700 p-4 space-y-3"
                style={{ backgroundColor: "#1e2d3d" }}
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h4
                    className="text-yellow-400 font-semibold text-sm"
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    Aclaración Solicitada
                  </h4>
                </div>

                {/* Reviewer comment */}
                <div
                  className="rounded-lg p-3 border border-yellow-800"
                  style={{ backgroundColor: "rgba(234, 179, 8, 0.06)" }}
                >
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                    Comentario del revisor
                  </p>
                  <p className="text-gray-200 text-xs leading-relaxed">
                    {selected.comment}
                  </p>
                </div>

                {/* Response textarea */}
                <div>
                  <label
                    className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold"
                    htmlFor="clarification-note"
                  >
                    Tu respuesta / nota
                  </label>
                  <textarea
                    id="clarification-note"
                    value={clarificationNote}
                    onChange={(e) => setClarificationNote(e.target.value)}
                    placeholder="Explica las correcciones realizadas..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors resize-none"
                    style={{
                      backgroundColor: "#162430",
                      fontFamily: "Alexandria, sans-serif",
                    }}
                  />
                </div>

                {/* Resubmit button */}
                <button
                  onClick={handleResubmit}
                  className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors hover:brightness-110"
                  style={{
                    backgroundColor: "#00aa85",
                    fontFamily: "Alexandria, sans-serif",
                  }}
                >
                  Re-enviar a Autorización
                </button>
              </div>
            )}

            {/* Finance data (shown when finance fields exist) */}
            {(selected.amountPaid ||
              selected.bankName ||
              selected.operationRef ||
              selected.status === "Paid" ||
              selected.status === "Approved") && (
              <div
                className="rounded-xl border border-gray-700 p-4 space-y-3"
                style={{ backgroundColor: "#1e2d3d" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 text-sm">💰</span>
                  <h4
                    className="text-purple-400 font-semibold text-sm"
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    {selected.status === "Paid"
                      ? "Datos de Pago"
                      : "Información Financiera"}
                  </h4>
                </div>

                <div className="space-y-2">
                  {selected.amountPaid != null && (
                    <DetailRow
                      label="Monto Pagado"
                      value={`$${selected.amountPaid.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })} ${selected.currency}`}
                    />
                  )}
                  {selected.exchangeRateUsed != null && (
                    <DetailRow
                      label="T/C Usado"
                      value={selected.exchangeRateUsed.toFixed(4)}
                    />
                  )}
                  {selected.amountMXN != null && (
                    <DetailRow
                      label="Monto en MXN"
                      value={`$${selected.amountMXN.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}`}
                      highlight
                    />
                  )}
                  {selected.bankName && (
                    <DetailRow label="Banco" value={selected.bankName} />
                  )}
                  {selected.operationRef && (
                    <DetailRow
                      label="Ref. Operación"
                      value={selected.operationRef}
                    />
                  )}
                  {selected.paymentMode && (
                    <DetailRow
                      label="Modo de Pago"
                      value={selected.paymentMode}
                    />
                  )}
                  {selected.invoiceNumber && (
                    <DetailRow
                      label="N° Factura"
                      value={selected.invoiceNumber}
                    />
                  )}
                  {selected.operationType && (
                    <DetailRow
                      label="Tipo Operación"
                      value={selected.operationType}
                    />
                  )}
                  {selected.expenseType && (
                    <DetailRow
                      label="Tipo Gasto"
                      value={selected.expenseType}
                    />
                  )}
                  {selected.ocStatus && (
                    <DetailRow label="Estatus OC" value={selected.ocStatus} />
                  )}
                  {selected.client && (
                    <DetailRow label="Cliente" value={selected.client} />
                  )}
                  {selected.serviceDelivery && (
                    <DetailRow
                      label="Prestación"
                      value={selected.serviceDelivery}
                    />
                  )}
                  {selected.proposal && (
                    <DetailRow label="Propuesta" value={selected.proposal} />
                  )}
                  {selected.invoiceLink && (
                    <DetailRow
                      label="Link Factura"
                      value={selected.invoiceLink}
                      isLink
                    />
                  )}
                  {selected.paymentProof && (
                    <DetailRow
                      label="Comprobante"
                      value={selected.paymentProof}
                      isLink
                    />
                  )}
                  {selected.financeObservations && (
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                        Observaciones de Finanzas
                      </p>
                      <p className="text-gray-300 text-xs leading-relaxed">
                        {selected.financeObservations}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rejection info (read-only) */}
            {selected.status === "Rejected" && selected.comment && (
              <div
                className="rounded-xl border border-red-800 p-4 space-y-2"
                style={{ backgroundColor: "#1e2d3d" }}
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <h4
                    className="text-red-400 font-semibold text-sm"
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    Solicitud Rechazada
                  </h4>
                </div>
                <div
                  className="rounded-lg p-3 border border-red-900"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.06)" }}
                >
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                    Motivo del rechazo
                  </p>
                  <p className="text-gray-200 text-xs leading-relaxed">
                    {selected.comment}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DetailRow: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
  isLink?: boolean;
}> = ({ label, value, highlight, isLink }) => {
  const linkHref = value.startsWith("http") ? value : "https://" + value;
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold shrink-0">
        {label}
      </span>
      {isLink ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00aa85] text-xs text-right truncate hover:underline"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Ver
        </a>
      ) : (
        <span
          className={
            highlight
              ? "text-[#00aa85] text-xs text-right font-semibold"
              : "text-gray-200 text-xs text-right"
          }
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          {value}
        </span>
      )}
    </div>
  );
};

export default RequestExplorer;
