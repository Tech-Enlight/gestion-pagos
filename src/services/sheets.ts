import type { Role } from "../types/auth";
import type { Request } from "../data/mockData";

const BASE = import.meta.env.VITE_N8N_WEBHOOK_BASE;

/**
 * Ensures the payload only contains primitive values.
 * n8n / Google Sheets struggles with nested objects/arrays in a single row.
 */
function cleanPayload<T extends object>(data: T): Partial<T> {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || typeof value !== "object") {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function getRoleByEmail(email: string): Promise<Role> {
  try {
    const res = await fetch(`${BASE}/role?email=${encodeURIComponent(email)}`);
    if (!res.ok) return "solicitante";
    const data = await res.json();
    return (data.role as Role) ?? "solicitante";
  } catch {
    return "solicitante";
  }
}

export async function fetchRequests(): Promise<Request[]> {
  const res = await fetch(`${BASE}/solicitudes`);
  if (!res.ok) throw new Error("Error al cargar solicitudes");
  return res.json();
}

export async function createRequest(data: Partial<Request>): Promise<Request> {
  // Clean payload to ensure no nested objects (like statusHistory) are sent
  const payload = cleanPayload(data);

  const res = await fetch(`${BASE}/solicitudes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error al crear solicitud");
  return res.json();
}

export async function updateRequestStatus(
  id: string,
  status: string,
  changedBy: string,
  comment?: string
): Promise<void> {
  const res = await fetch(`${BASE}/solicitudes/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, changedBy, comment }),
  });
  if (!res.ok) throw new Error("Error al actualizar status");
}

export async function updateFinanceFields(
  id: string,
  fields: Record<string, any>
): Promise<void> {
  // Clean fields to ensure no nested objects are sent
  const cleanedFields = cleanPayload(fields);

  const res = await fetch(`${BASE}/solicitudes/finanzas`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...cleanedFields }),
  });
  if (!res.ok) throw new Error("Error al actualizar finanzas");
}

export async function fetchExchangeRates(): Promise<
  { date: string; rate: number }[]
> {
  const res = await fetch(`${BASE}/tipo-cambio`);
  if (!res.ok) throw new Error("Error al cargar tipo de cambio");
  return res.json();
}
