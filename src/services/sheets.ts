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
  extra?: {
    comment?: string;
    rejectReason?: string;
    clarificationRequest?: string;
    clarificationResponse?: string;
  }
): Promise<void> {
  const res = await fetch(`${BASE}/solicitudes/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, changedBy, ...extra }),
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

export async function fetchProjects(): Promise<any[]> {
  const res = await fetch(`${BASE}/lista-proyectos-completos`);
  if (!res.ok) throw new Error("Error al cargar proyectos");
  const data = await res.json();
  return data.proj_list || [];
}

export async function fetchOCsByProject(projectId: string): Promise<any> {
  const res = await fetch(`${BASE}/ocs-por-proyecto?projectId=${projectId}`);
  if (!res.ok) throw new Error("Error al cargar OCs");
  return res.json();
}

export async function fetchVendorName(vendorId: string): Promise<any> {
  const res = await fetch(`${BASE}/vendor-name?id=${vendorId}`);
  if (!res.ok) throw new Error("Error al cargar vendor");
  return res.json();
}

/* ---------- NetSuite: bills por OC ---------- */

function normalizeCurrency(nsCurrency: string): string {
  const map: Record<string, string> = {
    "US Dollar": "USD",
    "Mexican Peso": "MXN",
    "Canadian Dollar": "CAD",
    "Euro": "EUR",
  };
  return map[nsCurrency] ?? nsCurrency;
}

export interface NSBill {
  bill_id: string;
  bill_number: string;
  bill_date: string;
  bill_total: number;
  bill_status: string;
  currency: string;          // normalized to USD/MXN
  exchange_rate: number;
  account: string;
  subsidiary: string;
  memo: string;
  is_paid: boolean;
  payment_date: string | null;
  payment_amount: number | null;
  payment_count: number;
}

export interface NSBillsResponse {
  bills: NSBill[];
  summary: {
    total_bills: number;
    total_billed: number;
    paid_count: number;
    paid_total: number;
    open_count: number;
    open_total: number;
  };
}

export async function fetchBillsByOC(
  poInternalId: string
): Promise<NSBillsResponse> {
  const res = await fetch(
    `${BASE}/pagos-por-oc?poInternalId=${encodeURIComponent(poInternalId)}`
  );
  if (!res.ok) throw new Error("Error al cargar pagos de NS");
  const data = await res.json();

  // Normalize currency on each bill
  data.bills = (data.bills || []).map((b: any) => ({
    ...b,
    currency: normalizeCurrency(b.currency),
  }));

  return data as NSBillsResponse;
}