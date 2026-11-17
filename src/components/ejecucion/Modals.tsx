import React, { useState } from "react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import type { Request } from "../../data/mockData";
import { T } from "../decision/tokens";
import { ActionBtn, BarBtn } from "../decision/ui";
import { ModalShell } from "../ModalShell";
import { localISO } from "../planeacion/logic";
import { fechaPago } from "./logic";

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const box = (accent: string): React.CSSProperties => ({ background: T.modalBg, borderRadius: 12, border: `1px solid ${accent}70`, boxShadow: "0 16px 60px rgba(0,0,0,0.5)", padding: 24, width: "min(480px, 100%)" });
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, background: T.ink, color: T.text, fontSize: 13, fontFamily: T.font, border: `1px solid ${T.cardBorder}`, outline: "none", colorScheme: "dark" };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: T.textMuted, fontFamily: T.fontAlt, marginBottom: 4 };

/** Mover la fecha de un pago ya aprobado: excepcional, por eso exige motivo (queda en el historial y se avisa al solicitante). */
export const ReprogramarModal: React.FC<{ req: Request; busy: boolean; onConfirm: (fecha: string, nota: string) => void; onCancel: () => void }> = ({ req, busy, onConfirm, onCancel }) => {
  const [fecha, setFecha] = useState(fechaPago(req));
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!fecha) { setErr("Elige la nueva fecha de pago."); return; }
    if (nota.trim().length < 3) { setErr("Escribe el motivo del cambio."); return; }
    onConfirm(fecha, nota.trim());
  };
  return (
    <ModalShell labelledBy="ej-repro-title" onClose={onCancel} style={overlay}>
      <div style={box(T.jade)}>
        <div id="ej-repro-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>Reprogramar {req.id}</div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 16px", lineHeight: 1.5 }}>
          La fecha ya fue aprobada con la propuesta. Úsalo solo si algo impide pagar ese día; el solicitante recibe la nueva fecha por correo.
        </p>
        <label style={label} htmlFor="ej-fecha">Nueva fecha de pago</label>
        <input id="ej-fecha" type="date" className="dp-input" autoFocus value={fecha} min={localISO(new Date())} style={{ ...field, marginBottom: 12 }}
          onChange={(e) => { setFecha(e.target.value); setErr(""); }} />
        <label style={label} htmlFor="ej-motivo">Motivo</label>
        <textarea id="ej-motivo" className="dp-input" rows={3} maxLength={500} value={nota} placeholder="Ej.: corte bancario, falta de fondos en la cuenta…"
          aria-invalid={!!err} onChange={(e) => { setNota(e.target.value); setErr(""); }} style={{ ...field, resize: "none" }} />
        {err && <p role="alert" style={{ color: T.red, fontSize: 12, fontFamily: T.fontAlt, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <BarBtn label="Cancelar" onClick={onCancel} />
          <ActionBtn solid large label="Reprogramar" color={T.jade} icon={<CalendarClock size={15} />} disabled={busy} onClick={submit} />
        </div>
      </div>
    </ModalShell>
  );
};

type Destino = "solicitante" | "aplazar";

/**
 * Reportar un problema al ejecutar un pago aprobado. Reemplaza a Aclaración/Rechazar de la vista anterior:
 * rechazar es decisión de quien aprueba, no de quien ejecuta. Dos salidas, según quién puede resolverlo.
 */
export const ReportarProblemaModal: React.FC<{ req: Request; enPropuesta: boolean; busy: boolean; onConfirm: (destino: Destino, nota: string) => void; onCancel: () => void }> = ({ req, enPropuesta, busy, onConfirm, onCancel }) => {
  const [destino, setDestino] = useState<Destino>("solicitante");
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (nota.trim().length < 3) { setErr("Describe el problema."); return; }
    onConfirm(destino, nota.trim());
  };
  const opcion = (id: Destino, titulo: string, texto: string) => (
    <label key={id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${destino === id ? T.amber : T.cardBorder}`, background: destino === id ? T.amberFaint : "transparent" }}>
      <input type="radio" name="ej-destino" checked={destino === id} onChange={() => setDestino(id)} style={{ marginTop: 3, accentColor: T.amber }} />
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.fontAlt }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 12, color: T.textSub, fontFamily: T.fontAlt, lineHeight: 1.45, marginTop: 2 }}>{texto}</span>
      </span>
    </label>
  );
  return (
    <ModalShell labelledBy="ej-prob-title" onClose={onCancel} style={overlay}>
      <div style={box(T.amber)}>
        <div id="ej-prob-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 4 }}>Reportar problema en {req.id}</div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: "0 0 14px", lineHeight: 1.5 }}>El pago sale de «Por pagar». ¿Quién puede resolverlo?</p>
        <div role="radiogroup" aria-label="Destino del problema" style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {opcion("solicitante", "Datos incorrectos: al solicitante", "Monto, factura o beneficiario no coinciden. Recibe tu comentario y corrige; después Finanzas lo vuelve a incluir en una propuesta.")}
          {opcion("aplazar", "No se puede pagar ahora: aplazar", enPropuesta
            ? "Sale de la propuesta y vuelve a Planeación como solicitud abierta, para programarlo después."
            : "Vuelve a Planeación como solicitud abierta, para programarlo después.")}
        </div>
        <label style={label} htmlFor="ej-prob-nota">Qué pasa</label>
        <textarea id="ej-prob-nota" className="dp-input" rows={3} maxLength={500} value={nota} placeholder="Ej.: El monto de la factura es menor por una retención…"
          aria-invalid={!!err} onChange={(e) => { setNota(e.target.value); setErr(""); }} style={{ ...field, resize: "none" }} />
        {err && <p role="alert" style={{ color: T.red, fontSize: 12, fontFamily: T.fontAlt, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <BarBtn label="Cancelar" onClick={onCancel} />
          <ActionBtn large label={destino === "solicitante" ? "Enviar al solicitante" : "Aplazar pago"} color={T.amber} icon={<TriangleAlert size={15} />} disabled={busy} onClick={submit} />
        </div>
      </div>
    </ModalShell>
  );
};
