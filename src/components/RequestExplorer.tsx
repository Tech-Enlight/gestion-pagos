import React, { useState, useMemo, useEffect } from "react";
import StatusPill from "./StatusPill";
import WorkflowTracker from "./WorkflowTracker";
import { Combobox } from "./Combobox";
import { STATUS, STATUS_LABEL, STATUS_DESC } from "../data/mockData";
import type { Request } from "../data/mockData";
import { fetchCecoList, type NSCeco } from "../services/sheets";
import { Banknote, CalendarClock, Info } from "lucide-react";

// NetSuite CeCo names come as "Dpto_Nombre_Del_Area" — clean up for a readable label
const formatCecoName = (nombre: string): string =>
  nombre.replace(/^Dpto_/, "").replace(/_/g, " ");

interface Props {
  requests: Request[];
  onUpdateRequest: (id: string, status: string, extra?: any) => void;
  /** "mine" = vista personal del solicitante (Mis Solicitudes); default = Explorador */
  mode?: "explorer" | "mine";
}

const statuses = [
  "Todos",
  "Draft",
  "Autorización",
  "Pending Fin",
  "Approved",
  "Payment Approved",
  "Paid",
  "Rejected",
];

// Estados "vivos" — la solicitud sigue avanzando en el flujo
const IN_PROGRESS = ["Autorización", "Pending Fin", "Approved", "Payment Approved"];

const isClarification = (r: Request): boolean =>
  r.status === "Draft" && !!r.clarificationRequest;

const RequestExplorer: React.FC<Props> = ({ requests, onUpdateRequest, mode = "explorer" }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selected, setSelected] = useState<Request | null>(null);
  const [clarificationNote, setClarificationNote] = useState("");
  // "Editar solicitud" path on aclaración — lets the requester correct
  // concept/department/amount before resending, instead of only replying.
  const [editMode, setEditMode] = useState(false);
  const [editConcept, setEditConcept] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPaymentType, setEditPaymentType] = useState<"Completo" | "Parcial">("Completo");
  const [editSubtotal, setEditSubtotal] = useState("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [cecoList, setCecoList] = useState<NSCeco[]>([]);
  const isMine = mode === "mine";

  useEffect(() => {
    let cancelled = false;
    fetchCecoList()
      .then((list) => {
        if (!cancelled) setCecoList(list);
      })
      .catch((err) => console.error(err));
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const needsAction = requests.filter(isClarification).length;
    const inProgress = requests.filter((r) => IN_PROGRESS.includes(r.status)).length;
    const scheduled = requests.filter(
      (r) => r.estimatedPaymentDate && r.status !== "Paid" && r.status !== "Rejected"
    ).length;
    const paid = requests.filter((r) => r.status === "Paid").length;
    const rejected = requests.filter((r) => r.status === "Rejected").length;
    return { needsAction, inProgress, scheduled, paid, rejected };
  }, [requests]);

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
    setEditMode(false);
    setEditErrors({});
  };

  const handleResubmit = () => {
    if (!selected) return;
    const note = clarificationNote.trim();
    onUpdateRequest(selected.id, STATUS.AUTORIZACION, { clarificationResponse: note || undefined });
    setSelected(null);
    setClarificationNote("");
  };

  const startEdit = () => {
    if (!selected) return;
    setEditConcept(selected.concept);
    setEditDepartment(selected.department);
    setEditPaymentType((selected.paymentType as "Completo" | "Parcial") || "Completo");
    setEditSubtotal(selected.paymentType === "Parcial" ? selected.subtotal.toString() : "");
    setEditErrors({});
    setEditMode(true);
  };

  const handleResubmitWithEdits = () => {
    if (!selected) return;
    const eErr: Record<string, string> = {};
    if (!editConcept.trim()) eErr.concept = "Concepto requerido";
    if (!editDepartment.trim()) eErr.department = "Departamento requerido";

    const ocTotal = selected.ocTotal ?? selected.amount;
    let subtotal = 0;
    let iva = 0;
    let amount = 0;
    if (editPaymentType === "Completo") {
      subtotal = +(ocTotal / 1.16).toFixed(2);
      iva = +(ocTotal - subtotal).toFixed(2);
      amount = ocTotal;
    } else {
      const v = Number(editSubtotal);
      if (!editSubtotal || v <= 0) {
        eErr.subtotal = "Subtotal válido requerido";
      } else if (v > ocTotal) {
        eErr.subtotal = `No puede exceder el total de la OC ($${ocTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })})`;
      }
      subtotal = v || 0;
      iva = +(subtotal * 0.16).toFixed(2);
      amount = +(subtotal + iva).toFixed(2);
    }

    if (Object.keys(eErr).length > 0) {
      setEditErrors(eErr);
      return;
    }

    const note = clarificationNote.trim();
    onUpdateRequest(selected.id, STATUS.AUTORIZACION, {
      clarificationResponse: note || undefined,
      concept: editConcept.trim(),
      department: editDepartment.trim(),
      paymentType: editPaymentType,
      subtotal,
      iva,
      amount,
    });
    setSelected(null);
    setClarificationNote("");
    setEditMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2
          className="text-white text-2xl font-bold mb-1"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          {isMine ? "Mis Solicitudes" : "Explorador de Solicitudes"}
        </h2>
        <p className="text-gray-400 text-sm">
          {isMine
            ? "Da seguimiento a tus solicitudes de pago: en qué paso van, quién las tiene y cuándo se pagan."
            : "Busca y filtra el historial completo de solicitudes de pago."}
        </p>
      </div>

      {/* Resumen personal (solo en Mis Solicitudes) */}
      {isMine && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryCard
            label="Requieren tu acción"
            value={summary.needsAction}
            color="#eab308"
            hint="Aclaraciones pendientes"
            active={summary.needsAction > 0}
          />
          <SummaryCard label="En proceso" value={summary.inProgress} color="#3D7D80" hint="Autorización y decisión" />
          <SummaryCard label="Pago programado" value={summary.scheduled} color="#2563eb" hint="Con fecha de pago" />
          <SummaryCard label="Pagadas" value={summary.paid} color="#a855f7" hint="Pago procesado" />
          <SummaryCard label="Rechazadas" value={summary.rejected} color="#ef4444" hint="Revisa el motivo" />
        </div>
      )}

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
              {s === "Todos" ? "Todos" : STATUS_LABEL[s] || s}
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
                  {isMine ? (
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                      Concepto
                    </th>
                  ) : (
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                      Proyecto
                    </th>
                  )}
                  <th className="text-right px-4 py-3 text-gray-300 font-semibold">
                    Monto
                  </th>
                  <th className="text-center px-4 py-3 text-gray-300 font-semibold">
                    Estado
                  </th>
                  {isMine && (
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                      Pago programado
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={isMine ? 7 : 6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      {isMine
                        ? "Aún no tienes solicitudes. Crea una desde Nueva solicitud."
                        : "No se encontraron solicitudes"}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className={`border-t border-gray-700 cursor-pointer transition-colors ${selected?.id === r.id
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
                    <td className="px-4 py-3 text-gray-400 max-w-[220px] truncate" title={isMine ? r.concept : r.projectNumber}>
                      {isMine ? r.concept : r.projectNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-right">
                      {r.amount.toLocaleString("es-MX")} {r.currency}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={r.status} />
                    </td>
                    {isMine && (
                      <td className="px-4 py-3">
                        {r.estimatedPaymentDate && r.status !== "Paid" && r.status !== "Rejected" ? (
                          <span className="inline-flex items-center gap-1.5 text-[#60a5fa] text-xs font-semibold">
                            <CalendarClock size={13} />
                            {r.estimatedPaymentDate}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                    )}
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
            {/* Estado actual en lenguaje claro (solo Mis Solicitudes) */}
            {isMine && (
              <div
                className="rounded-xl border border-gray-700 p-4 flex gap-3"
                style={{ backgroundColor: "#1e2d3d" }}
              >
                <Info size={16} className="text-[#00aa85] shrink-0 mt-0.5" />
                <div>
                  <p
                    className="text-white text-sm font-semibold mb-0.5"
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    {STATUS_LABEL[selected.status] || selected.status}
                  </p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    {STATUS_DESC[selected.status] || ""}
                  </p>
                  {selected.estimatedPaymentDate &&
                    selected.status !== "Paid" &&
                    selected.status !== "Rejected" && (
                      <p className="text-[#60a5fa] text-xs font-semibold mt-2 inline-flex items-center gap-1.5">
                        <CalendarClock size={13} />
                        Pago programado para el {selected.estimatedPaymentDate}
                      </p>
                    )}
                </div>
              </div>
            )}

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
                    {selected.clarificationRequest}
                  </p>
                </div>

                {/* Show previous response if exists */}
                {selected.clarificationResponse && (
                  <div
                    className="rounded-lg p-3 border border-gray-700 bg-gray-800/20"
                  >
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                      Tu respuesta anterior
                    </p>
                    <p className="text-gray-300 text-xs leading-relaxed italic">
                      "{selected.clarificationResponse}"
                    </p>
                  </div>
                )}

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

                {!editMode ? (
                  <>
                    {/* Two options: just answer, or edit the request first */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleResubmit}
                        className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-colors hover:brightness-110"
                        style={{
                          backgroundColor: "#00aa85",
                          fontFamily: "Alexandria, sans-serif",
                        }}
                      >
                        Solo responder y reenviar
                      </button>
                      <button
                        onClick={startEdit}
                        className="flex-1 py-2 rounded-lg text-gray-200 text-sm font-semibold border border-gray-600 hover:border-[#00aa85] hover:text-white transition-colors"
                        style={{
                          backgroundColor: "#162430",
                          fontFamily: "Alexandria, sans-serif",
                        }}
                      >
                        Editar solicitud
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-gray-700 p-3 space-y-3" style={{ backgroundColor: "#162430" }}>
                    <p className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">
                      Editar antes de reenviar
                    </p>

                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                        Concepto
                      </label>
                      <textarea
                        value={editConcept}
                        onChange={(e) => { setEditConcept(e.target.value); setEditErrors((p) => ({ ...p, concept: "" })); }}
                        rows={2}
                        className={`w-full px-3 py-2 rounded-lg text-white text-xs outline-none border transition-colors resize-none ${editErrors.concept ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"}`}
                        style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                      />
                      {editErrors.concept && <p className="text-red-400 text-xs mt-1">{editErrors.concept}</p>}
                    </div>

                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                        Departamento
                      </label>
                      <Combobox
                        options={cecoList.map((c) => ({
                          value: formatCecoName(c.nombre),
                          label: formatCecoName(c.nombre),
                          badge: c.code,
                        }))}
                        value={editDepartment}
                        onChange={(v) => { setEditDepartment(v); setEditErrors((p) => ({ ...p, department: "" })); }}
                        placeholder="Seleccionar departamento..."
                        emptyMessage="No se encontraron departamentos."
                        hasError={!!editErrors.department}
                      />
                      {editErrors.department && <p className="text-red-400 text-xs mt-1">{editErrors.department}</p>}
                    </div>

                    <div>
                      <label className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                        Tipo de pago
                      </label>
                      <div className="flex gap-2">
                        {(["Completo", "Parcial"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setEditPaymentType(t); setEditErrors((p) => ({ ...p, subtotal: "" })); }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${editPaymentType === t
                                ? "border-[#00aa85] text-[#00aa85] bg-[#00aa85]/10"
                                : "border-gray-600 text-gray-400 hover:border-gray-400"
                              }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {editPaymentType === "Parcial" && (
                      <div>
                        <label className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                          Subtotal ({selected.currency})
                        </label>
                        <input
                          type="number"
                          value={editSubtotal}
                          onChange={(e) => { setEditSubtotal(e.target.value); setEditErrors((p) => ({ ...p, subtotal: "" })); }}
                          step="0.01"
                          className={`w-full px-3 py-2 rounded-lg text-white text-xs outline-none border transition-colors ${editErrors.subtotal ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"}`}
                          style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                        />
                        {editErrors.subtotal && <p className="text-red-400 text-xs mt-1">{editErrors.subtotal}</p>}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleResubmitWithEdits}
                        className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-colors hover:brightness-110"
                        style={{ backgroundColor: "#00aa85", fontFamily: "Alexandria, sans-serif" }}
                      >
                        Guardar cambios y reenviar
                      </button>
                      <button
                        onClick={() => { setEditMode(false); setEditErrors({}); }}
                        className="px-4 py-2 rounded-lg text-gray-300 text-sm font-medium border border-gray-600 hover:border-gray-400 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Finance data (shown when finance fields exist) */}
            {(selected.amountPaid ||
              selected.bankName ||
              selected.operationRef ||
              selected.estimatedPaymentDate ||
              selected.status === "Paid" ||
              selected.status === "Approved") && (
                <div
                  className="rounded-xl border border-gray-700 p-4 space-y-3"
                  style={{ backgroundColor: "#1e2d3d" }}
                >
                  <div className="flex items-center gap-2">
                    <Banknote size={14} className="text-purple-400" />
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
                    {selected.estimatedPaymentDate && (
                      <DetailRow
                        label="Fecha Est. Pago"
                        value={selected.estimatedPaymentDate}
                      />
                    )}
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
            {selected.status === "Rejected" && selected.rejectReason && (
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
                    {selected.rejectReason}
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

/* Tarjeta de resumen para Mis Solicitudes */
const SummaryCard: React.FC<{
  label: string;
  value: number;
  color: string;
  hint: string;
  active?: boolean;
}> = ({ label, value, color, hint, active }) => (
  <div
    className="rounded-xl border p-3"
    style={{
      backgroundColor: "#1e2d3d",
      borderColor: active ? color : "rgba(255,255,255,0.08)",
      boxShadow: active ? `0 0 12px ${color}33` : undefined,
    }}
  >
    <p
      className="text-2xl font-bold leading-none mb-1"
      style={{ color, fontFamily: "Alexandria, sans-serif" }}
    >
      {value}
    </p>
    <p className="text-gray-200 text-xs font-semibold" style={{ fontFamily: "Alexandria, sans-serif" }}>
      {label}
    </p>
    <p className="text-gray-500 text-[10px] mt-0.5">{hint}</p>
  </div>
);

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
