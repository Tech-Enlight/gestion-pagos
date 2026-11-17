import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, HelpCircle, XCircle, Loader2, Search, X, Inbox } from "lucide-react";
import RejectModal from "./RejectModal";
import { ClarifyModal } from "./decision/Modals";
import { ActionBtn, BarBtn, Chip, StatItem } from "./decision/ui";
import { T, NUM } from "./decision/tokens";
import { ReviewPanel } from "./approvals/ReviewPanel";
import { ConfirmAuthorizeModal } from "./approvals/ConfirmAuthorize";
import { STALE_DAYS, money, totalsText, waitingDays, waitingLabel, waitingSince } from "./approvals/helpers";
import "./approvals/approvals.css";
import { STATUS } from "../data/mockData";
import type { Request } from "../data/mockData";

interface Props {
  requests: Request[];
  onUpdateRequest: (id: string, status: string, extra?: Record<string, unknown>) => void;
  onUpdateRequestBulk?: (ids: string[], status: string, extra?: Record<string, unknown>) => Promise<void>;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const ApprovalManagement: React.FC<Props> = ({ requests, onUpdateRequest, onUpdateRequestBulk }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [clarifyTarget, setClarifyTarget] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  // Selección en lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkClarifyTarget, setBulkClarifyTarget] = useState<string[] | null>(null);
  const [bulkRejectTarget, setBulkRejectTarget] = useState<string[] | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // La más antigua primero: es la que más lleva esperando y la que el aprobador debería ver antes.
  const pending = useMemo(
    () => requests.filter((r) => r.status === STATUS.AUTORIZACION).sort((a, b) => waitingSince(a) - waitingSince(b)),
    [requests]
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q
      ? pending.filter((r) => [r.id, r.beneficiary, r.projectNumber, r.concept, r.poNumber, r.submittedBy, r.department]
          .some((v) => (v || "").toLowerCase().includes(q)))
      : pending),
    [pending, q]
  );

  // Se fija al montar: las etiquetas "Hace N días" no necesitan segundero y Date.now() en render no es puro.
  const [now] = useState(() => Date.now());
  const selected = pending.find((r) => r.id === selectedId) ?? null;
  // Solo ids que siguen pendientes: tras aprobar en otra pestaña/lote la selección vieja no debe contar.
  const sel = pending.filter((r) => selectedIds.includes(r.id));
  const selVisibleCount = sel.filter((r) => visible.some((v) => v.id === r.id)).length;
  const hiddenSel = sel.length - selVisibleCount;
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selectedIds.includes(r.id));
  const staleCount = pending.filter((r) => waitingDays(r, now) >= STALE_DAYS).length;

  // En pantallas angostas el panel queda debajo de la lista: llévalo a la vista al elegir.
  useEffect(() => {
    if (selectedId && window.matchMedia("(max-width: 1099px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  const anyModal = !!(rejectTarget || clarifyTarget || bulkApproveOpen || bulkClarifyTarget || bulkRejectTarget);
  const closePanel = useCallback(() => setSelectedId(null), []);
  useEffect(() => {
    if (!selectedId || anyModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, anyModal, closePanel]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 6000);
  };

  // Tras resolver una, abre la siguiente de la lista: el aprobador procesa la cola sin volver a buscar.
  const advanceFrom = (id: string) => {
    const i = visible.findIndex((r) => r.id === id);
    const next = visible[i + 1] ?? visible[i - 1];
    setSelectedId(next && next.id !== id ? next.id : null);
  };

  const handleApprove = () => {
    if (!selected) return;
    onUpdateRequest(selected.id, STATUS.PENDING_FIN);
    flash(`${selected.id} aprobada — pasó a Decisión de Pagos.`);
    advanceFrom(selected.id);
  };

  const handleReject = (id: string, comment: string) => {
    onUpdateRequest(id, STATUS.REJECTED, { rejectReason: comment });
    flash(`${id} rechazada — el solicitante recibe el motivo.`);
    setRejectTarget(null);
    advanceFrom(id);
  };

  const handleClarifyConfirm = (comment: string) => {
    if (!clarifyTarget) return;
    onUpdateRequest(clarifyTarget, STATUS.DRAFT, { clarificationRequest: comment });
    flash(`${clarifyTarget} devuelta al solicitante para aclaración.`);
    const id = clarifyTarget;
    setClarifyTarget(null);
    advanceFrom(id);
  };

  // ── Lote ──
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAllVisible = () => {
    const ids = visible.map((r) => r.id);
    setSelectedIds((prev) => (allVisibleSelected ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  };

  const runBulk = async (ids: string[], status: string, extra: Record<string, unknown> | undefined, okMsg: string) => {
    setIsBulkOperating(true);
    try {
      // Un solo llamado al webhook para todo el lote (digest de correos en vez de uno por solicitud).
      if (onUpdateRequestBulk) {
        await onUpdateRequestBulk(ids, status, extra);
      } else {
        for (const id of ids) await onUpdateRequest(id, status, extra);
      }
      setSelectedIds([]);
      setSelectedId(null);
      flash(okMsg);
    } catch (error) {
      console.error("Error en acción masiva:", error);
      flash("No se pudo completar la acción en lote. Revisa la cola e inténtalo de nuevo.");
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkApprove = async () => {
    const ids = sel.map((r) => r.id);
    setBulkApproveOpen(false);
    await runBulk(ids, STATUS.PENDING_FIN, undefined, `${ids.length} ${plural(ids.length, "solicitud aprobada", "solicitudes aprobadas")} — pasaron a Decisión de Pagos.`);
  };

  const handleBulkClarify = async (comment: string) => {
    if (!bulkClarifyTarget) return;
    const ids = bulkClarifyTarget;
    setBulkClarifyTarget(null);
    await runBulk(ids, STATUS.DRAFT, { clarificationRequest: comment }, `${ids.length} ${plural(ids.length, "solicitud devuelta", "solicitudes devueltas")} para aclaración.`);
  };

  const handleBulkReject = async (_label: string, comment: string) => {
    if (!bulkRejectTarget) return;
    const ids = bulkRejectTarget;
    setBulkRejectTarget(null);
    await runBulk(ids, STATUS.REJECTED, { rejectReason: comment }, `${ids.length} ${plural(ids.length, "solicitud rechazada", "solicitudes rechazadas")}.`);
  };

  const selIds = sel.map((r) => r.id);

  return (
    <div style={{ display: "grid", gap: 16, paddingBottom: sel.length > 0 ? 96 : 0 }}>
      {/* Encabezado: qué hay en la cola y cuánto dinero representa */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 700, fontFamily: T.font }}>Gestión de Aprobaciones</h2>
          <p style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: T.textSub, fontFamily: T.fontAlt }}>
            {pending.length === 0 ? (
              <span>Sin solicitudes por aprobar</span>
            ) : (
              <>
                <span>{pending.length} {plural(pending.length, "solicitud requiere", "solicitudes requieren")} tu aprobación</span>
                <span aria-hidden style={{ color: T.textMuted }}>·</span>
                <span style={{ ...NUM, color: T.text, fontWeight: 600 }}>{totalsText(pending)}</span>
                {staleCount > 0 && (
                  <Chip label={`${staleCount} con ${STALE_DAYS}+ días de espera`} color={T.amber} bg={T.amberFaint} />
                )}
              </>
            )}
          </p>
        </div>
        {isBulkOperating && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: T.jade, fontFamily: T.fontAlt, background: T.jadeFaint, padding: "6px 12px", borderRadius: 8 }}>
            <Loader2 size={14} className="dp-spin" aria-hidden /> Procesando lote…
          </div>
        )}
      </div>

      {/* Confirmación de la última acción (anuncio para lector de pantalla + vista) */}
      <div role="status" aria-live="polite" className="ap-notice" style={{ minHeight: notice ? undefined : 0, opacity: notice ? 1 : 0 }}>
        {notice && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: T.jadeFaint, border: `1px solid ${T.jade}40`, color: T.text, fontSize: 13, fontFamily: T.fontAlt }}>
            {notice}
          </div>
        )}
      </div>

      {pending.length === 0 ? (
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <Inbox size={28} color={T.textMuted} aria-hidden />
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: T.text, fontFamily: T.font }}>Estás al día</div>
          <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.5 }}>
            Cuando alguien envíe o re-envíe una solicitud de pago, aparecerá aquí para tu aprobación.
          </p>
        </div>
      ) : (
        <div className="ap-layout ap-layout--split">
          {/* Cola */}
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: `1px solid ${T.cardBorder}`, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, cursor: "pointer" }}>
                <input
                  type="checkbox" className="ap-check"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={isBulkOperating || visible.length === 0}
                />
                Seleccionar {q ? "las que coinciden" : "todas"}
              </label>
              <div style={{ marginLeft: "auto", position: "relative", flex: "0 1 260px", minWidth: 180 }}>
                <Search size={14} aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
                <input
                  type="search" className="dp-input"
                  aria-label="Buscar por ID, beneficiario, proyecto, concepto o solicitante"
                  placeholder="Buscar solicitud…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 30px", borderRadius: 6, background: T.ink, color: T.text, fontSize: 12, fontFamily: T.fontAlt, border: `1px solid ${T.cardBorder}`, outline: "none" }}
                />
              </div>
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: T.textSub, fontFamily: T.fontAlt }}>
                Ninguna solicitud coincide con “{query}”.{" "}
                <button type="button" onClick={() => setQuery("")} style={{ background: "none", border: "none", padding: 0, color: T.jade, fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline", cursor: "pointer" }}>Limpiar búsqueda</button>
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {visible.map((r) => {
                  const days = waitingDays(r, now);
                  const stale = days >= STALE_DAYS;
                  const isOpen = selectedId === r.id;
                  return (
                    <li
                      key={r.id}
                      className="ap-row"
                      aria-current={isOpen ? "true" : undefined}
                      onClick={() => setSelectedId(isOpen ? null : r.id)}
                    >
                      <input
                        type="checkbox" className="ap-check"
                        aria-label={`Seleccionar ${r.id}`}
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleRow(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBulkOperating}
                      />
                      <button type="button" className="ap-rowbtn" onClick={(e) => { e.stopPropagation(); setSelectedId(isOpen ? null : r.id); }} aria-expanded={isOpen}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub, fontFamily: T.fontAlt }}>{r.id}</span>
                          {stale
                            ? <Chip label={waitingLabel(days)} color={T.amber} bg={T.amberFaint} />
                            : <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{waitingLabel(days)}</span>}
                        </span>
                        <span style={{ display: "block", marginTop: 2, fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.font, overflowWrap: "anywhere" }}>{r.beneficiary}</span>
                        <span style={{ display: "block", marginTop: 2, fontSize: 12, color: T.textMuted, fontFamily: T.font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.concept}</span>
                      </button>
                      <span style={{ ...NUM, fontSize: 14, fontWeight: 700, color: T.text, textAlign: "right", whiteSpace: "nowrap" }}>
                        {money(r.amount)}
                        <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.textMuted }}>{r.currency}</span>
                      </span>
                      <span className="ap-meta" style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[r.projectNumber, r.submittedBy].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Panel de revisión (o la pista de qué hacer, para que el layout no salte al elegir) */}
          <div ref={panelRef}>
            {selected ? (
              <ReviewPanel
                key={selected.id}
                request={selected}
                days={waitingDays(selected, now)}
                busy={isBulkOperating}
                onApprove={handleApprove}
                onClarify={() => setClarifyTarget(selected.id)}
                onReject={() => setRejectTarget(selected.id)}
                onClose={closePanel}
              />
            ) : (
              <div className="ap-panel" style={{ border: `1px dashed ${T.cardBorder}`, borderRadius: 12, padding: "28px 20px", color: T.textSub, fontFamily: T.fontAlt, fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontFamily: T.font }}>Elige una solicitud para revisarla</div>
                Verás el detalle completo y podrás aprobarla, pedir una aclaración o rechazarla. Para resolver varias a la vez, márcalas con la casilla.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barra de lote */}
      {sel.length > 0 && (
        <div className="dp-selbar" role="region" aria-label="Solicitudes seleccionadas">
          <div style={{ display: "flex", gap: "8px 20px", flexWrap: "wrap" }}>
            <StatItem
              label="Seleccionadas" value={`${sel.length} ${plural(sel.length, "solicitud", "solicitudes")}`}
              sub={hiddenSel > 0 ? `${hiddenSel} fuera de la vista (búsqueda)` : undefined}
              color={hiddenSel > 0 ? T.amber : undefined}
            />
            <StatItem label="Suma" value={totalsText(sel)} mono />
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ActionBtn solid large label={`Aprobar (${sel.length})`} color={T.jade} disabled={isBulkOperating} icon={<CheckCircle2 size={14} />} onClick={() => setBulkApproveOpen(true)} />
            <ActionBtn large label={`Aclaración (${sel.length})`} color={T.amber} disabled={isBulkOperating} icon={<HelpCircle size={14} />} onClick={() => setBulkClarifyTarget(selIds)} />
            <ActionBtn large label={`Rechazar (${sel.length})`} color={T.red} disabled={isBulkOperating} icon={<XCircle size={14} />} onClick={() => setBulkRejectTarget(selIds)} />
            <BarBtn label="" ariaLabel="Limpiar selección" onClick={() => setSelectedIds([])} icon={<X size={14} aria-hidden />} />
          </div>
        </div>
      )}

      {rejectTarget && <RejectModal requestId={rejectTarget} onConfirm={handleReject} onCancel={() => setRejectTarget(null)} />}
      {clarifyTarget && <ClarifyModal label={clarifyTarget} onConfirm={handleClarifyConfirm} onCancel={() => setClarifyTarget(null)} />}
      {bulkApproveOpen && (
        <ConfirmAuthorizeModal count={sel.length} totals={totalsText(sel)} onConfirm={handleBulkApprove} onCancel={() => setBulkApproveOpen(false)} />
      )}
      {bulkClarifyTarget && (
        <ClarifyModal label={`${bulkClarifyTarget.length} solicitudes`} onConfirm={handleBulkClarify} onCancel={() => setBulkClarifyTarget(null)} />
      )}
      {bulkRejectTarget && (
        <RejectModal requestId={`${bulkRejectTarget.length} solicitudes`} onConfirm={handleBulkReject} onCancel={() => setBulkRejectTarget(null)} />
      )}
    </div>
  );
};

export default ApprovalManagement;
