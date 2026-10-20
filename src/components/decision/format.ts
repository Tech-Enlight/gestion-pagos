// Formateadores compartidos de la vista Decisión de Pagos.

export const fmtN = (n: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(Math.round(n));

export const fmtMXN = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—";
  return "$" + fmtN(n);
};

export const fmtMXNk = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(0) + "k";
  return fmtMXN(n);
};

export const fmtPct = (n: number) => (n * 100).toFixed(1) + "%";

// Cola vacía → total 0 → a/0 daba NaN%. Una proporción sin base es 0, no un número roto.
export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export const fmtFecha = (s: string | null | undefined) => {
  if (!s) return "—";
  try {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return s;
  }
};

export const fmtMoney = (v: number | null | undefined, moneda?: string) => {
  if (v == null || isNaN(v)) return "—";
  const prefix = moneda === "USD" || moneda === "MXN" ? "$" : "";
  return prefix + Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
