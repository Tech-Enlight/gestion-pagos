// ============================================================
// src/components/DecisionPagos.tsx
// Decisión de Pagos — orquestación (estado, carga, acciones).
// La UI vive en ./decision/*: PaymentCard, Tabs, SelectionBar, Modals, ui (primitivos).
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, X, CheckCircle2, Loader2 } from "lucide-react";
import {
  loadDecisionData,
  type DecisionData,
  type Decision,
  type VencBucket,
} from "../services/decision";
import { useAuth } from "../context/AuthContext";
import { STATUS } from "../data/mockData";
import RejectModal from "./RejectModal";
import { T } from "./decision/tokens";
import { fmtMXNk, fmtFecha, fmtPct, ratio } from "./decision/format";
import { evalDecision, defaultFilters, normOcKey, ocApproval, type Filters } from "./decision/logic";
import { MultiSelect } from "./decision/MultiSelect";
import { PaymentCard } from "./decision/PaymentCard";
import { KPICard, PillBtn } from "./decision/ui";
import { TabResumen, TabProveedores, TabClientes, TabVencimientos } from "./decision/Tabs";
import { SelectionBar } from "./decision/SelectionBar";
import { ClarifyModal, ConfirmApproveModal, SelectionModal } from "./decision/Modals";
import { downloadCSV, copyTSV } from "./decision/csv";

// ─── TABS ────────────────────────────────────────────────────
type Tab = "lista" | "resumen" | "proveedores" | "clientes" | "vencimientos";

// ─── Main component ──────────────────────────────────────────
interface DecisionPagosProps {
  onUpdateRequest?: (id: string, status: string, extra?: any) => Promise<void>;
  onUpdateRequestBulk?: (ids: string[], status: string, extra?: any) => Promise<void>;
}

const DecisionPagos: React.FC<DecisionPagosProps> = ({ onUpdateRequest, onUpdateRequestBulk }) => {
  const { user } = useAuth();
  // Aquí decide el admin; el analista contable solo consulta (su flujo vive en Finanzas)
  const canDecide = !!onUpdateRequest && (user?.role === "admin" || user?.role === "superadmin");

  const [data, setData] = useState<DecisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cruceLoading, setCruceLoading] = useState(false);
  // true solo cuando OC y pronóstico ya cruzaron. Si el cruce falla queda en false y
  // Aprobar se mantiene bloqueado: sin ese dato todo cae en "Revisar" por falta de información.
  const [crossReady, setCrossReady] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("lista");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);
  const [clarifyIds, setClarifyIds] = useState<string[] | null>(null);
  const [approveIds, setApproveIds] = useState<string[] | null>(null);

  // `force` salta la caché del cruce OC/pronóstico (solo el botón Actualizar y Reintentar);
  // el resto de las cargas reutiliza lo que ya se trajo y solo pide pagos-data.
  const load = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) { setLoading(true); setError(null); }
    try {
      // En carga visible los pagos se pintan apenas llegan; el cruce OC/pronóstico
      // (NetSuite, lento) completa después. En refresco silencioso no se usa el
      // parcial para no degradar momentáneamente las decisiones ya calculadas.
      const d = await loadDecisionData({
        force: opts?.force,
        onPartial: silent ? undefined : (partial) => {
          setData(partial);
          setCruceLoading(true);
          setCrossReady(false);
          setLoading(false);
        },
      });
      setData(d);
      setCrossReady(true);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
      setCruceLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresco silencioso periódico para que la vista nunca se quede con datos viejos
  useEffect(() => {
    // Sin sentido pedir datos (y pegarle a NetSuite) si nadie está mirando la pestaña.
    const t = setInterval(() => { if (!document.hidden) load({ silent: true }); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // ── Decisiones (aprobar / rechazar) ────────────────────────
  const applyStatus = useCallback(async (ids: string[], status: string, extra?: any) => {
    if (!onUpdateRequest || ids.length === 0) return;
    setActionBusy(true);
    try {
      // Un solo llamado al webhook para todo el lote: n8n manda un digest por
      // destinatario en vez de un correo por solicitud (evita el spam de N
      // correos en decisiones masivas).
      if (onUpdateRequestBulk) {
        await onUpdateRequestBulk(ids, status, extra);
      } else {
        for (const id of ids) await onUpdateRequest(id, status, extra);
      }
      setActionMsg(`✓ ${ids.length} solicitud${ids.length !== 1 ? "es" : ""} → ${status}`);
      setSelected((prev) => { const n = new Set(prev); ids.forEach((i) => n.delete(i)); return n; });
      await load({ silent: true });
    } catch (e: any) {
      setError(e.message || "Error al actualizar el estatus");
    } finally {
      setActionBusy(false);
    }
  }, [onUpdateRequest, onUpdateRequestBulk, load]);

  // Los avisos se limpian solos; el efecto cancela el temporizador si el componente se desmonta.
  useEffect(() => {
    if (!actionMsg) return;
    const t = setTimeout(() => setActionMsg(null), 3000);
    return () => clearTimeout(t);
  }, [actionMsg]);
  useEffect(() => {
    if (!copyFeedback) return;
    const t = setTimeout(() => setCopyFeedback(false), 1800);
    return () => clearTimeout(t);
  }, [copyFeedback]);

  // Un solo paso de decisión: directo a Payment Approved (bandeja del analista).
  // Un pago individual se aprueba directo; en lote se confirma antes (cuántos y por cuánto).
  const handleApproveIds = useCallback((ids: string[]) => {
    if (!crossReady) return;
    if (ids.length > 1) setApproveIds(ids);
    else applyStatus(ids, STATUS.PAYMENT_APPROVED);
  }, [crossReady, applyStatus]);
  // Callbacks por tarjeta estables: PaymentCard está en React.memo y una función nueva por render lo anularía.
  const handleApproveOne = useCallback((pg: { id: string }) => handleApproveIds([pg.id]), [handleApproveIds]);
  const handleClarifyOne = useCallback((pg: { id: string }) => setClarifyIds([pg.id]), []);
  const handleRejectOne = useCallback((pg: { id: string }) => setRejectIds([pg.id]), []);
  const handleToggleExpand = useCallback((id: string) => setExpandedId((prev) => (prev === id ? null : id)), []);
  const handleApproveConfirm = () => {
    const ids = approveIds || [];
    setApproveIds(null);
    applyStatus(ids, STATUS.PAYMENT_APPROVED);
  };
  const handleRejectConfirm = (comment: string) => {
    const ids = rejectIds || [];
    setRejectIds(null);
    applyStatus(ids, STATUS.REJECTED, { rejectReason: comment });
  };
  const handleClarifyConfirm = (comment: string) => {
    const ids = clarifyIds || [];
    setClarifyIds(null);
    applyStatus(ids, STATUS.DRAFT, { clarificationRequest: comment });
  };

  // Memoized decision map
  const decisionMap = useMemo(() => {
    if (!data) return new Map<string, Decision>();
    const m = new Map<string, Decision>();
    data.pagos.forEach((p) => m.set(p.id, evalDecision(p, data.oc_data, data.forecast_data)));
    return m;
  }, [data]);

  // Computed option sets for multi-selects
  const options = useMemo(() => {
    if (!data) return { ops: [], bancos: [], clientes: [], provs: [], counts: {} as Record<string, Record<string, number>> };
    const ops = [...new Set(data.pagos.map((p) => p.operacion_cat).filter(Boolean))].sort();
    const bancos = [...new Set(data.pagos.map((p) => p.banco).filter(Boolean))].sort();
    const clientes = [...new Set(data.pagos.map((p) => p.cliente || "Sin cliente"))].sort();
    const provs = [...new Set(data.pagos.map((p) => p.benef_clean).filter(Boolean))].sort();

    const countBy = (key: "operacion_cat" | "banco" | "benef_clean") =>
      data.pagos.reduce((m, p) => { const v = p[key]; if (v) m[v] = (m[v] || 0) + 1; return m; }, {} as Record<string, number>);
    const countCliente = data.pagos.reduce((m, p) => { const v = p.cliente || "Sin cliente"; m[v] = (m[v] || 0) + 1; return m; }, {} as Record<string, number>);

    return { ops, bancos, clientes, provs, counts: { op: countBy("operacion_cat"), banco: countBy("banco"), prov: countBy("benef_clean"), cliente: countCliente } };
  }, [data]);

  // Decision counts for filter chips
  const decisionCounts = useMemo(() => {
    if (!data) return { verde: 0, rojo: 0, amarillo: 0 };
    const c = { verde: 0, rojo: 0, amarillo: 0 };
    data.pagos.forEach((p) => { c[decisionMap.get(p.id)!.color]++; });
    return c;
  }, [data, decisionMap]);

  // Filtered + sorted list
  const filteredPagos = useMemo(() => {
    if (!data) return [];
    const q = filters.search.toLowerCase().trim();

    let rows = data.pagos.filter((p) => {
      if (filters.decision) {
        const dec = decisionMap.get(p.id);
        if (!dec || dec.color !== filters.decision) return false;
      }
      if (filters.oc) {
        const key = normOcKey(p.oc);
        const oc = key ? data.oc_data[key] : null;
        const state = oc ? ocApproval(oc).state : null;
        if (filters.oc === "aprobada" && state !== "aprobada") return false;
        if (filters.oc === "rechazada" && state !== "rechazada") return false;
        // "Pendiente" agrupa todo lo que existe pero no está aprobada ni rechazada de forma clara.
        if (filters.oc === "pendiente" && (!oc || state === "aprobada" || state === "rechazada")) return false;
        if (filters.oc === "sin" && oc) return false;
      }
      if (filters.propuesta.size > 0 && !filters.propuesta.has(p.propuesta_bucket)) return false;
      if (filters.venc.size > 0) {
        const allowed = new Set<string>();
        if (filters.venc.has("vencido")) allowed.add("vencido");
        if (filters.venc.has("semana")) { allowed.add("vencido"); allowed.add("hoy"); allowed.add("semana"); }
        if (filters.venc.has("prox")) { allowed.add("vencido"); allowed.add("hoy"); allowed.add("semana"); allowed.add("prox"); }
        if (!allowed.has(p.venc_bucket)) return false;
      }
      if (filters.op.size > 0 && !filters.op.has(p.operacion_cat)) return false;
      if (filters.banco.size > 0 && !filters.banco.has(p.banco)) return false;
      if (filters.cliente.size > 0 && !filters.cliente.has(p.cliente || "Sin cliente")) return false;
      if (filters.prov.size > 0 && !filters.prov.has(p.benef_clean)) return false;
      if (q) {
        const hay = [p.oc, p.beneficiario, p.benef_clean, p.proyecto, p.factura, p.concepto, p.tipo_op, p.cliente, p.solicitante]
          .map((s) => String(s || "").toLowerCase()).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filters.sortBy === "urgencia") {
      const urgOrder: Record<VencBucket, number> = { vencido: 0, hoy: 1, semana: 2, prox: 3, futuro: 4, sin_fecha: 5 };
      rows.sort((a, b) => {
        const ua = urgOrder[a.venc_bucket], ub = urgOrder[b.venc_bucket];
        return ua !== ub ? ua - ub : b.total_mxn - a.total_mxn;
      });
    } else {
      rows.sort((a, b) => b.total_mxn - a.total_mxn);
    }

    return rows;
  }, [data, filters, decisionMap]);

  const visibleIds = useMemo(() => new Set(filteredPagos.map((p) => p.id)), [filteredPagos]);

  // Resumen del lote a aprobar para el diálogo de confirmación.
  const approveSummary = useMemo(() => {
    const sel = (data?.pagos || []).filter((p) => (approveIds || []).includes(p.id));
    return {
      totalMxn: sel.reduce((s, p) => s + p.total_mxn, 0),
      notProceed: sel.filter((p) => decisionMap.get(p.id)?.color !== "verde").length,
      sinTc: sel.filter((p) => p.sin_tc).length,
      hidden: sel.filter((p) => !visibleIds.has(p.id)).length,
    };
  }, [data, approveIds, decisionMap, visibleIds]);

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const clearFilters = () => { setFilters(defaultFilters()); };

  const toggleSelect = useCallback((id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);

  const selectAllVisible = () =>
    setSelected((prev) => { const n = new Set(prev); filteredPagos.forEach((p) => n.add(p.id)); return n; });

  const unselectAllVisible = () =>
    setSelected((prev) => { const n = new Set(prev); filteredPagos.forEach((p) => n.delete(p.id)); return n; });

  const getSelectedPagos = () => (data?.pagos || []).filter((p) => selected.has(p.id));

  const handleExportCSV = () => downloadCSV(getSelectedPagos());
  const handleCopy = async () => {
    await copyTSV(getSelectedPagos());
    setCopyFeedback(true);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "lista", label: `Lista (${filteredPagos.length})` },
    { id: "resumen", label: "Resumen" },
    { id: "proveedores", label: `Proveedores (${options.provs.length})` },
    { id: "clientes", label: `Clientes (${options.clientes.length})` },
    { id: "vencimientos", label: "Vencimientos" },
  ];

  if (loading) return (
    <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
      <div className="dp-spin" style={{ width: 32, height: 32, border: `3px solid ${T.cardBorder}`, borderTopColor: T.jade, borderRadius: "50%" }} />
      Cargando datos…
    </div>
  );

  if (error && !data) return (
    <div role="alert" style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ color: T.red, fontSize: 14, fontFamily: T.fontAlt, marginBottom: 16 }}>{error}</div>
      <button type="button" className="dp-barbtn dp-barbtn--primary" onClick={() => load({ force: true })} style={{ padding: "8px 20px", fontSize: 13 }}>Reintentar</button>
    </div>
  );

  if (!data) return null;
  const { kpis, meta } = data;

  return (
    // El padding inferior deja libre el espacio de la barra de selección flotante (puede ocupar 2 líneas).
    <div style={{ fontFamily: T.font, color: T.text, paddingBottom: 140 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>Decisión de Pagos</h1>
          <div style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, marginTop: 4 }}>
            {meta.fecha_corte && <>Corte {fmtFecha(meta.fecha_corte)} · </>}
            Hoy {fmtFecha(meta.fecha_hoy)} · {kpis.n_total} solicitudes
            {lastUpdated && <> · Actualizado {lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</>}
            {meta.cross_at && <> · OC y pronóstico de las {new Date(meta.cross_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {cruceLoading && (
            <span role="status" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.amber, fontFamily: T.fontAlt }}>
              <Loader2 className="dp-spin" size={12} aria-hidden />
              Cruzando OC / pronóstico…
            </span>
          )}
          <button type="button" className="dp-barbtn" onClick={() => load({ force: true })} disabled={loading || actionBusy}>
            <RefreshCw size={13} aria-hidden /> Actualizar
          </button>
        </div>
      </div>

      {/* Error no bloqueante (los datos ya cargados se conservan) */}
      {error && (
        <div role="alert" style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 14px",
          background: T.redFaint, border: `1px solid ${T.red}40`, borderRadius: 6,
          fontSize: 12, color: T.red, fontFamily: T.fontAlt,
        }}>
          {error}
          <button type="button" className="dp-icon-btn" aria-label="Cerrar aviso" onClick={() => setError(null)} style={{ marginLeft: "auto", color: T.red }}><X size={13} aria-hidden /></button>
        </div>
      )}

      {/* El cruce no se completó (falló o sigue pendiente tras un error): Aprobar queda bloqueado */}
      {!crossReady && !cruceLoading && (
        <div role="status" style={{
          marginBottom: 14, padding: "8px 14px", background: T.amberFaint, border: `1px solid ${T.amber}50`,
          borderRadius: 6, fontSize: 12, color: T.text, fontFamily: T.fontAlt,
        }}>
          El cruce con OC y pronóstico no se completó, así que <strong>Aprobar está deshabilitado</strong>. Usa Actualizar para reintentar.
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <KPICard label="Total general" value={fmtMXNk(kpis.total_general)} sub={`${kpis.n_total} pagos`} />
        <KPICard label="Propuesta" value={fmtMXNk(kpis.total_propuesta)} sub={`${kpis.n_propuesta} pagos · ${fmtPct(ratio(kpis.total_propuesta, kpis.total_general))}`} accentColor={T.jade} />
        <KPICard label="Aplazado" value={fmtMXNk(kpis.total_aplazado)} sub={`${kpis.n_aplazado} pagos · ${fmtPct(ratio(kpis.total_aplazado, kpis.total_general))}`} accentColor={T.steel} />
        <KPICard label="Vencido" value={fmtMXNk(kpis.total_vencido)} sub={`${kpis.n_vencido} solicitudes`} accentColor={T.red} />
        <KPICard label="En ≤ 7 días" value={fmtMXNk(kpis.total_semana)} sub={`${kpis.n_semana} solicitudes`} accentColor={T.amber} />
      </div>

      {/* Tab navigation */}
      <div role="tablist" aria-label="Secciones de Decisión de Pagos" style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${T.cardBorder}`, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.id} type="button" role="tab" className="dp-tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* ── Lista tab ── */}
      {activeTab === "lista" && data.pagos.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 20px", fontFamily: T.fontAlt }}>
          <CheckCircle2 size={32} color={T.jade} aria-hidden />
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.font, marginTop: 12 }}>Estás al día</div>
          <div style={{ fontSize: 13, color: T.textSub, marginTop: 4 }}>
            No hay solicitudes esperando tu decisión. Aparecerán aquí cuando Dirección las autorice.
          </div>
        </div>
      )}

      {activeTab === "lista" && data.pagos.length > 0 && (
        <div>
          {/* Decision filter chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <PillBtn label={`Todos (${kpis.n_total})`} active={!filters.decision} onClick={() => setFilter("decision", "")} />
            <PillBtn label={`✓ Procede (${decisionCounts.verde})`} active={filters.decision === "verde"} onClick={() => setFilter("decision", filters.decision === "verde" ? "" : "verde")} color={T.jade} />
            <PillBtn label={`✗ Bloquear (${decisionCounts.rojo})`} active={filters.decision === "rojo"} onClick={() => setFilter("decision", filters.decision === "rojo" ? "" : "rojo")} color={T.red} />
            <PillBtn label={`⚠ Revisar (${decisionCounts.amarillo})`} active={filters.decision === "amarillo"} onClick={() => setFilter("decision", filters.decision === "amarillo" ? "" : "amarillo")} color={T.amber} />
          </div>

          {/* Filter bar */}
          <div style={{
            background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8,
            padding: "12px 14px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
          }}>
            {/* Propuesta pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>Propuesta</span>
              {["Propuesta", "Aplazado"].map((v) => (
                <PillBtn key={v} label={v} active={filters.propuesta.has(v)}
                  onClick={() => { const n = new Set(filters.propuesta); n.has(v) ? n.delete(v) : n.add(v); setFilter("propuesta", n); }}
                  color={v === "Propuesta" ? T.jade : T.steel}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Vence pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>Vence</span>
              {[{ v: "vencido", l: "Vencido", c: T.red }, { v: "semana", l: "≤ 7d", c: T.amber }, { v: "prox", l: "≤ 14d", c: T.textSub }].map(({ v, l, c }) => (
                <PillBtn key={v} label={l} active={filters.venc.has(v)}
                  onClick={() => { const n = new Set(filters.venc); n.has(v) ? n.delete(v) : n.add(v); setFilter("venc", n); }}
                  color={c}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* OC pills */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>OC</span>
              {[{ v: "aprobada", l: "Aprobada" }, { v: "pendiente", l: "Pendiente" }, { v: "rechazada", l: "Rechazada" }, { v: "sin", l: "Sin OC" }].map(({ v, l }) => (
                <PillBtn key={v} label={l} active={filters.oc === v}
                  onClick={() => setFilter("oc", filters.oc === v ? "" : v as any)}
                  color={v === "aprobada" ? T.jade : v === "rechazada" ? T.red : T.textSub}
                />
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Multi-selects */}
            <MultiSelect label="Operación" options={options.ops} selected={filters.op} counts={options.counts.op} onChange={(s) => setFilter("op", s)} />
            <MultiSelect label="Banco" options={options.bancos} selected={filters.banco} counts={options.counts.banco} onChange={(s) => setFilter("banco", s)} />
            <MultiSelect label="Cliente" options={options.clientes} selected={filters.cliente} counts={options.counts.cliente} onChange={(s) => setFilter("cliente", s)} />
            <MultiSelect label="Proveedor" options={options.provs} selected={filters.prov} counts={options.counts.prov} onChange={(s) => setFilter("prov", s)} />

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Sort */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>Orden</span>
              <PillBtn label="Mayor monto" active={filters.sortBy === "monto"} onClick={() => setFilter("sortBy", "monto")} />
              <PillBtn label="Urgencia" active={filters.sortBy === "urgencia"} onClick={() => setFilter("sortBy", "urgencia")} />
            </div>

            <div style={{ width: 1, height: 20, background: T.cardBorder }} />

            {/* Bulk selection */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button type="button" className="dp-barbtn" onClick={selectAllVisible} style={{ padding: "5px 10px", fontSize: 11, color: T.jade, background: T.jadeFaint }}>Seleccionar visibles</button>
              <button type="button" className="dp-barbtn" onClick={unselectAllVisible} style={{ padding: "5px 10px", fontSize: 11, background: "transparent", border: `1px solid ${T.cardBorder}` }}>Quitar visibles</button>
            </div>

            <div style={{ marginLeft: "auto" }}>
              <button type="button" className="dp-barbtn" onClick={clearFilters} style={{ padding: "5px 12px", fontSize: 11, background: "transparent", border: `1px solid ${T.cardBorder}` }}>Limpiar filtros</button>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              aria-label="Buscar pagos" placeholder="Buscar OC, proveedor, proyecto, factura, concepto…" className="dp-input"
              style={{
                width: "100%", padding: "9px 14px", border: `1px solid ${T.cardBorder}`,
                borderRadius: 6, background: T.cardBg, color: T.text, fontSize: 13,
                fontFamily: T.fontAlt, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Payment list */}
          {filteredPagos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: T.textMuted, fontFamily: T.fontAlt, fontSize: 14 }}>
              No hay solicitudes que coincidan con los filtros.
            </div>
          ) : (
            filteredPagos.map((p) => (
              <PaymentCard
                key={p.id}
                p={p}
                decision={decisionMap.get(p.id)!}
                selected={selected.has(p.id)}
                expanded={expandedId === p.id}
                ocData={data.oc_data}
                fcData={data.forecast_data}
                onToggleSelect={toggleSelect}
                onToggleExpand={handleToggleExpand}
                canDecide={canDecide}
                actionBusy={actionBusy}
                crossReady={crossReady}
                onApprove={handleApproveOne}
                onClarify={handleClarifyOne}
                onReject={handleRejectOne}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "resumen" && <TabResumen data={data} />}
      {activeTab === "proveedores" && <TabProveedores data={data} />}
      {activeTab === "clientes" && <TabClientes data={data} />}
      {activeTab === "vencimientos" && <TabVencimientos data={data} />}

      {/* Selection bar */}
      <SelectionBar
        selected={selected}
        pagos={data.pagos}
        onClear={() => setSelected(new Set())}
        onViewSelected={() => setShowModal(true)}
        onExportCSV={handleExportCSV}
        onCopyClipboard={handleCopy}
        canDecide={canDecide}
        actionBusy={actionBusy}
        crossReady={crossReady}
        visibleIds={visibleIds}
        onApproveIds={handleApproveIds}
        onClarifyIds={(ids) => setClarifyIds(ids)}
        onRejectIds={(ids) => setRejectIds(ids)}
      />

      {/* Copy feedback toast */}
      {copyFeedback && (
        <div role="status" style={{
          position: "fixed", top: 64, right: 20, background: T.jade, color: "#000",
          padding: "8px 16px", borderRadius: 6, fontFamily: T.font, fontSize: 12, fontWeight: 600, zIndex: 400,
        }}>
          ✓ Copiado al portapapeles
        </div>
      )}

      {/* Action feedback toast */}
      {actionMsg && (
        <div role="status" style={{
          position: "fixed", top: 20, right: 20, background: T.jade, color: "#000",
          padding: "8px 16px", borderRadius: 6, fontFamily: T.font, fontSize: 12, fontWeight: 600, zIndex: 400,
        }}>
          {actionMsg}
        </div>
      )}

      {/* Confirmación de aprobación en lote */}
      {approveIds && (
        <ConfirmApproveModal
          count={approveIds.length}
          totalMxn={approveSummary.totalMxn}
          notProceed={approveSummary.notProceed}
          sinTc={approveSummary.sinTc}
          hidden={approveSummary.hidden}
          onConfirm={handleApproveConfirm}
          onCancel={() => setApproveIds(null)}
        />
      )}

      {/* Reject modal (individual o masivo) */}
      {rejectIds && (
        <RejectModal
          requestId={rejectIds.length === 1 ? rejectIds[0] : `${rejectIds.length} solicitudes`}
          onConfirm={(_id, comment) => handleRejectConfirm(comment)}
          onCancel={() => setRejectIds(null)}
        />
      )}

      {/* Clarify modal (individual o masivo) */}
      {clarifyIds && (
        <ClarifyModal
          label={clarifyIds.length === 1 ? clarifyIds[0] : `${clarifyIds.length} solicitudes`}
          onConfirm={handleClarifyConfirm}
          onCancel={() => setClarifyIds(null)}
        />
      )}

      {/* Selection modal */}
      {showModal && (
        <SelectionModal
          selected={selected}
          pagos={data.pagos}
          onClose={() => setShowModal(false)}
          onExportCSV={handleExportCSV}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
};

export default DecisionPagos;
