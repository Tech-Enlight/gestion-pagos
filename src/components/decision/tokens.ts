// Tokens locales de Decisión de Pagos. Los hex reflejan los del design system (index.css)
// porque se concatenan con alpha (`${T.jade}40`), lo que no funciona con var(--...).
import type { DecisionColor } from "../../services/decision";

export const T = {
  jade: "#00AA85",
  jadeFaint: "rgba(0,170,133,0.14)",
  // Cerceta del DS (antes #3D7D9C, un azul que no existe en la paleta).
  steel: "#3D7D80",
  steelFaint: "rgba(61,125,128,0.14)",
  ink: "#293C47",
  red: "#ef4444",
  redFaint: "rgba(239,68,68,0.14)",
  amber: "#f59e0b",
  amberFaint: "rgba(245,158,11,0.14)",
  pageBg: "#121926",
  panelBg: "#1a2738",
  modalBg: "#1e2d3d",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  text: "rgba(255,255,255,0.9)",
  textSub: "rgba(255,255,255,0.7)",
  // 0.38 daba ~3:1 sobre el fondo oscuro; 0.6 pasa AA para texto chico.
  textMuted: "rgba(255,255,255,0.6)",
  font: "Alexandria, sans-serif",
  fontAlt: "Albert Sans, sans-serif",
};

/** Cifras: Albert Sans con dígitos tabulares (antes `monospace`, fuera del design system). */
export const NUM = { fontFamily: T.fontAlt, fontVariantNumeric: "tabular-nums" } as const;

export const DECISION_COLORS: Record<DecisionColor, { bg: string; text: string; dot: string }> = {
  verde: { bg: "rgba(0,170,133,0.14)", text: T.jade, dot: T.jade },
  rojo: { bg: "rgba(239,68,68,0.14)", text: T.red, dot: T.red },
  amarillo: { bg: "rgba(245,158,11,0.14)", text: T.amber, dot: T.amber },
};

// Acero (#293C47) se perdía sobre el fondo oscuro; gris del DS en su lugar.
export const OP_COLORS = ["#00AA85", "#3D7D80", "#828080", "#7c9dad", "#a0bbc8"];
