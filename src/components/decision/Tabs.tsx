import React, { useMemo } from "react";
import {
  BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { DecisionData } from "../../services/decision";
import { T, NUM, OP_COLORS } from "./tokens";
import { fmtN, fmtMXN, fmtPct, ratio } from "./format";
import { SectionCard, TotalRow } from "./ui";

// ─── Tab: Resumen ────────────────────────────────────────────
export const TabResumen: React.FC<{ data: DecisionData }> = ({ data }) => {
  const { resumen_op, kpis } = data;
  const total = kpis.total_general;

  return (
    <div>
      <div className="dp-grid-2" style={{ marginBottom: 20 }}>
        {/* Donut: distribution by operation */}
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 12 }}>Distribución por categoría de operación</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={resumen_op} dataKey="total" cx="45%" cy="50%" outerRadius={75} innerRadius={45} paddingAngle={2}>
                {resumen_op.map((_, i) => <Cell key={i} fill={OP_COLORS[i % OP_COLORS.length]} stroke="transparent" />)}
              </Pie>
              <Tooltip
                formatter={(v: any) => [`$${fmtN(v)} (${(ratio(v, total) * 100).toFixed(1)}%)`, ""]}
                contentStyle={{ background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, fontFamily: T.fontAlt }}
                labelStyle={{ color: T.text }}
                itemStyle={{ color: T.textSub }}
              />
              <Legend
                formatter={(v) => <span style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{v}</span>}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stacked bar: propuesta vs aplazado */}
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 12 }}>Propuesta vs Aplazado por operación</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={resumen_op} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: T.textMuted, fontSize: 11, fontFamily: T.fontAlt }}
                tickFormatter={(v) => "$" + (v / 1_000_000).toFixed(1) + "M"} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="operacion" tick={{ fill: T.textSub, fontSize: 11, fontFamily: T.fontAlt }}
                width={90} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any, name) => [`$${fmtN(v)}`, name]}
                contentStyle={{ background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, fontFamily: T.fontAlt }}
                labelStyle={{ color: T.text }}
                itemStyle={{ color: T.textSub }}
              />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{v}</span>} />
              <Bar dataKey="propuesta" name="Propuesta" stackId="a" fill={T.jade} radius={0} />
              <Bar dataKey="aplazado" name="Aplazado" stackId="a" fill={T.steel} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: resumen by operation */}
      <SectionCard title="Resumen por Operación" meta="MXN">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Categoría", "Aplazado", "Propuesta", "Total", "% del total"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Categoría" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumen_op.map((r) => (
                <tr key={r.operacion} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "9px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt, fontWeight: 500 }}>{r.operacion}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: T.steel, ...NUM }}>{fmtMXN(r.aplazado)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: T.jade, ...NUM }}>{fmtMXN(r.propuesta)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: T.text, ...NUM, fontWeight: 700 }}>{fmtMXN(r.total)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{fmtPct(ratio(r.total, total))}</td>
                </tr>
              ))}
              <TotalRow cells={[
                { value: "Total general", align: "left", bold: true },
                { value: fmtMXN(kpis.total_aplazado), color: T.steel },
                { value: fmtMXN(kpis.total_propuesta), color: T.jade },
                { value: fmtMXN(total), bold: true },
                { value: "100.0%" },
              ]} />
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Table: providers by category */}
      <SectionCard title="Detalle de Proveedores" meta="MXN · jerarquía proveedor">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Proveedor", "Aplazado", "Propuesta", "Total"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Proveedor" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resumen_prov.slice(0, 20).map((r) => (
                <tr key={r.nombre_display} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: T.text, fontFamily: T.fontAlt }}>{r.nombre_display}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.steel, ...NUM }}>{fmtMXN(r.aplazado)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.jade, ...NUM }}>{fmtMXN(r.propuesta)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.text, ...NUM, fontWeight: 600 }}>{fmtMXN(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Proveedores ────────────────────────────────────────
export const TabProveedores: React.FC<{ data: DecisionData }> = ({ data }) => {
  const total = data.kpis.total_general;
  const arr = useMemo(() => {
    const map: Record<string, { nombre: string; pagos: number; propuesta: number; aplazado: number; total: number }> = {};
    data.pagos.forEach((p) => {
      const k = p.benef_clean || p.beneficiario || "Sin proveedor";
      if (!map[k]) map[k] = { nombre: k, pagos: 0, propuesta: 0, aplazado: 0, total: 0 };
      map[k].pagos++;
      map[k].total += p.total_mxn;
      if (p.propuesta_bucket === "Aplazado") map[k].aplazado += p.total_mxn;
      else if (p.propuesta_bucket === "Propuesta") map[k].propuesta += p.total_mxn;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [data.pagos]);
  let acc = 0;

  return (
    <SectionCard title="Concentración por proveedor" meta={`${arr.length} proveedores · MXN`}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Proveedor", "# pagos", "Propuesta", "Aplazado", "Total", "% acumulado"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Proveedor" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {arr.map((r, i) => {
              acc += r.total;
              const pctAcc = ratio(acc, total);
              return (
                <tr key={r.nombre} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt }}>{i + 1}. {r.nombre}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub, fontFamily: T.fontAlt }}>{r.pagos}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.jade, ...NUM }}>{fmtMXN(r.propuesta)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.steel, ...NUM }}>{fmtMXN(r.aplazado)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, color: T.text, ...NUM, fontWeight: 700 }}>{fmtMXN(r.total)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <div style={{ height: 4, width: Math.max(4, pctAcc * 80), background: T.jade, borderRadius: 2, opacity: 0.7 }} />
                      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, whiteSpace: "nowrap" }}>{fmtPct(pctAcc)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

// ─── Tab: Clientes ───────────────────────────────────────────
export const TabClientes: React.FC<{ data: DecisionData }> = ({ data }) => {
  const total = data.kpis.total_general;

  const { cliArr, bankArr } = useMemo(() => {
    const cliMap: Record<string, { nombre: string; pagos: number; propuesta: number; aplazado: number; total: number }> = {};
    const bankMap: Record<string, { nombre: string; pagos: number; total: number }> = {};
    data.pagos.forEach((p) => {
      const ck = p.cliente || "Sin cliente";
      if (!cliMap[ck]) cliMap[ck] = { nombre: ck, pagos: 0, propuesta: 0, aplazado: 0, total: 0 };
      cliMap[ck].pagos++;
      cliMap[ck].total += p.total_mxn;
      if (p.propuesta_bucket === "Aplazado") cliMap[ck].aplazado += p.total_mxn;
      else if (p.propuesta_bucket === "Propuesta") cliMap[ck].propuesta += p.total_mxn;

      const bk = p.banco || "Sin banco";
      if (!bankMap[bk]) bankMap[bk] = { nombre: bk, pagos: 0, total: 0 };
      bankMap[bk].pagos++;
      bankMap[bk].total += p.total_mxn;
    });
    return {
      cliArr: Object.values(cliMap).sort((a, b) => b.total - a.total),
      bankArr: Object.values(bankMap).sort((a, b) => b.total - a.total),
    };
  }, [data.pagos]);
  let acc = 0;

  return (
    <div>
      <SectionCard title="Concentración por cliente / contraparte" meta={`${cliArr.length} clientes · MXN`}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Cliente", "# pagos", "Propuesta", "Aplazado", "Total", "% acumulado"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Cliente" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cliArr.map((r, i) => {
                acc += r.total;
                const pctAcc = ratio(acc, total);
                return (
                  <tr key={r.nombre} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt }}>{i + 1}. {r.nombre}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub }}>{r.pagos}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.jade, ...NUM }}>{fmtMXN(r.propuesta)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.steel, ...NUM }}>{fmtMXN(r.aplazado)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, color: T.text, ...NUM, fontWeight: 700 }}>{fmtMXN(r.total)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ height: 4, width: Math.max(4, pctAcc * 80), background: T.steel, borderRadius: 2, opacity: 0.7 }} />
                        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt }}>{fmtPct(pctAcc)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Distribución por banco emisor" meta="MXN">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Banco", "# pagos", "Total", "% del total", "Distribución"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, color: T.textMuted, fontFamily: T.fontAlt, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "Banco" ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bankArr.map((r) => {
                const pct = ratio(r.total, total);
                return (
                  <tr key={r.nombre} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: T.text, fontFamily: T.fontAlt, fontWeight: 500 }}>{r.nombre}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub }}>{r.pagos}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.text, ...NUM }}>{fmtMXN(r.total)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: T.textSub }}>{fmtPct(pct)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <div style={{ height: 6, width: Math.max(4, pct * 160), background: T.steel, borderRadius: 3, opacity: 0.7, marginLeft: "auto" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Vencimientos ───────────────────────────────────────
export const TabVencimientos: React.FC<{ data: DecisionData }> = ({ data }) => {
  const { por_venc, monto_venc } = data;
  const semanaM = (monto_venc.hoy || 0) + (monto_venc.semana || 0);
  const semanaN = (por_venc.hoy || 0) + (por_venc.semana || 0);

  const vencChartData = useMemo(() => {
    const grupos: Record<number, number> = {};
    data.pagos.filter((p) => p.venc_dias != null).forEach((p) => {
      const d = p.venc_dias!;
      grupos[d] = (grupos[d] || 0) + p.total_mxn;
    });
    return Object.entries(grupos)
      .map(([d, monto]) => ({ dias: Number(d), monto, label: Number(d) < 0 ? `${d}d` : Number(d) === 0 ? "Hoy" : `+${d}d` }))
      .sort((a, b) => a.dias - b.dias);
  }, [data.pagos]);

  const buckets = [
    { label: "Vencido", value: fmtMXN(monto_venc.vencido), sub: `${por_venc.vencido || 0} solicitudes`, color: T.red },
    { label: "≤ 7 días", value: fmtMXN(semanaM), sub: `${semanaN} solicitudes`, color: T.amber },
    { label: "8 — 14 días", value: fmtMXN(monto_venc.prox), sub: `${por_venc.prox || 0} solicitudes`, color: T.textSub },
    { label: "Sin fecha", value: fmtMXN(monto_venc.sin_fecha), sub: `${por_venc.sin_fecha || 0} solicitudes`, color: T.textMuted },
  ];

  return (
    <div>
      <div className="dp-grid-4" style={{ marginBottom: 20 }}>
        {buckets.map((b) => (
          <div key={b.label} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: b.color, fontFamily: T.fontAlt, fontWeight: 600, marginBottom: 4 }}>{b.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, ...NUM }}>{b.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontAlt, marginTop: 2 }}>{b.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: T.font, marginBottom: 12 }}>
          Calendario de vencimientos · días desde hoy
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={vencChartData} margin={{ left: 0, right: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: T.textSub, fontSize: 11, fontFamily: T.fontAlt }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.textMuted, fontSize: 11, fontFamily: T.fontAlt }}
              tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: any) => [fmtMXN(v), "Monto"]}
              contentStyle={{ background: T.panelBg, border: `1px solid ${T.cardBorder}`, borderRadius: 6, fontSize: 12, fontFamily: T.fontAlt }}
              labelStyle={{ color: T.text }}
              itemStyle={{ color: T.textSub }}
            />
            <Bar dataKey="monto" radius={[3, 3, 0, 0]}>
              {vencChartData.map((entry, i) => (
                <Cell key={i} fill={entry.dias < 0 ? T.red : entry.dias <= 7 ? T.amber : T.steel} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
