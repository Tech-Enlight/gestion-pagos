import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { T } from "./tokens";

// ─── MultiSelect dropdown ────────────────────────────────────
export interface MultiSelectProps {
  label: string;
  options: string[];
  selected: Set<string>;
  counts?: Record<string, number>;
  onChange: (updated: Set<string>) => void;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, counts, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => !search || o.toLowerCase().includes(search.toLowerCase()));

  const btnLabel =
    selected.size === 0 ? label :
    selected.size === 1 ? [...selected][0] :
    `${label}: ${selected.size}`;

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };

  const selectAll = () => { const next = new Set(selected); filtered.forEach((o) => next.add(o)); onChange(next); };
  const selectNone = () => {
    const next = new Set(selected);
    if (!search) { next.clear(); }
    else { filtered.forEach((o) => next.delete(o)); }
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative" }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button
        type="button"
        className="dp-trigger"
        data-active={selected.size > 0}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
      >
        {btnLabel}
        <ChevronDown size={12} style={{ opacity: 0.7 }} aria-hidden />
      </button>

      {open && (
        <div role="group" aria-label={`Filtrar por ${label.toLowerCase()}`} style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 220, maxWidth: 300,
        }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.cardBorder}` }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={`Buscar ${label.toLowerCase()}`}
              placeholder="Buscar…"
              style={{
                width: "100%", padding: "5px 8px", border: `1px solid ${T.cardBorder}`,
                borderRadius: 5, background: "rgba(255,255,255,0.06)", color: T.text,
                fontSize: 12, fontFamily: T.fontAlt, outline: "none",
              }}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${T.cardBorder}` }}>
            {["Todos", "Ninguno"].map((a) => (
              <button key={a} type="button" className="dp-barbtn" onClick={a === "Todos" ? selectAll : selectNone}
                style={{ padding: "3px 10px", fontSize: 11 }}>{a}</button>
            ))}
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "8px 12px", color: T.textMuted, fontSize: 12 }}>Sin resultados</div>
            )}
            {filtered.map((o) => (
              <label key={o} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", cursor: "pointer",
                background: selected.has(o) ? T.jadeFaint : "transparent",
                transition: "background 0.1s",
              }}>
                <input type="checkbox" checked={selected.has(o)} onChange={() => toggle(o)}
                  style={{ accentColor: T.jade, width: 13, height: 13, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontFamily: T.fontAlt, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o}</span>
                {counts?.[o] != null && (
                  <span style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontAlt }}>{counts[o]}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
