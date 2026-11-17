import { useCallback, useEffect, useRef, useState } from "react";
import { loadDecisionData } from "../../services/decision";
import type { Decision, PagoFlat } from "../../services/decision";
import { evalDecision } from "../decision/logic";

/** Lo que Decisión de Pagos sabe de una solicitud: vencimiento, monto en MXN y veredicto (OC + avance de proyecto). */
export interface Contexto {
  pago: PagoFlat;
  /** null mientras el cruce con OC/pronóstico no termina (sin él, "Revisar" sería un dato inventado). */
  decision: Decision | null;
}

export interface ContextoState {
  byId: Map<string, Contexto>;
  /** El cruce con OC y pronóstico terminó: los veredictos son reales. */
  crossReady: boolean;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

// Reutiliza el motor de Decisión de Pagos (mismo veredicto, misma caché de 20 min del cruce) para
// mostrar el contexto en Planeación; pide scope=abiertas porque aquí importan todas las sin pagar.
export function useDecisionContext(): ContextoState {
  const [byId, setById] = useState<Map<string, Contexto>>(new Map());
  const [crossReady, setCrossReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const alive = useRef(true);

  const run = useCallback((force: boolean) => {
    const build = (pagos: PagoFlat[], oc: Parameters<typeof evalDecision>[1] | null, fc: Parameters<typeof evalDecision>[2] | null) =>
      new Map(pagos.map((p): [string, Contexto] => [p.id, { pago: p, decision: oc && fc ? evalDecision(p, oc, fc) : null }]));

    loadDecisionData({
      scope: "abiertas",
      force,
      // Primero llegan los pagos (vencimiento, montos): se muestran ya, sin veredicto, mientras corre el cruce con NetSuite
      onPartial: (d) => { if (alive.current) setById(build(d.pagos, null, null)); },
    })
      .then((d) => {
        if (!alive.current) return;
        setById(build(d.pagos, d.oc_data, d.forecast_data));
        setCrossReady(true);
        setError(false);
      })
      .catch(() => { if (alive.current) setError(true); })
      .finally(() => { if (alive.current) setLoading(false); });
  }, []);

  useEffect(() => {
    alive.current = true;
    run(false);
    return () => { alive.current = false; };
  }, [run]);

  const reload = useCallback(() => { setLoading(true); setError(false); run(true); }, [run]);
  return { byId, crossReady, loading, error, reload };
}
