import React, { useState } from "react";
import { T } from "../decision/tokens";
import { ActionBtn, BarBtn } from "../decision/ui";
import { defaultNombre, nextFridayISO } from "./logic";
import { ModalShell } from "../ModalShell";

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const box = (accent: string): React.CSSProperties => ({ background: T.modalBg, borderRadius: 12, border: `1px solid ${accent}70`, boxShadow: "0 16px 60px rgba(0,0,0,0.5)", padding: 24, width: "min(460px, 100%)" });
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, background: T.ink, color: T.text, fontSize: 13, fontFamily: T.font, border: `1px solid ${T.cardBorder}`, outline: "none", colorScheme: "dark" };

/** Confirmación genérica. El foco empieza en Cancelar: un Enter accidental no ejecuta la acción. */
export const ConfirmModal: React.FC<{
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  color: string;
  solid?: boolean;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, children, confirmLabel, color, solid, icon, onConfirm, onCancel }) => {
  return (
    <ModalShell labelledBy="pl-confirm-title" onClose={onCancel} onBackdropClick={onCancel} style={overlay}>
      <div style={box(color)}>
        <div id="pl-confirm-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.55, marginBottom: 18 }}>{children}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" autoFocus onClick={onCancel} className="dp-barbtn">Cancelar</button>
          <ActionBtn solid={solid} large label={confirmLabel} color={color} icon={icon} onClick={onConfirm} />
        </div>
      </div>
    </ModalShell>
  );
};

/** Devolver a Finanzas: el motivo es obligatorio (lo ve José Eduardo y queda en el historial). */
export const DevolverModal: React.FC<{ onConfirm: (nota: string) => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");
  return (
    <ModalShell labelledBy="pl-dev-title" onClose={onCancel} onBackdropClick={onCancel} style={overlay}>
      <div style={box(T.amber)}>
        <div id="pl-dev-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>Devolver la propuesta a Finanzas</div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 14px", lineHeight: 1.5 }}>
          Vuelve a Borrador y se borran las aprobaciones. Dile qué debe cambiar (por ejemplo, el monto objetivo).
        </p>
        <textarea autoFocus aria-label="Motivo de la devolución" aria-invalid={!!err} rows={4} className="dp-input" value={nota} maxLength={500}
          placeholder="Ej.: Baja el total a medio millón y deja los pagos más urgentes."
          onChange={(e) => { setNota(e.target.value); setErr(""); }}
          style={{ ...field, resize: "none", fontFamily: T.font }} />
        {err && <p role="alert" style={{ color: T.red, fontSize: 12, fontFamily: T.fontAlt, margin: "6px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <BarBtn label="Cancelar" onClick={onCancel} />
          <ActionBtn large label="Devolver" color={T.amber} onClick={() => { if (!nota.trim()) { setErr("Escribe el motivo de la devolución."); return; } onConfirm(nota.trim()); }} />
        </div>
      </div>
    </ModalShell>
  );
};

export const NuevaPropuestaModal: React.FC<{ busy: boolean; onCreate: (nombre: string, fechaCorte: string) => void; onCancel: () => void }> = ({ busy, onCreate, onCancel }) => {
  const [fecha, setFecha] = useState(nextFridayISO);
  const [nombre, setNombre] = useState(() => defaultNombre(nextFridayISO()));
  // El nombre sigue a la fecha mientras nadie lo haya tocado a mano
  const [tocado, setTocado] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    if (!nombre.trim()) { setErr("Ponle un nombre a la propuesta."); return; }
    if (!fecha) { setErr("Elige la fecha de corte."); return; }
    onCreate(nombre.trim(), fecha);
  };

  return (
    <ModalShell labelledBy="pl-new-title" onClose={onCancel} onBackdropClick={onCancel} style={overlay}>
      <div style={box(T.jade)}>
        <div id="pl-new-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>Nueva propuesta de pagos</div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 16px", lineHeight: 1.5 }}>
          La fecha de corte es el día que se programan por defecto los pagos que agregues; podrás ajustar cada uno.
        </p>
        <label style={{ display: "block", fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginBottom: 4 }} htmlFor="pl-fecha">Fecha de corte</label>
        <input id="pl-fecha" type="date" className="dp-input" value={fecha} style={{ ...field, marginBottom: 12 }}
          onChange={(e) => { setFecha(e.target.value); if (!tocado && e.target.value) setNombre(defaultNombre(e.target.value)); setErr(""); }} />
        <label style={{ display: "block", fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginBottom: 4 }} htmlFor="pl-nombre">Nombre</label>
        <input id="pl-nombre" type="text" className="dp-input" autoFocus value={nombre} maxLength={80} style={field}
          onChange={(e) => { setNombre(e.target.value); setTocado(true); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        {err && <p role="alert" style={{ color: T.red, fontSize: 12, fontFamily: T.fontAlt, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <BarBtn label="Cancelar" onClick={onCancel} />
          <ActionBtn solid large label="Crear propuesta" color={T.jade} disabled={busy} onClick={submit} />
        </div>
      </div>
    </ModalShell>
  );
};
