import { useEffect, useState } from "react";
import { fetchPropuestas } from "../../services/sheets";
import type { Role } from "../../types/auth";
import { esperaA } from "./logic";

export interface PropuestasPendientes {
  /** Propuestas que esperan una acción de este rol (aprobar o devolver en su nivel). */
  count: number;
  /** Solicitudes contenidas en esas propuestas (alimenta la cola del Panel general). */
  requestIds: Set<string>;
}

const VACIO: PropuestasPendientes = { count: 0, requestIds: new Set() };

/** Una sola lectura al montar; solo se pide si `enabled` (flujo de propuestas activo). */
export function usePropuestasPendientes(role: Role | undefined, enabled: boolean): PropuestasPendientes {
  const [state, setState] = useState<PropuestasPendientes>(VACIO);
  useEffect(() => {
    if (!enabled || !role) return;
    let alive = true;
    fetchPropuestas()
      .then((ps) => {
        if (!alive) return;
        const esperan = ps.filter((p) => esperaA(role, p));
        setState({ count: esperan.length, requestIds: new Set(esperan.flatMap((p) => p.items.map((i) => i.requestId))) });
      })
      .catch(() => { /* sin propuestas: el Panel muestra 0 en vez de romperse */ });
    return () => { alive = false; };
  }, [role, enabled]);
  return state;
}
