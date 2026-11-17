import React from "react";
import { Send, Undo2, Trash2, X, AlertTriangle, CheckCircle2, CornerUpLeft, RefreshCw } from "lucide-react";
import type { Request } from "../../data/mockData";
import type { Propuesta } from "../../types/propuestas";
import { T, NUM } from "../decision/tokens";
import { fmtFecha } from "../decision/format";
import { ActionBtn, Chip } from "../decision/ui";
import { money, totalsByCurrency } from "../approvals/helpers";
import { ESTADOS_FLUJO, describeEvento, isOpen } from "./logic";
import { VeredictoChip, VencTexto } from "./Contexto";
import type { Contexto } from "./useDecisionContext";
import { useState } from "react";
import type { Caps } from "./logic";

interface Props {
  propuesta: Propuesta;
  requestsById: Map<string, Request>;
  caps: Caps;
  busy: boolean;
  /** Solicitudes de una propuesta aprobada que no quedaron listas en Finanzas. */
  syncPendientes: string[];
  onDate: (requestId: string, fecha: string) => void;
  onRemove: (requestId: string) => void;
  onSend: () => void;
  onWithdraw: () => void;
  onCancel: () => void;
  onApprove: () => void;
  onReturn: () => void;
  onSync: () => void;
  /** Contexto de Decisión de Pagos por solicitud (vencimiento, MXN, veredicto). */
  contexto: Map<string, Contexto>;
  cargandoCtx: boolean;
  onMeta: (mxn: number | null) => void;
}

const mxnFmt = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

// Meta de total en MXN: el aprobador fija "hasta cuánto" y ve cuánto se pasa o cuánto le queda mientras quita pagos.
const MetaEditor: React.FC<{ meta: number | null; editable: boolean; busy: boolean; total: number; onCommit: (n: number | null) => void }> = ({ meta, editable, busy, total, onCommit }) => {
  const [draft, setDraft] = useState(meta == null ? "" : String(meta));
  const commit = () => {
    const raw = draft.trim().replace(/[$,\s]/g, "");
    const n = raw === "" ? null : Number(raw);
    if (n !== null && (!isFinite(n) || n < 0)) { setDraft(meta == null ? "" : String(meta)); return; }
    if (n !== meta) onCommit(n);
  };
  const diff = meta == null ? 0 : total - meta;
  return (
    <div style={{ marginTop: 12 }}>
      {editable ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
          Meta de total (MXN)
          <input type="text" inputMode="numeric" className="dp-input pl-date" aria-label="Meta de total en pesos" placeholder="Sin meta" value={draft} disabled={busy}
            style={{ width: 130 }} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </label>
      ) : meta != null ? (
        <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>Meta de total: <span style={{ ...NUM, color: T.text }}>{mxnFmt(meta)} MXN</span></div>
      ) : null}
      {meta != null && (
        <div role="status" style={{ marginTop: 6, fontSize: 12, fontWeight: 600, fontFamily: T.fontAlt, color: diff > 0 ? T.amber : T.jade }}>
          {diff > 0 ? `Excede la meta por ${mxnFmt(diff)} MXN` : `Dentro de la meta · quedan ${mxnFmt(-diff)} MXN`}
        </div>
      )}
    </div>
  );
};

const corto = (iso: string) => (iso ? fmtFecha(iso.slice(0, 10)) : "");

// Recorrido de la propuesta: dónde está, quién aprobó cada nivel y qué sigue.
const Stepper: React.FC<{ p: Propuesta }> = ({ p }) => {
  const idx = ESTADOS_FLUJO.findIndex((s) => s.id === p.estado);
  const aprobo = (id: string) => (id === "Nivel 1" ? p.aprobaciones.nivel1 : id === "Nivel 2" ? p.aprobaciones.nivel2 : undefined);
  return (
    <ol aria-label="Avance de la propuesta" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
      {ESTADOS_FLUJO.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const a = aprobo(s.id);
        const color = current ? T.jade : done ? T.textSub : T.textMuted;
        // Un nivel aprobado muestra quién y cuándo; el pendiente muestra a quién le toca
        const hint = a ? `✓ ${a.por.split(" ")[0]} · ${corto(a.en)}` : s.hint;
        return (
          <li key={s.id} aria-current={current ? "step" : undefined} style={{ minWidth: 0 }}>
            <div style={{ height: 3, borderRadius: 2, background: current || done ? T.jade : "rgba(255,255,255,0.12)", opacity: done ? 0.55 : 1 }} />
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: current ? 700 : 500, color, fontFamily: T.fontAlt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
            <div title={hint} style={{ fontSize: 11, color: a ? T.jade : T.textMuted, fontFamily: T.fontAlt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hint}</div>
          </li>
        );
      })}
    </ol>
  );
};

const Note: React.FC<{ title: string; children: React.ReactNode; tone: "warn" | "ok" }> = ({ title, children, tone }) => {
  const c = tone === "warn" ? T.amber : T.jade;
  return (
    <div role="status" style={{ margin: "0 16px 14px", padding: "10px 12px", borderRadius: 8, background: tone === "warn" ? T.amberFaint : T.jadeFaint, border: `1px solid ${c}55`, fontFamily: T.fontAlt }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: c, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, overflowWrap: "anywhere" }}>{children}</div>
    </div>
  );
};

export const PropuestaPanel: React.FC<Props> = ({ propuesta: p, requestsById, caps, busy, syncPendientes, onDate, onRemove, onSend, onWithdraw, onCancel, onApprove, onReturn, onSync, contexto, cargandoCtx, onMeta }) => {
  const editable = caps.editar;
  const found = p.items.map((it) => ({ it, r: requestsById.get(it.requestId) }));
  const live = found.filter((f): f is { it: typeof f.it; r: Request } => !!f.r && isOpen(f.r));
  const totals = totalsByCurrency(live.map((f) => f.r));
  const stale = found.length - live.length;
  const nivelLabel = p.estado === "Nivel 1" ? "Nivel 1 (Dirección)" : "Nivel 2 (Operaciones y PMO)";
  const recientes = [...p.historial].reverse().slice(0, 8);
  // Total en pesos y veredictos de lo que hay en la propuesta; lo que no tiene T/C o dato no se inventa, se cuenta aparte
  let totalMxn = 0;
  let sinDato = 0;
  let bloquear = 0;
  let revisar = 0;
  for (const { r } of live) {
    const c = contexto.get(r.id);
    if (!c || c.pago.sin_tc) sinDato++; else totalMxn += c.pago.total_mxn;
    if (c?.decision?.color === "rojo") bloquear++;
    else if (c?.decision?.color === "amarillo") revisar++;
  }

  return (
    <section aria-label={`Propuesta ${p.nombre}`} className="pl-panel" style={{ background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <header style={{ padding: "14px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font }}>{p.nombre}</h3>
          <Chip label={p.estado} color={p.estado === "Borrador" ? T.amber : T.jade} bg={p.estado === "Borrador" ? T.amberFaint : T.jadeFaint} />
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
          {p.id} · corte {fmtFecha(p.fechaCorte)} · creada por {p.creadaPor.nombre || p.creadaPor.email}
        </div>
        <div style={{ marginTop: 14 }}><Stepper p={p} /></div>
      </header>

      {p.estado === "Borrador" && p.devolucion && (
        <div style={{ paddingTop: 14 }}>
          <Note title={`Devuelta por ${p.devolucion.por}`} tone="warn">{p.devolucion.nota || "Sin motivo registrado."}</Note>
        </div>
      )}

      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginBottom: 4 }}>
          {live.length} {live.length === 1 ? "pago" : "pagos"} en la propuesta
        </div>
        {totals.length === 0
          ? <div style={{ fontSize: 14, color: T.textSub, fontFamily: T.fontAlt }}>Aún sin pagos. Marca solicitudes a la izquierda y agrégalas.</div>
          : totals.map((t) => (
            <div key={t.currency} style={{ ...NUM, fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {money(t.total)} <span style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>{t.currency}</span>
            </div>
          ))}
        {stale > 0 && (
          <div role="status" style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: T.text, fontFamily: T.fontAlt, background: T.amberFaint, border: `1px solid ${T.amber}50`, borderRadius: 8, padding: "8px 10px" }}>
            <AlertTriangle size={14} color={T.amber} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
            {stale} {stale === 1 ? "solicitud ya no está abierta" : "solicitudes ya no están abiertas"} (pagadas, rechazadas o devueltas) y no se cuentan en el total.
          </div>
        )}
      </div>

      {live.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>Equivale a</div>
          <div style={{ ...NUM, fontSize: 18, fontWeight: 700, color: T.text }}>{cargandoCtx && contexto.size === 0 ? "Calculando…" : `${mxnFmt(totalMxn)} MXN`}</div>
          {(sinDato > 0 && contexto.size > 0) && (
            <div style={{ marginTop: 4, fontSize: 11, color: T.amber, fontFamily: T.fontAlt }}>{sinDato} sin tipo de cambio o sin datos: no se suma{sinDato === 1 ? "" : "n"}.</div>
          )}
          {(bloquear > 0 || revisar > 0) && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {bloquear > 0 && <Chip label={`${bloquear} en Bloquear`} color={T.red} bg={T.redFaint} title="OC o avance de proyecto sin aprobar" />}
              {revisar > 0 && <Chip label={`${revisar} por revisar`} color={T.amber} bg={T.amberFaint} />}
            </div>
          )}
          <MetaEditor key={String(p.meta)} meta={p.meta} editable={editable} busy={busy} total={totalMxn} onCommit={onMeta} />
        </div>
      )}

      {found.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "min(46vh, 460px)", overflowY: "auto" }}>
          {found.map(({ it, r }) => {
            const ok = !!r && isOpen(r);
            return (
              <li key={it.requestId} style={{ padding: "10px 16px", borderBottom: `1px solid var(--wa-06)`, opacity: ok ? 1 : 0.6 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, fontFamily: T.fontAlt }}>{it.requestId}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, overflowWrap: "anywhere" }}>{r ? r.beneficiary : "Solicitud no disponible"}</div>
                    {r && <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.concept}</div>}
                    {ok && (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <VeredictoChip ctx={contexto.get(it.requestId)} cargando={cargandoCtx} />
                        <VencTexto ctx={contexto.get(it.requestId)} />
                      </div>
                    )}
                  </div>
                  {r && (
                    <div style={{ ...NUM, fontSize: 13, fontWeight: 700, color: T.text, textAlign: "right", whiteSpace: "nowrap" }}>
                      {money(r.amount)}
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.textMuted }}>{r.currency}</div>
                    </div>
                  )}
                  {editable && (
                    <button type="button" className="dp-icon-btn" aria-label={`Quitar ${it.requestId} de la propuesta`} disabled={busy} onClick={() => onRemove(it.requestId)}>
                      <X size={16} aria-hidden />
                    </button>
                  )}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
                  Pago programado
                  {editable ? (
                    <input type="date" className="dp-input pl-date" aria-label={`Fecha de pago de ${it.requestId}`} value={it.fechaProgramada} disabled={busy}
                      onChange={(e) => { if (e.target.value) onDate(it.requestId, e.target.value); }} />
                  ) : (
                    <span style={{ ...NUM, color: T.text, fontSize: 12 }}>{fmtFecha(it.fechaProgramada)}</span>
                  )}
                  {!ok && <Chip label="No abierta" color={T.amber} bg={T.amberFaint} />}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {syncPendientes.length > 0 && (
        <div style={{ paddingTop: 14 }}>
          <Note title="Falta dejar pagos listos en Finanzas" tone="warn">
            {syncPendientes.length} {syncPendientes.length === 1 ? "solicitud aprobada no quedó" : "solicitudes aprobadas no quedaron"} en «Pago Aprobado» ({syncPendientes.join(", ")}). Reintenta la sincronización.
          </Note>
        </div>
      )}

      <footer style={{ display: "grid", gap: 8, padding: 16 }}>
        {/* Finanzas arma la propuesta */}
        {p.estado === "Borrador" && caps.planner && (
          <>
            <ActionBtn solid large label="Enviar a aprobación" color={T.jade} icon={<Send size={15} />} disabled={busy || live.length === 0} onClick={onSend} />
            <ActionBtn large label="Cancelar propuesta" color={T.red} icon={<Trash2 size={15} />} disabled={busy} onClick={onCancel} />
          </>
        )}
        {p.estado === "Borrador" && !caps.planner && (
          <p style={{ margin: 0, fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>Finanzas la está armando; te llegará cuando la envíe a aprobación.</p>
        )}

        {/* Aprobadores del nivel en curso: aprobar es la acción principal, devolver exige motivo */}
        {caps.aprobar && (
          <>
            <ActionBtn solid large label={p.estado === "Nivel 2" ? "Aprobar y liberar pagos" : "Aprobar y pasar a Nivel 2"} color={T.jade} icon={<CheckCircle2 size={15} />} disabled={busy || live.length === 0} onClick={onApprove} />
            <ActionBtn large label="Devolver a Finanzas" color={T.amber} icon={<CornerUpLeft size={15} />} disabled={busy} onClick={onReturn} />
            <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, lineHeight: 1.5 }}>
              Puedes quitar pagos o mover fechas antes de aprobar; el total se recalcula y Finanzas verá tus cambios.
            </p>
          </>
        )}

        {/* Quien espera, ve a quién le toca; Finanzas puede retirar mientras no haya aprobación */}
        {(p.estado === "Nivel 1" || p.estado === "Nivel 2") && !caps.aprobar && (
          <>
            <p style={{ margin: 0, fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>
              Esperando la aprobación de {nivelLabel}{p.estado === "Nivel 1" && p.enviadaEn ? ` desde el ${corto(p.enviadaEn)}` : ""}.
              {p.estado === "Nivel 1" && caps.planner ? " Mientras nadie la apruebe puedes retirarla para seguir editándola." : ""}
            </p>
            {p.estado === "Nivel 1" && caps.planner && (
              <ActionBtn large label="Retirar propuesta" color={T.amber} icon={<Undo2 size={15} />} disabled={busy} onClick={onWithdraw} />
            )}
          </>
        )}
        {p.estado === "Aprobada" && (
          <>
            <p style={{ margin: 0, fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>
              Aprobada. Los pagos quedan listos en Finanzas con su fecha programada.
            </p>
            {syncPendientes.length > 0 && (
              <ActionBtn large label="Reintentar sincronización" color={T.jade} icon={<RefreshCw size={15} />} disabled={busy} onClick={onSync} />
            )}
          </>
        )}
      </footer>

      {recientes.length > 0 && (
        <details style={{ borderTop: `1px solid ${T.cardBorder}`, padding: "12px 16px" }}>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.textSub, fontFamily: T.fontAlt }}>Actividad ({p.historial.length})</summary>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {recientes.map((h, i) => (
              <li key={`${h.en}-${i}`} style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.45 }}>
                <strong style={{ color: T.text, fontWeight: 600 }}>{h.por || "—"}</strong> {describeEvento(h)}
                <span style={{ color: T.textMuted }}> · {corto(h.en)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};
