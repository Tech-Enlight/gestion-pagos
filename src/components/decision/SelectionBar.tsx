import React from "react";
import { CheckCircle2, HelpCircle, XCircle, Download, Copy, X } from "lucide-react";
import type { PagoFlat } from "../../services/decision";
import { T } from "./tokens";
import { fmtMXN } from "./format";
import { canDecideOn } from "./logic";
import { ActionBtn, BarBtn, StatItem } from "./ui";

// ─── Selection bar ───────────────────────────────────────────
export interface SelBarProps {
  selected: Set<string>;
  pagos: PagoFlat[];
  onClear: () => void;
  onViewSelected: () => void;
  onExportCSV: () => void;
  onCopyClipboard: () => void;
  canDecide?: boolean;
  actionBusy?: boolean;
  crossReady: boolean;
  /** Ids que el filtro actual deja a la vista; la selección puede incluir otros que quedaron ocultos. */
  visibleIds: Set<string>;
  onApproveIds?: (ids: string[]) => void;
  onClarifyIds?: (ids: string[]) => void;
  onRejectIds?: (ids: string[]) => void;
}

export const SelectionBar: React.FC<SelBarProps> = ({
  selected, pagos, onClear, onViewSelected, onExportCSV, onCopyClipboard,
  canDecide, actionBusy, crossReady, visibleIds, onApproveIds, onClarifyIds, onRejectIds,
}) => {
  const sel = pagos.filter((p) => selected.has(p.id));
  if (sel.length === 0) return null;
  const hidden = sel.filter((p) => !visibleIds.has(p.id)).length;

  // Las acciones masivas aplican solo a los elegibles por estatus dentro de la selección
  const decidibles = sel.filter(canDecideOn).map((p) => p.id);

  const total = sel.reduce((s, p) => s + p.total_mxn, 0);
  const propTotal = sel.filter((p) => p.propuesta_bucket === "Propuesta").reduce((s, p) => s + p.total_mxn, 0);
  const aplazTotal = sel.filter((p) => p.propuesta_bucket === "Aplazado").reduce((s, p) => s + p.total_mxn, 0);
  const nProp = sel.filter((p) => p.propuesta_bucket === "Propuesta").length;
  const nAplaz = sel.filter((p) => p.propuesta_bucket === "Aplazado").length;

  return (
    <div className="dp-selbar" role="region" aria-label="Pagos seleccionados">
      <div style={{ display: "flex", gap: "8px 20px", flexWrap: "wrap" }}>
        <StatItem
          label="Seleccionados" value={`${sel.length} pagos`}
          sub={hidden > 0 ? `${hidden} fuera de la vista (filtros)` : undefined}
          color={hidden > 0 ? T.amber : undefined}
        />
        <StatItem label="Suma total" value={fmtMXN(total)} mono />
        <StatItem label="Propuesta" value={fmtMXN(propTotal)} mono color={T.jade} sub={`${nProp} pagos`} />
        <StatItem label="Aplazado" value={fmtMXN(aplazTotal)} mono color={T.steel} sub={`${nAplaz} pagos`} />
      </div>
      <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {canDecide && decidibles.length > 0 && (
          <>
            <ActionBtn
              label={`Aprobar (${decidibles.length})`} color={T.jade} disabled={actionBusy || !crossReady} icon={<CheckCircle2 size={13} />}
              title={crossReady ? undefined : "Espera a que termine el cruce con OC y pronóstico"}
              onClick={() => onApproveIds?.(decidibles)}
            />
            <ActionBtn label={`Aclaración (${decidibles.length})`} color={T.amber} disabled={actionBusy} icon={<HelpCircle size={13} />} onClick={() => onClarifyIds?.(decidibles)} />
            <ActionBtn label={`Rechazar (${decidibles.length})`} color={T.red} disabled={actionBusy} icon={<XCircle size={13} />} onClick={() => onRejectIds?.(decidibles)} />
            <div style={{ width: 1, alignSelf: "stretch", background: T.cardBorder }} />
          </>
        )}
        <BarBtn label="Ver selección" onClick={onViewSelected} />
        <BarBtn label="Exportar CSV" onClick={onExportCSV} primary icon={<Download size={13} />} />
        <BarBtn label="Copiar" onClick={onCopyClipboard} icon={<Copy size={13} />} />
        <BarBtn label="" ariaLabel="Limpiar selección" onClick={onClear} icon={<X size={13} aria-hidden />} />
      </div>
    </div>
  );
};
