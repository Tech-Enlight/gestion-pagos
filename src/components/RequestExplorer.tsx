import React, { useState, useMemo, useEffect } from "react";
import StatusPill from "./StatusPill";
import WorkflowTracker from "./WorkflowTracker";
import { Combobox } from "./Combobox";
import { STATUS, STATUS_LABEL, STATUS_DESC, STATUS_HEX } from "../data/mockData";
import type { Request } from "../data/mockData";
import { fetchCecoList, type NSCeco } from "../services/sheets";
import {
  Banknote,
  CalendarClock,
  Info,
  Search,
  X,
  Inbox,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  XCircle,
  PlusCircle,
} from "lucide-react";

// NetSuite CeCo names come as "Dpto_Nombre_Del_Area" — clean up for a readable label
const formatCecoName = (nombre: string): string =>
  nombre.replace(/^Dpto_/, "").replace(/_/g, " ");

// projectNumber comes as "PROJ-842 — SFV_Frialsa_Colombia_AmpliaciónII" — the table
// only has room for the short code; the full name still shows on hover.
const shortProjId = (projectNumber: string): string => {
  const m = (projectNumber || "").match(/(PROJ-\d+)/);
  return m ? m[1] : projectNumber || "—";
};

interface Props {
  requests: Request[];
  onUpdateRequest: (id: string, status: string, extra?: any) => void;
  /** "mine" = vista personal del solicitante (Mis Solicitudes); default = Explorador */
  mode?: "explorer" | "mine";
  /** Opcional: navega a Nueva Solicitud desde el estado vacío de "Mis Solicitudes". */
  onCreateRequest?: () => void;
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

type SortKey = "date" | "amount" | "status";
type SortDir = "asc" | "desc";

const RequestExplorer: React.FC<Props> = ({
  requests,
  onUpdateRequest,
  mode = "explorer",
  onCreateRequest,
}) => {
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
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = requests.filter((r) => {
      const matchSearch =
        r.beneficiary.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.projectNumber.toLowerCase().includes(q);
      const matchStatus = statusFilter === "Todos" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "status") {
        const la = STATUS_LABEL[a.status] || a.status;
        const lb = STATUS_LABEL[b.status] || b.status;
        cmp = la.localeCompare(lb);
      }
      return cmp * dir;
    });
  }, [requests, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const handleSelect = (r: Request) => {
    setSelected(r);
    setClarificationNote("");
    setEditMode(false);
    setEditErrors({});
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, r: Request) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(r);
    }
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
          style={{ fontFamily: "var(--font-primary)" }}
        >
          {isMine ? "Mis Solicitudes" : "Explorador de Solicitudes"}
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
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
          <SummaryCard label="En proceso" value={summary.inProgress} color="var(--enl-cerceta)" hint="Autorización y decisión" />
          <SummaryCard label="Pago programado" value={summary.scheduled} color={STATUS_HEX["Payment Approved"]} hint="Con fecha de pago" />
          <SummaryCard label="Pagadas" value={summary.paid} color={STATUS_HEX.Paid} hint="Pago procesado" />
          <SummaryCard label="Rechazadas" value={summary.rejected} color={STATUS_HEX.Rejected} hint="Revisa el motivo" />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "rgba(255,255,255,0.4)" }}
          />
          <input
            type="text"
            aria-label="Buscar solicitudes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por beneficiario, ID o proyecto..."
            className="w-full pl-9 pr-9 py-2 rounded-lg text-white text-sm outline-none border transition-colors"
            style={{
              backgroundColor: "var(--bg-card-dark, #1e2d3d)",
              borderColor: "var(--border-on-dark)",
              fontFamily: "var(--font-primary)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--enl-jade)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-on-dark)")}
          />
          {search && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
          role="group"
          aria-label="Filtrar por estado"
        >
          {statuses.map((s) => {
            const active = statusFilter === s;
            const accent = s === "Todos" ? "var(--enl-jade)" : STATUS_HEX[s] || "var(--enl-gris)";
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                aria-pressed={active}
                className="shrink-0 px-3.5 py-2.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-secondary)",
                  color: active ? accent : "rgba(255,255,255,0.55)",
                  borderColor: active ? accent : "var(--border-on-dark)",
                  background: active ? `color-mix(in oklab, ${accent} 14%, transparent)` : "transparent",
                }}
              >
                {s === "Todos" ? "Todos" : STATUS_LABEL[s] || s}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado
        {filtered.length !== 1 ? "s" : ""}
      </p>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card-dark, #1e2d3d)",
              border: "1px solid var(--border-on-dark)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--enl-acero)" }}>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                      ID
                    </th>
                    {isMine && (
                      <>
                        <th className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                          # PO
                        </th>
                        <th className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                          Proyecto
                        </th>
                      </>
                    )}
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Beneficiario
                    </th>
                    {isMine ? (
                      <th className="text-left px-4 py-3 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Concepto
                      </th>
                    ) : (
                      <th className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Proyecto
                      </th>
                    )}
                    <SortableHeader
                      label="Monto"
                      align="right"
                      active={sortKey === "amount"}
                      dir={sortDir}
                      onClick={() => toggleSort("amount")}
                    />
                    <SortableHeader
                      label="Estado"
                      align="center"
                      active={sortKey === "status"}
                      dir={sortDir}
                      onClick={() => toggleSort("status")}
                    />
                    {isMine && (
                      <th className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                        Pago programado
                      </th>
                    )}
                    <SortableHeader
                      label="Fecha solicitud"
                      align="left"
                      active={sortKey === "date"}
                      dir={sortDir}
                      onClick={() => toggleSort("date")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isMine ? 9 : 6} className="px-4 py-12">
                        <div className="flex flex-col items-center text-center gap-3">
                          <div
                            className="flex items-center justify-center rounded-full"
                            style={{
                              width: 48,
                              height: 48,
                              background: "rgba(255,255,255,0.05)",
                              color: "rgba(255,255,255,0.35)",
                            }}
                          >
                            <Inbox size={24} />
                          </div>
                          <p className="m-0 text-white font-medium text-sm">
                            {isMine ? "Aún no tienes solicitudes" : "No se encontraron solicitudes"}
                          </p>
                          <p className="m-0 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {isMine
                              ? "Crea tu primera solicitud de pago para empezar a darle seguimiento."
                              : "Ajusta la búsqueda o los filtros de estado."}
                          </p>
                          {isMine && onCreateRequest && (
                            <button
                              type="button"
                              onClick={onCreateRequest}
                              className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-xs font-semibold transition-colors hover:brightness-110"
                              style={{ backgroundColor: "var(--enl-jade)", fontFamily: "var(--font-primary)" }}
                            >
                              <PlusCircle size={14} />
                              Crear nueva solicitud
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => {
                    const isSelected = selected?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        tabIndex={0}
                        role="button"
                        aria-selected={isSelected}
                        onKeyDown={(e) => handleRowKeyDown(e, r)}
                        className="cursor-pointer transition-colors outline-none"
                        style={{
                          borderTop: "1px solid var(--border-on-dark)",
                          background: isSelected ? "rgba(0,170,133,0.1)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.boxShadow = "inset 0 0 0 2px var(--enl-jade)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--enl-jade)", fontWeight: isSelected ? 700 : 500 }}>
                          <span className="flex items-center gap-2">
                            {r.id}
                            {isClarification(r) && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-yellow-300 border border-yellow-600"
                                style={{ backgroundColor: "rgba(234, 179, 8, 0.12)" }}
                                title="Requiere aclaración"
                              >
                                <AlertCircle size={11} />
                                Aclaración
                              </span>
                            )}
                          </span>
                        </td>
                        {isMine && (
                          <>
                            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>
                              {r.poNumber || "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }} title={r.projectNumber}>
                              {shortProjId(r.projectNumber)}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: "rgba(255,255,255,0.75)" }} title={r.beneficiary}>
                          {r.beneficiary}
                        </td>
                        {isMine ? (
                          <td className="px-4 py-3 max-w-[220px] truncate" style={{ color: "rgba(255,255,255,0.55)" }} title={r.concept}>
                            {r.concept}
                          </td>
                        ) : (
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.55)" }} title={r.projectNumber}>
                            {shortProjId(r.projectNumber)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                          {r.amount.toLocaleString("es-MX")} {r.currency}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <StatusPill status={r.status} />
                        </td>
                        {isMine && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.estimatedPaymentDate && r.status !== "Paid" && r.status !== "Rejected" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: STATUS_HEX["Payment Approved"] }}>
                                <CalendarClock size={13} />
                                {r.estimatedPaymentDate}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {r.date}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {selected && (
          <>
            {/* Backdrop — only intercepts on narrower breakpoints, panel is inline on lg+ */}
            <div
              className="lg:hidden fixed inset-0 z-40 transition-opacity"
              style={{
                background: "rgba(0,0,0,0.6)",
                transitionDuration: "200ms",
                transitionTimingFunction: "cubic-bezier(.4,0,.2,1)",
              }}
              onClick={() => setSelected(null)}
              aria-hidden="true"
            />
            <div
              className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto p-3 space-y-3 lg:static lg:z-auto lg:w-80 xl:w-96 lg:shrink-0 lg:p-0 lg:max-w-none transition-transform"
              style={{
                background: "var(--enl-marino)",
                transitionDuration: "200ms",
                transitionTimingFunction: "cubic-bezier(.4,0,.2,1)",
              }}
            >
              {/* Estado actual en lenguaje claro (solo Mis Solicitudes) */}
              {isMine && (
                <div
                  className="rounded-xl p-4 flex gap-3"
                  style={{
                    backgroundColor: "var(--bg-card-dark, #1e2d3d)",
                    border: "1px solid var(--border-on-dark)",
                  }}
                >
                  <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--enl-jade)" }} />
                  <div>
                    <p
                      className="text-white text-sm font-semibold mb-0.5"
                      style={{ fontFamily: "var(--font-primary)" }}
                    >
                      {STATUS_LABEL[selected.status] || selected.status}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {STATUS_DESC[selected.status] || ""}
                    </p>
                    {selected.estimatedPaymentDate &&
                      selected.status !== "Paid" &&
                      selected.status !== "Rejected" && (
                        <p
                          className="text-xs font-semibold mt-2 inline-flex items-center gap-1.5"
                          style={{ color: STATUS_HEX["Payment Approved"] }}
                        >
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

              {/* Clarification Panel — highest priority: pending action */}
              {isClarification(selected) && (
                <div
                  className="rounded-xl border border-yellow-700 p-5 space-y-3 shadow-lg"
                  style={{
                    backgroundColor: "var(--bg-card-dark, #1e2d3d)",
                    boxShadow: "0 4px 18px rgba(234,179,8,0.12)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} color="#eab308" />
                    <h4
                      className="text-yellow-400 font-semibold text-sm"
                      style={{ fontFamily: "var(--font-primary)" }}
                    >
                      Aclaración Solicitada
                    </h4>
                  </div>

                  {/* Reviewer comment */}
                  <div
                    className="rounded-lg p-3 border border-yellow-800"
                    style={{ backgroundColor: "rgba(234, 179, 8, 0.06)" }}
                  >
                    <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                      Comentario del revisor
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {selected.clarificationRequest}
                    </p>
                  </div>

                  {/* Show previous response if exists */}
                  {selected.clarificationResponse && (
                    <div
                      className="rounded-lg p-3"
                      style={{ border: "1px solid var(--border-on-dark)", background: "rgba(255,255,255,0.03)" }}
                    >
                      <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Tu respuesta anterior
                      </p>
                      <p className="text-xs leading-relaxed italic" style={{ color: "rgba(255,255,255,0.65)" }}>
                        "{selected.clarificationResponse}"
                      </p>
                    </div>
                  )}

                  {/* Response textarea */}
                  <div>
                    <label
                      className="block text-[10px] uppercase tracking-wider mb-1 font-semibold"
                      htmlFor="clarification-note"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Tu respuesta / nota
                    </label>
                    <textarea
                      id="clarification-note"
                      value={clarificationNote}
                      onChange={(e) => setClarificationNote(e.target.value)}
                      placeholder="Explica las correcciones realizadas..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg text-white text-xs outline-none border transition-colors resize-none"
                      style={{
                        backgroundColor: "var(--enl-marino)",
                        borderColor: "var(--border-on-dark)",
                        fontFamily: "var(--font-primary)",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--enl-jade)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-on-dark)")}
                    />
                  </div>

                  {!editMode ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleResubmit}
                        className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-colors hover:brightness-110"
                        style={{ backgroundColor: "var(--enl-jade)", fontFamily: "var(--font-primary)" }}
                      >
                        Solo responder y reenviar
                      </button>
                      <button
                        onClick={startEdit}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors hover:text-white"
                        style={{
                          color: "rgba(255,255,255,0.8)",
                          borderColor: "var(--border-on-dark)",
                          backgroundColor: "var(--enl-marino)",
                          fontFamily: "var(--font-primary)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--enl-jade)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-on-dark)")}
                      >
                        Editar solicitud
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg p-4 space-y-3.5"
                      style={{
                        backgroundColor: "var(--enl-marino)",
                        border: "1px solid var(--border-on-dark)",
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                        Editar antes de reenviar
                      </p>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                          Concepto
                        </label>
                        <textarea
                          value={editConcept}
                          onChange={(e) => { setEditConcept(e.target.value); setEditErrors((p) => ({ ...p, concept: "" })); }}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg text-white text-xs outline-none border transition-colors resize-none"
                          style={{
                            backgroundColor: "var(--enl-acero)",
                            borderColor: editErrors.concept ? "#ef4444" : "var(--border-on-dark)",
                            fontFamily: "var(--font-primary)",
                          }}
                        />
                        {editErrors.concept && <p className="text-red-400 text-xs mt-1">{editErrors.concept}</p>}
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
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
                        <label className="block text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                          Tipo de pago
                        </label>
                        <div className="flex gap-2">
                          {(["Completo", "Parcial"] as const).map((t) => {
                            const active = editPaymentType === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => { setEditPaymentType(t); setEditErrors((p) => ({ ...p, subtotal: "" })); }}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                                style={{
                                  borderColor: active ? "var(--enl-jade)" : "var(--border-on-dark)",
                                  color: active ? "var(--enl-jade)" : "rgba(255,255,255,0.5)",
                                  background: active ? "rgba(0,170,133,0.1)" : "transparent",
                                }}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {editPaymentType === "Parcial" && (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                            Subtotal ({selected.currency})
                          </label>
                          <input
                            type="number"
                            value={editSubtotal}
                            onChange={(e) => { setEditSubtotal(e.target.value); setEditErrors((p) => ({ ...p, subtotal: "" })); }}
                            step="0.01"
                            className="w-full px-3 py-2 rounded-lg text-white text-xs outline-none border transition-colors"
                            style={{
                              backgroundColor: "var(--enl-acero)",
                              borderColor: editErrors.subtotal ? "#ef4444" : "var(--border-on-dark)",
                              fontFamily: "var(--font-primary)",
                            }}
                          />
                          {editErrors.subtotal && <p className="text-red-400 text-xs mt-1">{editErrors.subtotal}</p>}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleResubmitWithEdits}
                          className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-colors hover:brightness-110"
                          style={{ backgroundColor: "var(--enl-jade)", fontFamily: "var(--font-primary)" }}
                        >
                          Guardar cambios y reenviar
                        </button>
                        <button
                          onClick={() => { setEditMode(false); setEditErrors({}); }}
                          className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                          style={{ color: "rgba(255,255,255,0.7)", borderColor: "var(--border-on-dark)" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Finance data — read-only, compact treatment (shown when finance fields exist) */}
              {(selected.amountPaid ||
                selected.bankName ||
                selected.operationRef ||
                selected.estimatedPaymentDate ||
                selected.status === "Paid" ||
                selected.status === "Approved") && (
                  <div
                    className="rounded-lg p-3.5 space-y-2.5"
                    style={{
                      backgroundColor: "var(--bg-card-dark, #1e2d3d)",
                      border: "1px solid var(--border-on-dark)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Banknote size={13} style={{ color: "var(--enl-cerceta)" }} />
                      <h4
                        className="font-semibold text-xs uppercase tracking-wider"
                        style={{ color: "var(--enl-cerceta)", fontFamily: "var(--font-secondary)" }}
                      >
                        {selected.status === "Paid" ? "Datos de Pago" : "Información Financiera"}
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      {selected.estimatedPaymentDate && (
                        <DetailRow label="Fecha Est. Pago" value={selected.estimatedPaymentDate} />
                      )}
                      {selected.amountPaid != null && (
                        <DetailRow
                          label="Monto Pagado"
                          value={`$${selected.amountPaid.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${selected.currency}`}
                        />
                      )}
                      {selected.exchangeRateUsed != null && (
                        <DetailRow label="T/C Usado" value={selected.exchangeRateUsed.toFixed(4)} />
                      )}
                      {selected.amountMXN != null && (
                        <DetailRow
                          label="Monto en MXN"
                          value={`$${selected.amountMXN.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                          highlight
                        />
                      )}
                      {selected.bankName && <DetailRow label="Banco" value={selected.bankName} />}
                      {selected.operationRef && <DetailRow label="Ref. Operación" value={selected.operationRef} />}
                      {selected.paymentMode && <DetailRow label="Modo de Pago" value={selected.paymentMode} />}
                      {selected.invoiceNumber && <DetailRow label="N° Factura" value={selected.invoiceNumber} />}
                      {selected.operationType && <DetailRow label="Tipo Operación" value={selected.operationType} />}
                      {selected.expenseType && <DetailRow label="Tipo Gasto" value={selected.expenseType} />}
                      {selected.ocStatus && <DetailRow label="Estatus OC" value={selected.ocStatus} />}
                      {selected.client && <DetailRow label="Cliente" value={selected.client} />}
                      {selected.serviceDelivery && <DetailRow label="Prestación" value={selected.serviceDelivery} />}
                      {selected.proposal && <DetailRow label="Propuesta" value={selected.proposal} />}
                      {selected.invoiceLink && <DetailRow label="Link Factura" value={selected.invoiceLink} isLink />}
                      {selected.paymentProof && <DetailRow label="Comprobante" value={selected.paymentProof} isLink />}
                      {selected.financeObservations && (
                        <div className="pt-2" style={{ borderTop: "1px solid var(--border-on-dark)" }}>
                          <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                            Observaciones de Finanzas
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                            {selected.financeObservations}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Rejection info (read-only, compact) */}
              {selected.status === "Rejected" && selected.rejectReason && (
                <div
                  className="rounded-lg p-3.5 space-y-2"
                  style={{
                    backgroundColor: "var(--bg-card-dark, #1e2d3d)",
                    border: "1px solid rgba(239,68,68,0.35)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <XCircle size={14} color="#ef4444" />
                    <h4
                      className="font-semibold text-xs uppercase tracking-wider"
                      style={{ color: "#ef4444", fontFamily: "var(--font-secondary)" }}
                    >
                      Solicitud Rechazada
                    </h4>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(239, 68, 68, 0.06)" }}>
                    <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                      Motivo del rechazo
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {selected.rejectReason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* Header de columna ordenable */
const SortableHeader: React.FC<{
  label: string;
  align: "left" | "right" | "center";
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}> = ({ label, align, active, dir, onClick }) => (
  <th
    className={`px-4 py-3 font-semibold whitespace-nowrap select-none ${
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
    }`}
    style={{ color: "rgba(255,255,255,0.7)" }}
  >
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition-colors outline-none ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
      style={{ color: active ? "var(--enl-jade)" : "rgba(255,255,255,0.7)" }}
    >
      {label}
      {active ? (
        dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      ) : (
        <ChevronsUpDown size={13} style={{ opacity: 0.4 }} />
      )}
    </button>
  </th>
);

/* Tarjeta de resumen para Mis Solicitudes */
const SummaryCard: React.FC<{
  label: string;
  value: number;
  color: string;
  hint: string;
  active?: boolean;
}> = ({ label, value, color, hint, active }) => (
  <div
    className="rounded-xl p-3"
    style={{
      backgroundColor: "var(--bg-card-dark, #1e2d3d)",
      border: `1px solid ${active ? color : "var(--border-on-dark)"}`,
      boxShadow: active ? `0 0 12px ${color}33` : undefined,
    }}
  >
    <p
      className="text-2xl font-bold leading-none mb-1"
      style={{ color, fontFamily: "var(--font-primary)" }}
    >
      {value}
    </p>
    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-primary)" }}>
      {label}
    </p>
    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{hint}</p>
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
      <span className="text-[10px] uppercase tracking-wider font-semibold shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </span>
      {isLink ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-right truncate hover:underline"
          style={{ color: "var(--enl-jade)", fontFamily: "var(--font-primary)" }}
        >
          Ver
        </a>
      ) : (
        <span
          className="text-xs text-right"
          style={{
            color: highlight ? "var(--enl-jade)" : "rgba(255,255,255,0.8)",
            fontWeight: highlight ? 600 : 400,
            fontFamily: "var(--font-primary)",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
};

export default RequestExplorer;
