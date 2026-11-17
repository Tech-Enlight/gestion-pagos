import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CalendarClock, CheckCircle2, Loader2, RefreshCw, ShieldCheck, TriangleAlert, X, DollarSign } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { enviarEventosPropuesta, fetchPropuestas } from "../../services/sheets";
import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";
import type { Propuesta } from "../../types/propuestas";
import { ActionBtn, BarBtn, Chip, KPICard, StatItem } from "../decision/ui";
import { NUM, T } from "../decision/tokens";
import { fmtFecha } from "../decision/format";
import { money } from "../approvals/helpers";
import { ReportarProblemaModal, ReprogramarModal } from "./Modals";
import { agrupar, diasHasta, fechaPago, mxnOf, pagadoEstaSemana } from "./logic";
import type { NsEstado } from "./logic";
import { useNsReadiness } from "./useNsReadiness";
import "../planeacion/planeacion.css";
import "./ejecucion.css";

interface Props {
  /** Todas las solicitudes (también las pagadas: alimentan "Pagado esta semana"). */
  requests: Request[];
  rate: number;
  rateDate: string;
  /** Selección y cruce con NetSuite: viven en FinanceManagement y no se duplican aquí. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  busy: boolean;
  nsLoading: boolean;
  claimedPaymentIds: Set<string>;
  onMarkPaid: (r: Request) => void;
  onBulkMarkPaid: () => void;
  onUpdateRequest: (id: string, status: string, extra?: Record<string, unknown>) => void;
  onUpdateFinanceFields: (id: string, fields: Partial<Request>) => void | Promise<void>;
  onReloadRequests?: () => void;
}

const mxn = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// Chip de lectura previa de NetSuite: qué atender antes de abrir "Marcar Pagado"
function NsChip({ e }: { e?: NsEstado }) {
  if (!e) return <Chip label="NetSuite sin verificar" color={T.textMuted} bg="rgba(255,255,255,0.06)" />;
  switch (e.tipo) {
    case "listo": return <Chip label="Listo en NetSuite" color={T.jade} bg={T.jadeFaint} title={e.pago ? `Pago ${e.pago.payment_tranid ?? e.pago.payment_id}` : undefined} />;
    case "distinto": {
      const d = e.diffPct;
      return <Chip label={`Monto distinto${d != null ? ` ${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}%` : ""}`} color={T.amber} bg={T.amberFaint} title="El pago en NetSuite no coincide con lo solicitado (¿retención?). Se confirma al marcar pagado." />;
    }
    case "sin_pago": return <Chip label="Sin pago en NetSuite" color={T.amber} bg={T.amberFaint} title="Registra el pago en NetSuite antes de marcar como pagado." />;
    case "usado": return <Chip label="Pago ya usado" color={T.red} bg={T.redFaint} title="Los pagos de NetSuite de esta OC ya están asignados a otras solicitudes." />;
    case "sin_oc": return <Chip label="Sin OC en NetSuite" color={T.textMuted} bg="rgba(255,255,255,0.06)" />;
    default: return <Chip label="No se pudo verificar" color={T.textMuted} bg="rgba(255,255,255,0.06)" title="Reintenta con «Verificar NetSuite»." />;
  }
}

function FechaTexto({ r }: { r: Request }) {
  const iso = fechaPago(r);
  const d = diasHasta(iso);
  if (!iso || d === null) return <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>Sin fecha programada</span>;
  const color = d < 0 ? T.red : d <= 1 ? T.amber : T.textMuted;
  const rel = d < 0 ? `venció hace ${-d} ${-d === 1 ? "día" : "días"}` : d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`;
  return <span style={{ fontSize: 11, fontWeight: 500, color, fontFamily: T.fontAlt }}>Pago {fmtFecha(iso)} · {rel}</span>;
}

const EjecucionPagos: React.FC<Props> = ({
  requests, rate, rateDate, selectedId, onSelect, selectedIds, setSelectedIds, busy, nsLoading, claimedPaymentIds,
  onMarkPaid, onBulkMarkPaid, onUpdateRequest, onUpdateFinanceFields, onReloadRequests,
}) => {
  const { user } = useAuth();
  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [modal, setModal] = useState<{ tipo: "reprogramar" | "problema"; req: Request } | null>(null);
  const [nota, setNota] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const flash = (text: string, error = false) => {
    setNotice({ text, error });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), error ? 9000 : 6000);
  };

  const cargarPropuestas = useCallback(() => {
    fetchPropuestas().then(setPropuestas).catch(() => { /* sin propuestas: se opera con la fecha de la solicitud */ });
  }, []);
  useEffect(() => { cargarPropuestas(); }, [cargarPropuestas]);

  const pendientes = useMemo(() => requests.filter((r) => r.status === STATUS.PAYMENT_APPROVED), [requests]);
  const grupos = useMemo(() => agrupar(pendientes, rate), [pendientes, rate]);
  const selected = pendientes.find((r) => r.id === selectedId) ?? null;
  const propDe = useMemo(() => {
    const m = new Map<string, Propuesta>();
    for (const p of propuestas) if (p.estado === "Aprobada") for (const it of p.items) m.set(it.requestId, p);
    return m;
  }, [propuestas]);

  // ── NetSuite: automático para lo vencido y lo de hoy (tope 25); el resto bajo demanda ──
  const ns = useNsReadiness(claimedPaymentIds);
  const auto = useMemo(() => grupos.filter((g) => g.id === "vencidos" || g.id === "hoy").flatMap((g) => g.items).slice(0, 25), [grupos]);
  // check() ignora lo ya consultado, así que re-ejecutar con una lista nueva (misma o distinta) es barato
  const checkNs = ns.check;
  useEffect(() => { void checkNs(auto); }, [auto, checkNs]);

  // ── Indicadores ──
  const hoy = grupos.find((g) => g.id === "hoy");
  const vencidos = grupos.find((g) => g.id === "vencidos");
  const prox = grupos.filter((g) => g.id === "manana" || g.id === "semana");
  const proxN = prox.reduce((s, g) => s + g.items.length, 0);
  const proxMxn = prox.reduce((s, g) => s + g.totalMxn, 0);
  const pagado = useMemo(() => pagadoEstaSemana(requests, rate), [requests, rate]);
  const totalMxn = grupos.reduce((s, g) => s + g.totalMxn, 0);

  // ── Selección ──
  const sel = pendientes.filter((r) => selectedIds.includes(r.id));
  const toggle = (id: string) => setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const toggleGrupo = (ids: string[]) => {
    const todos = ids.every((id) => selectedIds.includes(id));
    setSelectedIds(todos ? selectedIds.filter((x) => !ids.includes(x)) : [...new Set([...selectedIds, ...ids])]);
  };

  // ── Acciones propias de Ejecución ──
  const run = async (fn: () => Promise<void>, ok: string) => {
    setWorking(true);
    try {
      await fn();
      setModal(null);
      flash(ok);
      cargarPropuestas();
      onReloadRequests?.();
    } catch (e) {
      flash(e instanceof Error ? e.message : "No se pudo completar la acción.", true);
    } finally {
      setWorking(false);
    }
  };

  const reprogramar = (r: Request, fecha: string, motivo: string) => run(async () => {
    const p = propDe.get(r.id);
    // Con propuesta: n8n registra el evento y actualiza la solicitud (y avisa al solicitante) en un solo paso.
    // Sin propuesta (pago aprobado por la vía anterior): se actualiza la fecha directo.
    if (p && actor) await enviarEventosPropuesta(actor, p.id, [{ evento: "reprogramar", requestId: r.id, fechaProgramada: fecha, nota: motivo }]);
    else await onUpdateFinanceFields(r.id, { estimatedPaymentDate: fecha, financeObservations: motivo });
  }, `${r.id} reprogramado para el ${fmtFecha(fecha)}.`);

  const reportar = (r: Request, destino: "solicitante" | "aplazar", motivo: string) => run(async () => {
    const p = propDe.get(r.id);
    if (p && actor) await enviarEventosPropuesta(actor, p.id, [{ evento: "excluir", requestId: r.id, destino, nota: motivo }]);
    else if (destino === "solicitante") await onUpdateRequest(r.id, STATUS.DRAFT, { clarificationRequest: motivo });
    else await onUpdateRequest(r.id, STATUS.SOLICITADA, { comment: motivo });
    onSelect(null);
  }, destino === "solicitante" ? `${r.id} enviado al solicitante para corregir.` : `${r.id} aplazado: vuelve a Planeación.`);

  const guardarNota = () => {
    if (!selected || !nota.trim()) return;
    void run(async () => { await onUpdateFinanceFields(selected.id, { financeObservations: nota.trim() }); setNota(""); }, "Nota guardada.");
  };

  return (
    <div style={{ display: "grid", gap: 16, paddingBottom: sel.length > 0 ? 96 : 0 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 700, fontFamily: T.font }}>Ejecución de pagos</h2>
          <p style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: T.textSub, fontFamily: T.fontAlt }}>
            {pendientes.length === 0 ? <span>No hay pagos aprobados por ejecutar</span> : (
              <>
                <span>{pendientes.length} {plural(pendientes.length, "pago aprobado", "pagos aprobados")} por ejecutar</span>
                <span aria-hidden style={{ color: T.textMuted }}>·</span>
                <span style={{ ...NUM, color: T.text, fontWeight: 600 }}>≈ {mxn(totalMxn)} MXN</span>
              </>
            )}
          </p>
        </div>
        <div title="Tipo de cambio de referencia para los totales en pesos" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.cardBorder}`, fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>
          <DollarSign size={12} color={T.jade} aria-hidden />
          T/C Banxico <strong style={{ ...NUM, color: T.text }}>${rate.toFixed(4)}</strong> <span style={{ color: T.textMuted }}>({rateDate})</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KPICard label="Por pagar hoy" value={String(hoy?.items.length ?? 0)} sub={hoy ? `≈ ${mxn(hoy.totalMxn)} MXN` : "Nada programado hoy"} />
        <KPICard label="Vencidos" value={String(vencidos?.items.length ?? 0)} sub={vencidos ? `≈ ${mxn(vencidos.totalMxn)} MXN` : "Al corriente"} accentColor={vencidos ? T.red : T.jade} />
        <KPICard label="Próximos 7 días" value={String(proxN)} sub={proxN ? `≈ ${mxn(proxMxn)} MXN` : "—"} accentColor={T.text} />
        <KPICard label="Pagado esta semana" value={String(pagado.count)} sub={pagado.count ? `≈ ${mxn(pagado.totalMxn)} MXN` : "Aún nada"} accentColor={T.textSub} />
      </div>

      <div role="status" aria-live="polite">
        {notice && (
          <div role={notice.error ? "alert" : undefined} style={{ padding: "10px 14px", borderRadius: 8, background: notice.error ? T.redFaint : T.jadeFaint, border: `1px solid ${(notice.error ? T.red : T.jade)}40`, color: T.text, fontSize: 13, fontFamily: T.fontAlt }}>
            {notice.text}
          </div>
        )}
      </div>

      {pendientes.length === 0 ? (
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <ShieldCheck size={28} color={T.textMuted} aria-hidden />
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.font }}>Todo está al día</div>
          <p style={{ margin: "6px auto 0", maxWidth: 440, fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>
            Los pagos aparecen aquí cuando se aprueba una propuesta en Planeación, agrupados por la fecha en que toca pagarlos.
          </p>
        </div>
      ) : (
        <div className="pl-layout">
          <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
            {grupos.map((g) => {
              const ids = g.items.map((r) => r.id);
              const sinVerificar = g.items.filter((r) => !ns.estado[r.id]);
              const todos = ids.every((id) => selectedIds.includes(id));
              return (
                <section key={g.id} aria-label={g.label} style={{ background: T.cardBg, border: `1px solid ${g.id === "vencidos" ? `${T.red}55` : T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
                  <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: g.id === "vencidos" ? T.red : T.text, fontFamily: T.font }}>{g.label}</h3>
                    <span style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>{g.items.length} {plural(g.items.length, "pago", "pagos")} · <span style={{ ...NUM }}>≈ {mxn(g.totalMxn)} MXN</span></span>
                    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                      {sinVerificar.length > 0 && (
                        <BarBtn label="Verificar NetSuite" icon={ns.checking ? <Loader2 size={13} className="dp-spin" aria-hidden /> : <RefreshCw size={13} aria-hidden />} onClick={() => void ns.check(sinVerificar)} />
                      )}
                      <BarBtn label={todos ? "Quitar selección" : "Seleccionar grupo"} onClick={() => toggleGrupo(ids)} />
                    </span>
                  </header>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {g.items.map((r) => {
                      const on = selectedIds.includes(r.id);
                      const open = selectedId === r.id;
                      return (
                        <li key={r.id} className="pl-row" data-checked={on} data-open={open} onClick={() => onSelect(open ? null : r.id)}>
                          <input type="checkbox" className="pl-check" aria-label={`Seleccionar ${r.id}`} checked={on} disabled={busy} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} />
                          <button type="button" className="ej-rowbtn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onSelect(open ? null : r.id); }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub, fontFamily: T.fontAlt }}>{r.id}</span>
                              <NsChip e={ns.estado[r.id]} />
                            </span>
                            <span style={{ display: "block", marginTop: 2, fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.font, overflowWrap: "anywhere" }}>{r.beneficiary}</span>
                            <span style={{ display: "block", marginTop: 2, fontSize: 12, color: T.textMuted, fontFamily: T.font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.concept}</span>
                          </button>
                          <div style={{ ...NUM, fontSize: 14, fontWeight: 700, color: T.text, textAlign: "right", whiteSpace: "nowrap" }}>
                            {money(r.amount)}
                            <div style={{ fontSize: 11, fontWeight: 500, color: T.textMuted }}>{r.currency}</div>
                          </div>
                          <div className="pl-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <FechaTexto r={r} />
                            <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}> · {[r.projectNumber, r.submittedBy].filter(Boolean).join(" · ")}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <div>
            {selected ? (
              <section className="pl-panel" aria-label={`Detalle de ${selected.id}`} style={{ background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
                <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.fontAlt }}>{selected.id}</span>
                  <Chip label="Pago aprobado" color={T.jade} bg={T.jadeFaint} />
                  {propDe.get(selected.id) && <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{propDe.get(selected.id)!.nombre}</span>}
                  <button type="button" className="dp-icon-btn" onClick={() => onSelect(null)} aria-label="Cerrar detalle" style={{ marginLeft: "auto" }}><X size={18} aria-hidden /></button>
                </header>
                <div style={{ padding: "16px 16px 8px" }}>
                  <div style={{ ...NUM, fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                    {money(selected.amount)} <span style={{ fontSize: 14, fontWeight: 600, color: T.textSub }}>{selected.currency}</span>
                  </div>
                  {selected.currency === "USD" && <div style={{ ...NUM, marginTop: 2, fontSize: 12, color: T.textMuted }}>≈ {mxn(mxnOf(selected, rate))} MXN</div>}
                  <div style={{ marginTop: 6, fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.font, overflowWrap: "anywhere" }}>{selected.beneficiary}</div>
                  <div style={{ marginTop: 4 }}><FechaTexto r={selected} /></div>
                </div>
                <dl style={{ margin: 0, padding: "8px 16px 14px", display: "grid", gap: 12 }}>
                  {[["Concepto", selected.concept], ["Proyecto / Depto.", selected.projectNumber], ["OC", selected.poNumber], ["Solicitante", selected.submittedBy]].map(([k, v]) => v ? (
                    <div key={k}>
                      <dt style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, fontWeight: 500, marginBottom: 2 }}>{k}</dt>
                      <dd style={{ margin: 0, fontSize: 13, color: T.text, fontFamily: T.font, lineHeight: 1.45, overflowWrap: "anywhere" }}>{v}</dd>
                    </div>
                  ) : null)}
                </dl>

                <div style={{ padding: "0 16px 14px" }}>
                  <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, fontWeight: 500, marginBottom: 6 }}>NetSuite</div>
                  <NsChip e={ns.estado[selected.id]} />
                  {ns.estado[selected.id]?.pago && (
                    <div style={{ ...NUM, marginTop: 6, fontSize: 12, color: T.textSub }}>
                      {ns.estado[selected.id]!.pago!.payment_tranid ?? ns.estado[selected.id]!.pago!.payment_id} · {money(ns.estado[selected.id]!.pago!.payment_amount ?? 0)} {ns.estado[selected.id]!.pago!.currency}
                    </div>
                  )}
                </div>

                <div style={{ padding: "0 16px 14px" }}>
                  <label htmlFor="ej-nota" style={{ display: "block", fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, fontWeight: 500, marginBottom: 4 }}>Nota de Finanzas</label>
                  {typeof selected.financeObservations === "string" && selected.financeObservations && (
                    <div style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, marginBottom: 6, overflowWrap: "anywhere" }}>Última: {selected.financeObservations}</div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id="ej-nota" type="text" className="dp-input" value={nota} maxLength={300} placeholder="Añadir nota…" onChange={(e) => setNota(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") guardarNota(); }}
                      style={{ flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 6, background: T.ink, color: T.text, fontSize: 12, fontFamily: T.fontAlt, border: `1px solid ${T.cardBorder}`, outline: "none" }} />
                    <BarBtn label="Guardar" onClick={guardarNota} />
                  </div>
                </div>

                <footer style={{ display: "grid", gap: 8, padding: 16, borderTop: `1px solid ${T.cardBorder}` }}>
                  <ActionBtn solid large label={nsLoading ? "Consultando NetSuite…" : "Marcar pagado"} color={T.jade} icon={nsLoading ? <Loader2 size={15} className="dp-spin" /> : <Banknote size={15} />} disabled={busy || nsLoading || working} onClick={() => onMarkPaid(selected)} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <ActionBtn large label="Reprogramar" color={T.text} icon={<CalendarClock size={15} />} disabled={busy || working} onClick={() => setModal({ tipo: "reprogramar", req: selected })} />
                    <ActionBtn large label="Reportar problema" color={T.amber} icon={<TriangleAlert size={15} />} disabled={busy || working} onClick={() => setModal({ tipo: "problema", req: selected })} />
                  </div>
                </footer>
              </section>
            ) : (
              <div className="pl-panel" style={{ border: `1px dashed ${T.cardBorder}`, borderRadius: 12, padding: "28px 20px", color: T.textSub, fontFamily: T.fontAlt, fontSize: 13, lineHeight: 1.6 }}>
                <CheckCircle2 size={22} color={T.textMuted} aria-hidden />
                <div style={{ margin: "8px 0 6px", fontWeight: 700, color: T.text, fontFamily: T.font }}>Elige un pago</div>
                Verás su detalle y el estado en NetSuite. Marca varios con la casilla para registrarlos juntos con «Marcar pagadas».
              </div>
            )}
          </div>
        </div>
      )}

      {sel.length > 0 && (
        <div className="dp-selbar" role="region" aria-label="Pagos seleccionados">
          <div style={{ display: "flex", gap: "8px 20px", flexWrap: "wrap" }}>
            <StatItem label="Seleccionados" value={`${sel.length} ${plural(sel.length, "pago", "pagos")}`} />
            <StatItem label="Suma aprox." value={`${mxn(sel.reduce((s, r) => s + mxnOf(r, rate), 0))} MXN`} mono />
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
            <ActionBtn solid large label={nsLoading ? "Consultando NetSuite…" : `Marcar pagadas (${sel.length})`} color={T.jade} icon={nsLoading ? <Loader2 size={15} className="dp-spin" /> : <Banknote size={15} />} disabled={busy || nsLoading} onClick={onBulkMarkPaid} />
            <BarBtn label="" ariaLabel="Limpiar selección" onClick={() => setSelectedIds([])} icon={<X size={14} aria-hidden />} />
          </div>
        </div>
      )}

      {modal?.tipo === "reprogramar" && <ReprogramarModal req={modal.req} busy={working} onConfirm={(f, n) => void reprogramar(modal.req, f, n)} onCancel={() => setModal(null)} />}
      {modal?.tipo === "problema" && <ReportarProblemaModal req={modal.req} enPropuesta={propDe.has(modal.req.id)} busy={working} onConfirm={(d, n) => void reportar(modal.req, d, n)} onCancel={() => setModal(null)} />}
    </div>
  );
};

export default EjecucionPagos;
