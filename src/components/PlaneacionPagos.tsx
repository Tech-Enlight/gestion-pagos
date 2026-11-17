import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, CheckCircle2, Loader2, Plus, RefreshCw, Search, Send, Trash2, Undo2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { enviarEventosPropuesta, fetchPropuestas } from "../services/sheets";
import { STATUS_LABEL } from "../data/mockData";
import type { Request } from "../data/mockData";
import type { Propuesta, PropuestaEvento } from "../types/propuestas";
import { ActionBtn, BarBtn, Chip, StatItem } from "./decision/ui";
import { T, NUM } from "./decision/tokens";
import { fmtFecha } from "./decision/format";
import { STALE_DAYS, money, totalsText, waitingDays, waitingLabel, waitingSince } from "./approvals/helpers";
import { PropuestaPanel } from "./planeacion/PropuestaPanel";
import { ConfirmModal, DevolverModal, NuevaPropuestaModal } from "./planeacion/Modals";
import { candidatesOf, capsFor, esperaA, isActive, isOpen, pendientesDeSync } from "./planeacion/logic";
import { totalsByCurrency } from "./approvals/helpers";
import { useDecisionContext } from "./planeacion/useDecisionContext";
import { VeredictoChip, VencTexto } from "./planeacion/Contexto";
import "./planeacion/planeacion.css";

interface Props {
  requests: Request[];
  /** Refresca las solicitudes de la app (tras aprobar, sus estados cambian en la hoja). */
  onReloadRequests?: () => void;
}

type Confirm = "enviar" | "retirar" | "cancelar" | "aprobar" | null;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const PlaneacionPagos: React.FC<Props> = ({ requests, onReloadRequests }) => {
  const { user } = useAuth();
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [checked, setChecked] = useState<string[]>([]);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [orden, setOrden] = useState<"antiguedad" | "vencimiento">("antiguedad");
  // Vencimiento, monto en MXN y veredicto (Procede/Revisar/Bloquear) de Decisión de Pagos
  const ctx = useDecisionContext();
  const noticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const load = useCallback(async () => {
    try {
      setPropuestas(await fetchPropuestas());
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);
  // Carga inicial: los setState ocurren en el callback de la promesa (no en el cuerpo del efecto)
  useEffect(() => {
    let alive = true;
    fetchPropuestas()
      .then((d) => { if (alive) { setPropuestas(d); setLoadState("ready"); } })
      .catch(() => { if (alive) setLoadState("error"); });
    return () => { alive = false; };
  }, []);

  const flash = (text: string, error = false) => {
    setNotice({ text, error });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), error ? 9000 : 6000);
  };

  // ── Derivados ──
  const visibles = useMemo(() => propuestas.filter(isActive), [propuestas]);
  // Por defecto: la que espera acción de este rol (aprobador) o, si no hay, la de Borrador más reciente (Finanzas)
  const current = useMemo(
    () => visibles.find((p) => p.id === selId) ?? visibles.find((p) => esperaA(user?.role, p)) ?? visibles.find((p) => p.estado === "Borrador") ?? visibles[0] ?? null,
    [visibles, selId, user?.role]
  );
  const caps = capsFor(user?.role, current?.estado);
  const canCreate = capsFor(user?.role, undefined).planner;
  const editable = caps.editar;
  const requestsById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);

  const candidates = useMemo(
    () => candidatesOf(requests, propuestas).sort((a, b) => {
      if (orden === "vencimiento") {
        // Lo que vence antes primero; las que no tienen fecha (o aún no cargan) al final
        const da = ctx.byId.get(a.id)?.pago.venc_dias ?? Number.POSITIVE_INFINITY;
        const db = ctx.byId.get(b.id)?.pago.venc_dias ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da < db ? -1 : 1;
      }
      return waitingSince(a) - waitingSince(b);
    }),
    [requests, propuestas, orden, ctx.byId]
  );
  const [now] = useState(() => Date.now());

  const q = query.trim().toLowerCase();
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of candidates) m.set(r.status, (m.get(r.status) || 0) + 1);
    return m;
  }, [candidates]);
  const visible = useMemo(
    () => candidates.filter((r) =>
      (statusFilter === "all" || r.status === statusFilter) &&
      (!q || [r.id, r.beneficiary, r.projectNumber, r.concept, r.poNumber, r.submittedBy, r.department].some((v) => (v || "").toLowerCase().includes(q)))),
    [candidates, statusFilter, q]
  );

  // Solo cuentan las marcadas que siguen disponibles (otra pestaña pudo haberlas tomado)
  const sel = candidates.filter((r) => checked.includes(r.id));
  const allVisibleChecked = visible.length > 0 && visible.every((r) => checked.includes(r.id));
  const hiddenChecked = sel.filter((r) => !visible.some((v) => v.id === r.id)).length;
  const inProposal = propuestas.filter(isActive).reduce((n, p) => n + p.items.filter((it) => requestsById.get(it.requestId) && isOpen(requestsById.get(it.requestId)!)).length, 0);

  // ── Acciones ──
  const actor = user ? { email: user.email, name: user.name, role: user.role } : null;

  const run = async (eventos: PropuestaEvento[], okMsg: string, propuestaId: string | null): Promise<string | null> => {
    if (!actor) return null;
    setBusy(true);
    try {
      const r = await enviarEventosPropuesta(actor, propuestaId, eventos);
      await load();
      flash(okMsg);
      return r.propuestaId;
    } catch (e) {
      // El servidor rechaza con mensaje legible (solicitud ya tomada, propuesta ya enviada…): se muestra y se resincroniza
      flash(e instanceof Error ? e.message : "No se pudo guardar el cambio.", true);
      await load();
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (nombre: string, fechaCorte: string) => {
    const id = await run([{ evento: "crear", nombre, fechaCorte }], `Propuesta «${nombre}» creada.`, null);
    if (id) { setSelId(id); setNuevaOpen(false); }
  };

  const handleAdd = async () => {
    if (!current || !editable || sel.length === 0) return;
    const ids = sel.map((r) => r.id);
    const id = await run(
      ids.map((requestId) => ({ evento: "agregar" as const, requestId, fechaProgramada: current.fechaCorte })),
      `${ids.length} ${plural(ids.length, "solicitud agregada", "solicitudes agregadas")} a «${current.nombre}».`,
      current.id
    );
    if (id) setChecked([]);
  };

  const handleRemove = (requestId: string) => {
    if (!current) return;
    void run([{ evento: "quitar", requestId }], `${requestId} regresó a las solicitudes abiertas.`, current.id);
  };

  const handleDate = (requestId: string, fecha: string) => {
    if (!current) return;
    // Optimista: el campo de fecha no debe esperar el viaje a n8n; si falla, load() restaura el valor real
    setPropuestas((prev) => prev.map((p) => p.id !== current.id ? p : { ...p, items: p.items.map((it) => it.requestId === requestId ? { ...it, fechaProgramada: fecha } : it) }));
    void run([{ evento: "fecha", requestId, fechaProgramada: fecha }], `Fecha de ${requestId} actualizada.`, current.id);
  };

  const handleMeta = async (mxn: number | null) => {
    if (!current) return;
    await run([{ evento: "meta", mxn }], mxn == null ? "Meta quitada." : "Meta de total actualizada.", current.id);
  };

  const handleDevolver = async (nota: string) => {
    if (!current) return;
    setDevolverOpen(false);
    await run([{ evento: "devolver", nota }], `«${current.nombre}» devuelta a Finanzas.`, current.id);
  };

  const handleSync = async () => {
    if (!current) return;
    const r = await run([{ evento: "sincronizar" }], `Pagos de «${current.nombre}» sincronizados con Finanzas.`, current.id);
    if (r) onReloadRequests?.();
  };

  const handleConfirm = async () => {
    if (!current || !confirm) return;
    const kind = confirm;
    setConfirm(null);
    // Los totales viajan para que el correo de Nivel 1 diga cuánto es (el servidor no conoce los montos)
    if (kind === "enviar") await run([{ evento: "enviar", datos: JSON.stringify({ pagos: currentItems.length, totales: totalsByCurrency(currentItems) }) }], `«${current.nombre}» enviada a aprobación de Nivel 1.`, current.id);
    if (kind === "retirar") await run([{ evento: "retirar" }], `«${current.nombre}» retirada: vuelve a Borrador.`, current.id);
    if (kind === "aprobar") {
      const final = current.estado === "Nivel 2";
      // Resumen de lo que se aprueba, para auditoría (el servidor solo lo guarda)
      const datos = JSON.stringify({ pagos: currentItems.length, totales: totalsByCurrency(currentItems) });
      const r = await run([{ evento: "aprobar", datos }], final ? `«${current.nombre}» aprobada: los pagos quedan listos en Finanzas.` : `«${current.nombre}» aprobada en Nivel 1; pasa a Nivel 2.`, current.id);
      if (r && final) onReloadRequests?.();
    }
    if (kind === "cancelar") { await run([{ evento: "cancelar" }], `«${current.nombre}» cancelada; sus solicitudes quedaron libres.`, current.id); setSelId(null); }
  };

  const toggle = (id: string) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => {
    const ids = visible.map((r) => r.id);
    setChecked((prev) => (allVisibleChecked ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  };

  const syncPendientes = useMemo(() => (current ? pendientesDeSync(current, requestsById) : []), [current, requestsById]);
  const currentItems = current ? current.items.map((it) => requestsById.get(it.requestId)).filter((r): r is Request => !!r && isOpen(r)) : [];

  return (
    <div style={{ display: "grid", gap: 16, paddingBottom: sel.length > 0 ? 96 : 0 }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 700, fontFamily: T.font }}>Planeación de pagos</h2>
          <p style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: T.textSub, fontFamily: T.fontAlt }}>
            <span>{candidates.length} {plural(candidates.length, "solicitud abierta", "solicitudes abiertas")} sin programar</span>
            {candidates.length > 0 && (<><span aria-hidden style={{ color: T.textMuted }}>·</span><span style={{ ...NUM, color: T.text, fontWeight: 600 }}>{totalsText(candidates)}</span></>)}
            {inProposal > 0 && (<><span aria-hidden style={{ color: T.textMuted }}>·</span><span>{inProposal} en propuestas</span></>)}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {busy && (
            <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: T.jade, fontFamily: T.fontAlt }}>
              <Loader2 size={14} className="dp-spin" aria-hidden /> Guardando…
            </span>
          )}
          {visibles.length > 0 && (
            <>
              <label htmlFor="pl-propuesta" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Propuesta</label>
              <select id="pl-propuesta" className="pl-select" value={current?.id ?? ""} onChange={(e) => setSelId(e.target.value)} disabled={busy}>
                {visibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.estado} · {p.items.length}</option>)}
              </select>
            </>
          )}
          {canCreate && <ActionBtn large solid={visibles.length === 0} label="Nueva propuesta" color={T.jade} icon={<Plus size={15} />} onClick={() => setNuevaOpen(true)} disabled={busy} />}
        </div>
      </div>

      {/* Aviso de la última acción (también para lector de pantalla) */}
      <div role="status" aria-live="polite">
        {notice && (
          <div role={notice.error ? "alert" : undefined} style={{ padding: "10px 14px", borderRadius: 8, background: notice.error ? T.redFaint : T.jadeFaint, border: `1px solid ${(notice.error ? T.red : T.jade)}40`, color: T.text, fontSize: 13, fontFamily: T.fontAlt }}>
            {notice.text}
          </div>
        )}
      </div>

      {loadState === "error" && (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 8, background: T.redFaint, border: `1px solid ${T.red}40`, color: T.text, fontSize: 13, fontFamily: T.fontAlt }}>
          No se pudieron cargar las propuestas.
          <BarBtn label="Reintentar" icon={<RefreshCw size={13} aria-hidden />} onClick={() => { setLoadState("loading"); void load(); }} />
        </div>
      )}

      {ctx.error && !ctx.loading && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>
          No se pudo cargar el veredicto ni el vencimiento (Decisión de Pagos). Puedes planear sin ellos.
          <BarBtn label="Reintentar" icon={<RefreshCw size={13} aria-hidden />} onClick={ctx.reload} />
        </div>
      )}

      <div className="pl-layout">
        {/* Solicitudes abiertas */}
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: `1px solid ${T.cardBorder}`, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, cursor: "pointer" }}>
              <input type="checkbox" className="pl-check" checked={allVisibleChecked} onChange={toggleAll} disabled={busy || visible.length === 0} />
              Seleccionar {q || statusFilter !== "all" ? "las visibles" : "todas"}
            </label>
            <label htmlFor="pl-orden" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Ordenar solicitudes</label>
            <select id="pl-orden" className="pl-select" value={orden} onChange={(e) => setOrden(e.target.value as "antiguedad" | "vencimiento")} style={{ marginLeft: "auto" }}>
              <option value="antiguedad">Más antiguas primero</option>
              <option value="vencimiento">Por vencimiento</option>
            </select>
            <div style={{ position: "relative", flex: "0 1 240px", minWidth: 180 }}>
              <Search size={14} aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
              <input type="search" className="dp-input" aria-label="Buscar por ID, beneficiario, proyecto, concepto o solicitante" placeholder="Buscar solicitud…" value={query} onChange={(e) => setQuery(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 30px", borderRadius: 6, background: T.ink, color: T.text, fontSize: 12, fontFamily: T.fontAlt, border: `1px solid ${T.cardBorder}`, outline: "none" }} />
            </div>
          </div>
          {statusCounts.size > 1 && (
            <div role="group" aria-label="Filtrar por etapa" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
              <button type="button" className="dp-pill" aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Todas ({candidates.length})</button>
              {[...statusCounts.entries()].map(([s, n]) => (
                <button key={s} type="button" className="dp-pill" aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>{STATUS_LABEL[s] || s} ({n})</button>
              ))}
            </div>
          )}

          {candidates.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: T.fontAlt }}>
              <CheckCircle2 size={26} color={T.textMuted} aria-hidden />
              <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.font }}>Todo está programado</div>
              <p style={{ margin: "6px auto 0", maxWidth: 380, fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>No hay solicitudes abiertas fuera de una propuesta. Las nuevas aparecerán aquí en cuanto se envíen.</p>
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: T.textSub, fontFamily: T.fontAlt }}>
              Ninguna solicitud coincide con los filtros.{" "}
              <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }} style={{ background: "none", border: "none", padding: 0, color: T.jade, fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline", cursor: "pointer" }}>Limpiar filtros</button>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {visible.map((r) => {
                const days = waitingDays(r, now);
                const stale = days >= STALE_DAYS;
                const on = checked.includes(r.id);
                return (
                  <li key={r.id} className="pl-row" data-checked={on} onClick={() => toggle(r.id)}>
                    <input type="checkbox" className="pl-check" aria-label={`Seleccionar ${r.id}`} checked={on} disabled={busy} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub, fontFamily: T.fontAlt }}>{r.id}</span>
                        <Chip label={STATUS_LABEL[r.status] || r.status} color={T.textSub} bg="rgba(255,255,255,0.07)" />
                        {stale
                          ? <Chip label={waitingLabel(days)} color={T.amber} bg={T.amberFaint} />
                          : <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{waitingLabel(days)}</span>}
                        <VeredictoChip ctx={ctx.byId.get(r.id)} cargando={ctx.loading} />
                        <VencTexto ctx={ctx.byId.get(r.id)} />
                      </div>
                      <div style={{ marginTop: 2, fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.font, overflowWrap: "anywhere" }}>{r.beneficiary}</div>
                      <div style={{ marginTop: 2, fontSize: 12, color: T.textMuted, fontFamily: T.font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.concept}</div>
                    </div>
                    <div style={{ ...NUM, fontSize: 14, fontWeight: 700, color: T.text, textAlign: "right", whiteSpace: "nowrap" }}>
                      {money(r.amount)}
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textMuted }}>{r.currency}</div>
                    </div>
                    <div className="pl-meta" style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[r.projectNumber, r.submittedBy, `solicitada ${fmtFecha(r.date)}`].filter(Boolean).join(" · ")}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Propuesta en curso */}
        <div>
          {current ? (
            <PropuestaPanel
              key={current.id}
              propuesta={current}
              requestsById={requestsById}
              busy={busy}
              caps={caps}
              syncPendientes={syncPendientes}
              contexto={ctx.byId}
              cargandoCtx={ctx.loading}
              onMeta={(mxn) => void handleMeta(mxn)}
              onDate={handleDate}
              onRemove={handleRemove}
              onSend={() => setConfirm("enviar")}
              onWithdraw={() => setConfirm("retirar")}
              onCancel={() => setConfirm("cancelar")}
              onApprove={() => setConfirm("aprobar")}
              onReturn={() => setDevolverOpen(true)}
              onSync={() => void handleSync()}
            />
          ) : (
            <div className="pl-panel" style={{ border: `1px dashed ${T.cardBorder}`, borderRadius: 12, padding: "28px 20px", fontFamily: T.fontAlt, fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>
              <CalendarPlus size={22} color={T.textMuted} aria-hidden />
              <div style={{ margin: "8px 0 6px", fontWeight: 700, color: T.text, fontFamily: T.font }}>{canCreate ? "Arma la propuesta de la semana" : "No hay propuestas por ahora"}</div>
              {canCreate ? "Crea una propuesta, marca las solicitudes que se pagan y ajusta la fecha de cada una. Lo que no agregues queda aplazado. Al enviarla pasa a aprobación." : "Cuando Finanzas envíe una propuesta a aprobación, aparecerá aquí para que la revises."}
              {canCreate && (
                <div style={{ marginTop: 14 }}>
                  <ActionBtn solid large label="Nueva propuesta" color={T.jade} icon={<Plus size={15} />} onClick={() => setNuevaOpen(true)} disabled={busy} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Barra de selección */}
      {sel.length > 0 && (
        <div className="dp-selbar" role="region" aria-label="Solicitudes seleccionadas">
          <div style={{ display: "flex", gap: "8px 20px", flexWrap: "wrap" }}>
            <StatItem label="Seleccionadas" value={`${sel.length} ${plural(sel.length, "solicitud", "solicitudes")}`}
              sub={hiddenChecked > 0 ? `${hiddenChecked} fuera de la vista (filtros)` : undefined} color={hiddenChecked > 0 ? T.amber : undefined} />
            <StatItem label="Suma" value={totalsText(sel)} mono />
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
            {!editable && (
              <span style={{ fontSize: 12, color: T.amber, fontFamily: T.fontAlt }}>
                {current ? "No puedes editar esta propuesta en su etapa actual." : "Crea una propuesta para agregarlas."}
              </span>
            )}
            <ActionBtn solid large label={current && editable ? `Agregar a «${current.nombre}»` : "Agregar a propuesta"} color={T.jade} icon={<Plus size={15} />} disabled={busy || !editable} onClick={() => void handleAdd()} />
            <BarBtn label="" ariaLabel="Limpiar selección" onClick={() => setChecked([])} icon={<X size={14} aria-hidden />} />
          </div>
        </div>
      )}

      {nuevaOpen && <NuevaPropuestaModal busy={busy} onCreate={(n, f) => void handleCreate(n, f)} onCancel={() => setNuevaOpen(false)} />}

      {confirm === "enviar" && current && (
        <ConfirmModal title={`¿Enviar «${current.nombre}» a aprobación?`} confirmLabel="Enviar a Nivel 1" color={T.jade} solid icon={<Send size={14} />} onConfirm={() => void handleConfirm()} onCancel={() => setConfirm(null)}>
          {currentItems.length} {plural(currentItems.length, "pago", "pagos")} por <strong style={{ color: T.text }}>{totalsText(currentItems)}</strong>. Pasa a la aprobación de Nivel 1; mientras nadie la apruebe puedes retirarla y seguir editando.
        </ConfirmModal>
      )}
      {confirm === "aprobar" && current && (
        <ConfirmModal title={`¿Aprobar «${current.nombre}»?`} confirmLabel={current.estado === "Nivel 2" ? "Aprobar y liberar pagos" : "Aprobar"} color={T.jade} solid icon={<CheckCircle2 size={14} />} onConfirm={() => void handleConfirm()} onCancel={() => setConfirm(null)}>
          {currentItems.length} {plural(currentItems.length, "pago", "pagos")} por <strong style={{ color: T.text }}>{totalsText(currentItems)}</strong>.{" "}
          {current.estado === "Nivel 2"
            ? "Es la última aprobación: los pagos pasan a Finanzas como «Pago Aprobado», con la fecha programada de cada uno, y se avisa a los solicitantes."
            : "Pasa a la aprobación de Nivel 2 (Operaciones)."}
        </ConfirmModal>
      )}
      {devolverOpen && <DevolverModal onConfirm={(n) => void handleDevolver(n)} onCancel={() => setDevolverOpen(false)} />}
      {confirm === "retirar" && current && (
        <ConfirmModal title={`¿Retirar «${current.nombre}»?`} confirmLabel="Retirar" color={T.amber} icon={<Undo2 size={14} />} onConfirm={() => void handleConfirm()} onCancel={() => setConfirm(null)}>
          Vuelve a Borrador y deja de esperar aprobación. Podrás editarla y enviarla de nuevo.
        </ConfirmModal>
      )}
      {confirm === "cancelar" && current && (
        <ConfirmModal title={`¿Cancelar «${current.nombre}»?`} confirmLabel="Cancelar propuesta" color={T.red} icon={<Trash2 size={14} />} onConfirm={() => void handleConfirm()} onCancel={() => setConfirm(null)}>
          Sus {current.items.length} {plural(current.items.length, "solicitud queda", "solicitudes quedan")} libre{current.items.length === 1 ? "" : "s"} para otra propuesta. La propuesta cancelada conserva su historial.
        </ConfirmModal>
      )}
    </div>
  );
};

export default PlaneacionPagos;
