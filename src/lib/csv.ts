// Utilidades CSV compartidas (Explorador y Decisión de Pagos).

/**
 * Celda CSV segura. Los textos que empiezan con = + - @ se prefijan con ' para que Excel no los
 * ejecute como fórmula (beneficiarios y conceptos vienen de captura libre y de proveedores).
 * Los números se dejan tal cual, así un monto negativo legítimo no se altera.
 */
export const csvCell = (v: unknown): string => {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Descarga `content` como CSV UTF-8 con BOM (Excel respeta los acentos). */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const todayStamp = () => new Date().toISOString().slice(0, 10);
