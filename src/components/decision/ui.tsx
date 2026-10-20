import React, { useEffect } from "react";
import { T, NUM } from "./tokens";
import "./decision.css";

/** Cierra con Esc (modales y paneles). `onClose` debe ser estable o el listener se reengancha en cada render. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

const accent = (color: string) => ({ "--dp-c": color }) as React.CSSProperties;

export const Chip = ({ label, color, bg, title }: { label: string; color: string; bg: string; title?: string }) => (
  <span title={title} style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: T.fontAlt,
    fontWeight: 600, color, background: bg, letterSpacing: "0.01em",
  }}>{label}</span>
);

export const ActionBtn: React.FC<{ label: string; color: string; onClick: () => void; disabled?: boolean; icon?: React.ReactNode; title?: string }> = ({ label, color, onClick, disabled, icon, title }) => (
  <button type="button" className="dp-btn" onClick={onClick} disabled={disabled} title={title} style={accent(color)}>
    {icon}{label}
  </button>
);

export const ExpBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "10px 12px" }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, fontFamily: T.font, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

export const ExpField: React.FC<{ label: string; value: string; mono?: boolean; bold?: boolean; href?: string | null }> = ({ label, value, mono, bold, href }) => {
  const font = mono ? NUM : { fontFamily: T.fontAlt };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }}>
      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, flexShrink: 0 }}>{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 12, color: T.jade, ...font,
            fontWeight: bold ? 700 : 400, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis",
            textDecoration: "underline",
          }}
        >{value}</a>
      ) : (
        <span style={{
          fontSize: 12, color: T.text, ...font,
          fontWeight: bold ? 700 : 400, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis",
        }}>{value}</span>
      )}
    </div>
  );
};

export const StatusBadge: React.FC<{ estatus: string }> = ({ estatus }) => {
  const e = (estatus || "").toLowerCase();
  const c = e === "aprobada" ? T.jade : e === "rechazada" ? T.red : T.amber;
  const bg = e === "aprobada" ? T.jadeFaint : e === "rechazada" ? T.redFaint : T.amberFaint;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, background: bg, color: c, fontSize: 11, fontWeight: 600, fontFamily: T.fontAlt }}>
      {estatus || "Sin estatus"}
    </span>
  );
};

export const CrossBlock: React.FC<{ title: string; badge?: React.ReactNode; children: React.ReactNode }> = ({ title, badge, children }) => (
  <div style={{
    background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "10px 12px",
    border: `1px solid ${T.cardBorder}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, fontFamily: T.font, textTransform: "uppercase", letterSpacing: "0.1em" }}>{title}</div>
      {badge}
    </div>
    {children}
  </div>
);

// ─── KPI Strip ───────────────────────────────────────────────
export const KPICard: React.FC<{ label: string; value: string; sub?: string; accentColor?: string }> = ({ label, value, sub, accentColor = T.jade }) => (
  <div style={{
    flex: 1, minWidth: 140, padding: "14px 16px",
    background: T.cardBg, border: `1px solid ${T.cardBorder}`,
    borderRadius: 8,
  }}>
    <div style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: accentColor, ...NUM, letterSpacing: "-0.02em" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2 }}>{sub}</div>}
  </div>
);

// ─── Shared table helpers ────────────────────────────────────
export const SectionCard: React.FC<{ title: string; meta?: string; children: React.ReactNode }> = ({ title, meta, children }) => (
  <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px", marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.font }}>{title}</div>
      {meta && <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{meta}</div>}
    </div>
    {children}
  </div>
);

export const TotalRow: React.FC<{ cells: { value: string; align?: "left" | "right"; bold?: boolean; color?: string }[] }> = ({ cells }) => (
  <tr style={{ borderTop: `1px solid ${T.cardBorder}`, background: "rgba(255,255,255,0.03)" }}>
    {cells.map((c, i) => (
      <td key={i} style={{
        padding: "10px 12px", textAlign: c.align || "right",
        fontSize: 13, ...NUM, fontWeight: c.bold ? 700 : 400,
        color: c.color || T.text,
      }}>{c.value}</td>
    ))}
  </tr>
);

export const StatItem: React.FC<{ label: string; value: string; mono?: boolean; color?: string; sub?: string }> = ({ label, value, mono, color, sub }) => (
  <div>
    <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: color || T.text, ...(mono ? NUM : { fontFamily: T.font, fontVariantNumeric: "tabular-nums" }) }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt }}>{sub}</div>}
  </div>
);

export const BarBtn: React.FC<{ label: string; onClick: () => void; primary?: boolean; icon?: React.ReactNode; ariaLabel?: string }> = ({ label, onClick, primary, icon, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className={`dp-barbtn${primary ? " dp-barbtn--primary" : ""}${label ? "" : " dp-barbtn--icon"}`}
  >
    {icon}{label}
  </button>
);

// ─── Pill filter button ──────────────────────────────────────
export const PillBtn: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string }> = ({ label, active, onClick, color }) => (
  <button type="button" className="dp-pill" aria-pressed={active} onClick={onClick} style={color ? accent(color) : undefined}>
    {label}
  </button>
);
