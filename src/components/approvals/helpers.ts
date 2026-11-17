import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";

const DAY = 86_400_000;

/** Desde cuándo espera autorización: último ingreso a "Autorización" (un re-envío tras aclaración reinicia el reloj). */
export function waitingSince(r: Request): number {
  const ev = [...(r.statusHistory || [])].reverse().find((e) => e.status === STATUS.AUTORIZACION);
  const t = ev ? Date.parse(ev.timestamp) : Date.parse(`${r.date}T12:00:00`);
  return Number.isFinite(t) ? t : Date.now();
}

/** Días calendario completos esperando. Nunca negativo (relojes desfasados). */
export function waitingDays(r: Request, now = Date.now()): number {
  return Math.max(0, Math.floor((now - waitingSince(r)) / DAY));
}

export function waitingLabel(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

/** A partir de cuántos días la espera se marca como atención (no es un SLA oficial, solo una pista visual). */
export const STALE_DAYS = 3;

/** Totales por divisa: nunca se suman divisas distintas entre sí. */
export function totalsByCurrency(rs: Request[]): { currency: string; total: number }[] {
  const t = new Map<string, number>();
  for (const r of rs) t.set(r.currency || "MXN", (t.get(r.currency || "MXN") || 0) + (Number(r.amount) || 0));
  return [...t.entries()].map(([currency, total]) => ({ currency, total }));
}

export const money = (n: number) =>
  "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const totalsText = (rs: Request[]) =>
  totalsByCurrency(rs).map((t) => `${money(t.total)} ${t.currency}`).join(" + ");
