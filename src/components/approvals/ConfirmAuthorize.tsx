import React from "react";
import { CheckCircle2 } from "lucide-react";
import { T } from "../decision/tokens";
import { ActionBtn, useEscape } from "../decision/ui";

// Aprobar en lote manda N solicitudes a Decisión de Pagos y no se deshace desde esta vista:
// se muestra cuántas y por cuánto (antes era un window.confirm que no decía el monto).
export const ConfirmAuthorizeModal: React.FC<{
  count: number;
  totals: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ count, totals, onConfirm, onCancel }) => {
  useEscape(onCancel);
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="confirm-authorize-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ background: T.modalBg, borderRadius: 12, border: `1px solid ${T.jade}70`, boxShadow: "0 16px 60px rgba(0,0,0,0.5)", padding: 24, width: "min(460px, 100%)" }}>
        <div id="confirm-authorize-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>
          ¿Aprobar {count} solicitud{count === 1 ? "" : "es"}?
        </div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 16px", lineHeight: 1.5 }}>
          Pasan a <strong style={{ color: T.text }}>Decisión de Pagos</strong> para su aprobación final. Total:{" "}
          <strong style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{totals}</strong>
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {/* El foco empieza en Cancelar: un Enter accidental no autoriza. */}
          <button type="button" autoFocus onClick={onCancel} className="dp-barbtn">Cancelar</button>
          <ActionBtn solid large label={`Aprobar ${count}`} color={T.jade} icon={<CheckCircle2 size={14} />} onClick={onConfirm} />
        </div>
      </div>
    </div>
  );
};
