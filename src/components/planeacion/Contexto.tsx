import React from "react";
import { T, DECISION_COLORS } from "../decision/tokens";
import { Chip } from "../decision/ui";
import type { Contexto } from "./useDecisionContext";

/** Veredicto de Decisión de Pagos (Procede / Revisar / Bloquear) con sus motivos como tooltip. */
export const VeredictoChip: React.FC<{ ctx?: Contexto; cargando: boolean }> = ({ ctx, cargando }) => {
  if (!ctx) return cargando ? <span style={{ fontSize: 11, color: T.textMuted }}>Calculando…</span> : null;
  if (!ctx.decision) return <span style={{ fontSize: 11, color: T.textMuted }}>Calculando…</span>;
  const c = DECISION_COLORS[ctx.decision.color];
  return <Chip label={ctx.decision.label} color={c.text} bg={c.bg} title={ctx.decision.reasons.join(" · ")} />;
};

/** "Vence en 3 d" / "Vencida hace 2 d": el color sube con la urgencia. Sin fecha, se dice. */
export const VencTexto: React.FC<{ ctx?: Contexto }> = ({ ctx }) => {
  if (!ctx) return null;
  const d = ctx.pago.venc_dias;
  let text = "Sin fecha de vencimiento";
  let color: string = T.textMuted;
  if (d != null) {
    if (d < 0) { text = `Vencida hace ${-d} ${-d === 1 ? "día" : "días"}`; color = T.red; }
    else if (d === 0) { text = "Vence hoy"; color = T.amber; }
    else if (d === 1) { text = "Vence mañana"; color = T.amber; }
    else { text = `Vence en ${d} días`; color = d <= 7 ? T.amber : T.textMuted; }
  }
  return <span style={{ fontSize: 11, fontWeight: 500, color, fontFamily: T.fontAlt }}>{text}</span>;
};
