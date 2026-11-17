import { STATUS } from "../../data/mockData";
import type { Request } from "../../data/mockData";
import type { Propuesta, PropuestaEstado, PropuestaHistorial } from "../../types/propuestas";
import type { Role } from "../../types/auth";

/** Solicitudes que todavía pueden entrar a una propuesta: cualquier etapa previa al pago, no devueltas ni cerradas. */
export const OPEN_STATUSES: string[] = [STATUS.SOLICITADA, STATUS.AUTORIZACION, STATUS.PENDING_FIN, STATUS.APPROVED, STATUS.PAYMENT_APPROVED];
export const isOpen = (r: Request) => OPEN_STATUSES.includes(r.status);

export const isActive = (p: Propuesta) => p.estado !== "Cancelada";

/** requestId → id de la propuesta activa que ya lo contiene (una solicitud solo puede estar en una). */
export function takenBy(propuestas: Propuesta[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of propuestas) if (isActive(p)) for (const it of p.items) m.set(it.requestId, p.id);
  return m;
}

export function candidatesOf(requests: Request[], propuestas: Propuesta[]): Request[] {
  const taken = takenBy(propuestas);
  return requests.filter((r) => isOpen(r) && !taken.has(r.id));
}

export const ESTADOS_FLUJO: { id: PropuestaEstado; label: string; hint: string }[] = [
  { id: "Borrador", label: "Borrador", hint: "Finanzas la arma" },
  { id: "Nivel 1", label: "Nivel 1", hint: "Dirección" },
  { id: "Nivel 2", label: "Nivel 2", hint: "Operaciones y PMO" },
  { id: "Aprobada", label: "Aprobada", hint: "Lista para pagar" },
];

// Mismos grupos que valida n8n (Code: Validar Propuesta Evento): la UI solo decide qué mostrar,
// el servidor es quien realmente autoriza. superadmin entra a todos (pruebas/soporte).
export const GRUPOS: Record<"planner" | "n1" | "n2", Role[]> = {
  planner: ["analista_contable", "superadmin"],
  n1: ["admin", "superadmin"],
  n2: ["mac", "operaciones", "ingenieria", "servicios", "pmo", "superadmin"],
};
export const ROLES_PLANEACION: Role[] = [...new Set([...GRUPOS.planner, ...GRUPOS.n1, ...GRUPOS.n2])];

export interface Caps {
  /** Puede crear/enviar/retirar/cancelar (Finanzas). */
  planner: boolean;
  /** Puede quitar/agregar pagos y cambiar fechas en el estado actual. */
  editar: boolean;
  /** Puede aprobar (y devolver) en el estado actual. */
  aprobar: boolean;
}

export function capsFor(role: Role | undefined, estado: PropuestaEstado | undefined): Caps {
  const en = (g: keyof typeof GRUPOS) => !!role && GRUPOS[g].includes(role);
  const nivel = estado === "Nivel 1" ? "n1" : estado === "Nivel 2" ? "n2" : null;
  return {
    planner: en("planner"),
    editar: estado === "Borrador" ? en("planner") : nivel ? en(nivel) : false,
    aprobar: nivel ? en(nivel) : false,
  };
}

/** Propuestas que esperan una acción de este rol (para abrir directo la que le toca). */
export const esperaA = (role: Role | undefined, p: Propuesta) => capsFor(role, p.estado).aprobar;

/** Solicitudes de una propuesta aprobada que aún no quedaron listas en Finanzas (la sincronización pudo fallar). */
export function pendientesDeSync(p: Propuesta, byId: Map<string, Request>): string[] {
  if (p.estado !== "Aprobada") return [];
  const SINC = [STATUS.PAYMENT_APPROVED, STATUS.PAID];
  return p.items
    .map((it) => byId.get(it.requestId))
    .filter((r): r is Request => !!r && isOpen(r) && !SINC.includes(r.status as never))
    .map((r) => r.id);
}

/** Frase legible para el historial de actividad. */
export function describeEvento(h: PropuestaHistorial): string {
  const f = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  switch (h.evento) {
    case "crear": return "creó la propuesta";
    case "agregar": return `agregó ${h.requestId}`;
    case "quitar": return `quitó ${h.requestId}`;
    case "fecha": return `movió ${h.requestId} al ${h.fechaProgramada ? f(h.fechaProgramada) : "otra fecha"}`;
    case "enviar": return "envió la propuesta a aprobación";
    case "retirar": return "retiró la propuesta";
    case "cancelar": return "canceló la propuesta";
    case "aprobar": return "aprobó la propuesta";
    case "devolver": return `la devolvió a Finanzas${h.nota ? `: «${h.nota}»` : ""}`;
    case "sincronizar": return "sincronizó los pagos con Finanzas";
    default: return h.evento;
  }
}

/** Fecha local YYYY-MM-DD (toISOString la correría un día en la tarde-noche de México). */
export function localISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Próximo viernes (hoy si ya es viernes): sugerencia de corte; el usuario siempre puede cambiarla. */
export function nextFridayISO(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return localISO(d);
}

export function defaultNombre(fechaCorte: string): string {
  const d = new Date(`${fechaCorte}T12:00:00`);
  const t = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `Pagos del ${t}`;
}
