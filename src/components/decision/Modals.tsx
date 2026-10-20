import React, { useState } from "react";
import { CheckCircle2, HelpCircle, X, Download, Copy } from "lucide-react";
import type { PagoFlat } from "../../services/decision";
import { T, NUM } from "./tokens";
import { fmtN, fmtMXN, fmtFecha } from "./format";
import { ActionBtn, BarBtn, TotalRow, useEscape } from "./ui";

// Modal de aclaración: regresa la solicitud a Borrador con el comentario del admin
export const ClarifyModal: React.FC<{ label: string; onConfirm: (comment: string) => void; onCancel: () => void }> = ({ label, onConfirm, onCancel }) => {
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");
  useEscape(onCancel);
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="clarify-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ background: T.modalBg, borderRadius: 12, border: `1px solid ${T.amber}70`, boxShadow: "0 16px 60px rgba(0,0,0,0.5)", padding: 24, width: "min(440px, 100%)" }}>
        <div id="clarify-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>Solicitar aclaración — {label}</div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 14px" }}>
          La solicitud regresa a Borrador y el solicitante recibe tu comentario.
        </p>
        <textarea
          autoFocus
          aria-label="Comentario de aclaración"
          value={comment}
          onChange={(e) => { setComment(e.target.value); setErr(""); }}
          placeholder="Describe qué información falta o debe corregirse…"
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8,
            background: T.ink, color: T.text, fontSize: 13, fontFamily: T.font,
            border: `1px solid ${T.cardBorder}`, outline: "none", resize: "none",
          }}
        />
        {err && <p style={{ color: T.red, fontSize: 12, fontFamily: T.fontAlt, margin: "6px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <BarBtn label="Cancelar" onClick={onCancel} />
          <ActionBtn label="Enviar aclaración" color={T.amber} icon={<HelpCircle size={14} />} onClick={() => {
            if (!comment.trim()) { setErr("Escribe el comentario de aclaración."); return; }
            onConfirm(comment.trim());
          }} />
        </div>
      </div>
    </div>
  );
};

// Confirmación de aprobación en lote: aprobar manda N pagos a Contabilidad y no se deshace
// desde esta vista, así que se muestra cuántos y por cuánto antes de ejecutar.
export const ConfirmApproveModal: React.FC<{
  count: number;
  totalMxn: number;
  notProceed: number;
  sinTc: number;
  hidden: number;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ count, totalMxn, notProceed, sinTc, hidden, onConfirm, onCancel }) => {
  useEscape(onCancel);

  const warnings = [
    notProceed > 0 && `${notProceed} no tiene${notProceed === 1 ? "" : "n"} la decisión "Procede" (OC o avance de proyecto sin validar).`,
    hidden > 0 && `${hidden} está${hidden === 1 ? "" : "n"} fuera de la vista por los filtros actuales.`,
    sinTc > 0 && `${sinTc} sin tipo de cambio: su monto en MXN no está incluido en el total.`,
  ].filter(Boolean) as string[];

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="confirm-approve-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ background: T.modalBg, borderRadius: 12, border: `1px solid ${T.jade}70`, boxShadow: "0 16px 60px rgba(0,0,0,0.5)", padding: 24, width: "min(460px, 100%)" }}>
        <div id="confirm-approve-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>
          ¿Aprobar {count} pagos?
        </div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 14px" }}>
          Pasan directo a Contabilidad para programarse y pagarse. Total: <strong style={{ color: T.text }}>{fmtMXN(totalMxn)} MXN</strong>
        </p>
        {warnings.length > 0 && (
          <ul style={{ margin: "0 0 14px", padding: "10px 14px 10px 28px", background: T.amberFaint, border: `1px solid ${T.amber}50`, borderRadius: 8, fontSize: 12, color: T.text, fontFamily: T.fontAlt, lineHeight: 1.6 }}>
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {/* El foco empieza en Cancelar: un Enter accidental no aprueba. */}
          <button type="button" autoFocus onClick={onCancel} className="dp-barbtn">Cancelar</button>
          <ActionBtn label={`Aprobar ${count}`} color={T.jade} icon={<CheckCircle2 size={14} />} onClick={onConfirm} />
        </div>
      </div>
    </div>
  );
};

// ─── Selection modal ─────────────────────────────────────────
export const SelectionModal: React.FC<{ selected: Set<string>; pagos: PagoFlat[]; onClose: () => void; onExportCSV: () => void; onCopy: () => void }> = ({
  selected, pagos, onClose, onExportCSV, onCopy,
}) => {
  const sel = pagos.filter((p) => selected.has(p.id)).sort((a, b) => b.total_mxn - a.total_mxn);
  const total = sel.reduce((s, p) => s + p.total_mxn, 0);
  const propTotal = sel.filter((p) => p.propuesta_bucket === "Propuesta").reduce((s, p) => s + p.total_mxn, 0);
  const aplazTotal = sel.filter((p) => p.propuesta_bucket === "Aplazado").reduce((s, p) => s + p.total_mxn, 0);
  useEscape(onClose);

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="selection-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: T.panelBg, borderRadius: 12, width: "min(900px, 100%)", maxHeight: "85vh",
        display: "flex", flexDirection: "column", border: `1px solid ${T.cardBorder}`,
        boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.cardBorder}` }}>
          <div>
            <div id="selection-title" style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.font }}>Lista de pagos seleccionados</div>
            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2 }}>
              {sel.length} pagos · {fmtMXN(total)} MXN
            </div>
          </div>
          <button type="button" className="dp-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: T.panelBg }}>
              <tr>
                {["#", "Tipo", "Proyecto", "Solicitante", "Beneficiario", "OC / Factura", "Banco", "Vence", "Total MXN"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: ["Total MXN"].includes(h) ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sel.map((p, i) => {
                const tagColor = p.propuesta_bucket === "Propuesta" ? T.jade : T.steel;
                const tagBg = p.propuesta_bucket === "Propuesta" ? T.jadeFaint : T.steelFaint;
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.textMuted }}>{i + 1}.<span style={{ marginLeft: 4, padding: "1px 6px", background: tagBg, color: tagColor, borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{p.propuesta || "—"}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text, fontFamily: T.fontAlt }}>{p.tipo_op}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{p.operacion_cat}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text }}>{p.proj_id || "—"}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{(p.proyecto || "").slice(0, 40)}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text }}>{p.solicitante || "—"}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.text }}>{(p.benef_clean || "").slice(0, 28)}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{p.cliente || "—"}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 11, ...NUM, color: T.text }}>{p.oc || "—"}<br /><span style={{ fontSize: 10, color: T.textMuted }}>{(p.factura || "").slice(0, 18)}</span></td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: T.textSub }}>{p.banco}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, ...NUM, color: T.textSub }}>{fmtFecha(p.venc)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, ...NUM, fontWeight: 700, color: T.text }}>{fmtMXN(p.total_mxn)}{p.divisa !== "MXN" && <><br /><span style={{ fontSize: 10, color: T.textMuted }}>{p.divisa} {fmtN(p.monto)}</span></>}</td>
                  </tr>
                );
              })}
              <TotalRow cells={[
                { value: `Total ${sel.length} pagos`, align: "left", bold: true },
                { value: "" }, { value: "" }, { value: "" }, { value: "" }, { value: "" }, { value: "" }, { value: "" },
                { value: fmtMXN(total), bold: true },
              ]} />
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: `1px solid ${T.cardBorder}` }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt }}>
            Propuesta: {sel.filter((p) => p.propuesta_bucket === "Propuesta").length} · {fmtMXN(propTotal)} &nbsp;|&nbsp; Aplazado: {sel.filter((p) => p.propuesta_bucket === "Aplazado").length} · {fmtMXN(aplazTotal)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BarBtn label="Exportar CSV" onClick={onExportCSV} primary icon={<Download size={13} />} />
            <BarBtn label="Copiar" onClick={onCopy} icon={<Copy size={13} />} />
            <BarBtn label="Cerrar" onClick={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};
