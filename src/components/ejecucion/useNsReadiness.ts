import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBillsByOC } from "../../services/sheets";
import type { NSBill } from "../../services/sheets";
import type { Request } from "../../data/mockData";
import { clasificarNs } from "./logic";
import type { NsEstado } from "./logic";

// Cada consulta a NetSuite es una ejecución de n8n con varias SuiteQL: se cachea por OC (sobrevive a salir y
// volver a la vista) y se consulta con poca concurrencia. La pantalla solo pide automáticamente lo vencido y lo de
// hoy; el resto bajo demanda.
const TTL_MS = 10 * 60 * 1000;
const CONCURRENCIA = 3;
const cache = new Map<string, { at: number; bills: NSBill[] }>();

async function billsDe(oc: string): Promise<NSBill[]> {
  const hit = cache.get(oc);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.bills;
  const data = await fetchBillsByOC(oc);
  cache.set(oc, { at: Date.now(), bills: data.bills });
  return data.bills;
}

export interface NsReadiness {
  estado: Record<string, NsEstado>;
  checking: boolean;
  /** Consulta NetSuite para estas solicitudes (las que ya tienen resultado fresco no se vuelven a pedir). */
  check: (reqs: Request[]) => Promise<void>;
  /** Olvida lo leído (después de marcar un pago, los pagos "libres" cambian). */
  reset: () => void;
}

export function useNsReadiness(claimed: Set<string>): NsReadiness {
  const [estado, setEstado] = useState<Record<string, NsEstado>>({});
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  const claimedRef = useRef(claimed);
  const hecho = useRef(new Set<string>());

  useEffect(() => { claimedRef.current = claimed; }, [claimed]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const check = useCallback(async (reqs: Request[]) => {
    const pend = reqs.filter((r) => !hecho.current.has(r.id));
    if (pend.length === 0) return;
    pend.forEach((r) => hecho.current.add(r.id));
    await Promise.resolve(); // los setState van después de este punto, no en el cuerpo síncrono del efecto que llama
    if (alive.current) setChecking(true);
    const cola = [...pend];
    const worker = async () => {
      for (let r = cola.shift(); r; r = cola.shift()) {
        let res: NsEstado;
        if (!r.nsOcInternalId) res = { tipo: "sin_oc" };
        else {
          try { res = clasificarNs(await billsDe(r.nsOcInternalId), r, claimedRef.current); }
          catch { res = { tipo: "error" }; hecho.current.delete(r.id); } // un fallo se puede reintentar
        }
        if (alive.current) setEstado((prev) => ({ ...prev, [r.id]: res }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, pend.length) }, worker));
    if (alive.current) setChecking(false);
  }, []);

  const reset = useCallback(() => { cache.clear(); hecho.current.clear(); setEstado({}); }, []);
  return { estado, checking, check, reset };
}
