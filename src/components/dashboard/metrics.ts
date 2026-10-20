import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";

/**
 * Métricas del Panel general. Todo se deriva de `Request.statusHistory`
 * (timestamps reales del backend) — nada reconstruido con el estado de hoy.
 */

/** Etapas post-autorización que aún no se pagan (incluye `Approved` legacy). */
export const UNPAID_AFTER_AUTH: string[] = [
  STATUS.PENDING_FIN,
  STATUS.APPROVED,
  STATUS.PAYMENT_APPROVED,
];

/** Día local YYYY-MM-DD. toISOString() usa UTC y mueve a "mañana" los eventos de la tarde en México. */
export const localDay = (d: Date) => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const endOfLocalDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const toMXN = (r: Request, rate: number) =>
  r.currency === "USD" ? r.amount * rate : r.amount;

/** Monto realmente pagado en MXN; cae al estimado solo si el pago no registró T/C. */
export const paidMXN = (r: Request, rate: number) =>
  r.amountMXN ??
  (r.amountPaid && r.exchangeRateUsed ? r.amountPaid * r.exchangeRateUsed : toMXN(r, rate));

const history = (r: Request) => r.statusHistory ?? [];

/** Momento en que la solicitud pasó a Paid (último evento Paid). */
export const paidAt = (r: Request): Date | null => {
  const ev = [...history(r)].reverse().find((h) => h.status === STATUS.PAID);
  return ev ? new Date(ev.timestamp) : null;
};

/** Primer evento del historial; cae a `date` (solo día) si no hay historial. */
export const createdAt = (r: Request): Date | null => {
  const first = history(r)[0];
  if (first) return new Date(first.timestamp);
  return r.date ? new Date(`${r.date}T00:00:00`) : null;
};

/** Estado de la solicitud al cierre de `day`; null si todavía no existía. */
export const statusAtEndOf = (r: Request, day: Date): string | null => {
  const limit = endOfLocalDay(day).getTime();
  let status: string | null = null;
  for (const h of history(r)) {
    if (new Date(h.timestamp).getTime() <= limit) status = h.status;
    else break;
  }
  return status;
};

const lastNDays = (n: number, today = new Date()) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });

/** Monto MXN en `statuses` al cierre de cada uno de los últimos n días. */
export const queueAmountSeries = (
  requests: Request[],
  statuses: string[],
  rate: number,
  n = 12
): number[] =>
  lastNDays(n).map((day) =>
    requests.reduce((sum, r) => {
      const s = statusAtEndOf(r, day);
      return s && statuses.includes(s) ? sum + toMXN(r, rate) : sum;
    }, 0)
  );

export interface PaidMonth {
  /** Pagado del día 1 a hoy del mes en curso. */
  current: number;
  /** Pagado del día 1 al mismo día del mes anterior (comparación justa a mitad de mes). */
  previousSamePeriod: number;
  /** Acumulado diario del mes en curso (para el sparkline). */
  cumulativeByDay: number[];
}

export const paidThisMonth = (requests: Request[], rate: number, now = new Date()): PaidMonth => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const prevStart = new Date(y, m - 1, 1);
  const daily = new Array<number>(today).fill(0);
  let previousSamePeriod = 0;

  for (const r of requests) {
    const at = paidAt(r);
    if (!at) continue;
    const amount = paidMXN(r, rate);
    if (at.getFullYear() === y && at.getMonth() === m && at.getDate() <= today) {
      daily[at.getDate() - 1] += amount;
    } else if (
      at.getFullYear() === prevStart.getFullYear() &&
      at.getMonth() === prevStart.getMonth() &&
      at.getDate() <= today
    ) {
      previousSamePeriod += amount;
    }
  }

  let acc = 0;
  const cumulativeByDay = daily.map((v) => (acc += v));
  return { current: acc, previousSamePeriod, cumulativeByDay };
};

/** Días promedio de la primera captura al pago, de lo pagado en los últimos `windowDays`. */
export const avgCycleDays = (requests: Request[], windowDays = 30, minSamples = 3, now = new Date()) => {
  const since = now.getTime() - windowDays * 86_400_000;
  const days = requests.flatMap((r) => {
    const paid = paidAt(r);
    const start = createdAt(r);
    if (!paid || !start || paid.getTime() < since) return [];
    return [(paid.getTime() - start.getTime()) / 86_400_000];
  });
  if (days.length < minSamples) return null;
  return days.reduce((a, b) => a + b, 0) / days.length;
};

/** Tasa de rechazo sobre solicitudes ya enviadas (los borradores no cuentan). */
export const rejectionRate = (requests: Request[]) => {
  const sent = requests.filter((r) => r.status !== STATUS.DRAFT);
  if (sent.length === 0) return null;
  const rejected = sent.filter((r) => r.status === STATUS.REJECTED).length;
  return (rejected / sent.length) * 100;
};
