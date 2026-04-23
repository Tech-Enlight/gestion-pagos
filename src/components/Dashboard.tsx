import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import KPICard from "./KPICard";
import ExchangeChart from "./ExchangeChart";
import RecentRequestsTable from "./RecentRequestsTable";
import { STATUS, exchangeRates } from "../data/mockData";
import type { Request } from "../data/mockData";

interface DashboardProps {
  requests: Request[];
}

const PIE_COLORS: Record<string, string> = {
  Draft: "#6b7280",
  Autorización: "#eab308",
  "Pending Fin": "#3b82f6",
  Approved: "#22c55e",
  Rejected: "#ef4444",
  Paid: "#a855f7",
};

const fmtMXN = (n: number) =>
  `$${n.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const Dashboard: React.FC<DashboardProps> = ({ requests }) => {
  const lastRate = exchangeRates[exchangeRates.length - 1].rate;

  const toMXN = (r: Request) =>
    r.currency === "USD" ? r.amount * lastRate : r.amount;

  const kpis = useMemo(() => {
    const pending = requests.filter(
      (r) => r.status === STATUS.PENDING_FIN || r.status === STATUS.APPROVED
    );
    const totalPending = pending.reduce((s, r) => s + toMXN(r), 0);

    const active = requests.filter(
      (r) => r.status !== STATUS.PAID && r.status !== STATUS.REJECTED
    ).length;

    const paid = requests.filter((r) => r.status === STATUS.PAID);
    const totalPaid = paid.reduce((s, r) => s + (r.amountMXN ?? toMXN(r)), 0);

    const pendingAuth = requests.filter(
      (r) => r.status === STATUS.AUTORIZACION
    ).length;

    const total = requests.length;
    const rejected = requests.filter(
      (r) => r.status === STATUS.REJECTED
    ).length;
    const rejectRate = total > 0 ? ((rejected / total) * 100).toFixed(1) : "0";

    let avgDays = 0;
    const completed = requests.filter(
      (r) =>
        r.status === STATUS.PAID &&
        r.statusHistory &&
        r.statusHistory.length >= 2
    );
    if (completed.length > 0) {
      const totalMs = completed.reduce((sum, r) => {
        const first = new Date(r.statusHistory[0].timestamp).getTime();
        const last = new Date(
          r.statusHistory[r.statusHistory.length - 1].timestamp
        ).getTime();
        return sum + (last - first);
      }, 0);
      avgDays = totalMs / completed.length / (1000 * 60 * 60 * 24);
    }

    return {
      totalPending,
      active,
      totalPaid,
      pendingAuth,
      rejectRate,
      avgDays,
    };
  }, [requests]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r) => {
      map[r.status] = (map[r.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [requests]);

  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r) => {
      map[r.department] = (map[r.department] || 0) + toMXN(r);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [requests]);

  const recent = useMemo(
    () =>
      [...requests].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [requests]
  );

  const font = "Alexandria, sans-serif";

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-white text-2xl font-bold mb-1"
          style={{ fontFamily: font }}
        >
          Dashboard
        </h2>
        <p className="text-gray-400 text-sm">
          Resumen ejecutivo · {requests.length} solicitudes totales
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Total Pendiente"
          value={`${fmtMXN(kpis.totalPending)} MXN`}
          icon="💰"
          color="#00aa85"
        />
        <KPICard
          label="Solicitudes Activas"
          value={String(kpis.active)}
          icon="📋"
          color="#3d7d80"
        />
        <KPICard
          label="Monto Pagado"
          value={`${fmtMXN(kpis.totalPaid)} MXN`}
          icon="✅"
          color="#a855f7"
        />
        <KPICard
          label="Pend. Autorización"
          value={String(kpis.pendingAuth)}
          icon="⏳"
          color="#eab308"
        />
        <KPICard
          label="Tasa de Rechazo"
          value={`${kpis.rejectRate}%`}
          icon="🚫"
          color="#ef4444"
        />
        <KPICard
          label="Ciclo Promedio"
          value={kpis.avgDays > 0 ? `${kpis.avgDays.toFixed(1)} días` : "—"}
          icon="⏱️"
          color="#3b82f6"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status donut */}
        <div
          className="rounded-xl p-5 shadow-lg border border-gray-700"
          style={{ backgroundColor: "#1e2d3d" }}
        >
          <h3
            className="text-white text-lg font-semibold mb-4"
            style={{ fontFamily: font }}
          >
            Distribución por Estado
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[entry.name] || "#6b7280"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#293C47",
                  border: "1px solid #3d7d80",
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: font,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[s.name] || "#6b7280" }}
                />
                <span className="text-gray-400 text-[11px]">
                  {s.name} <span className="text-gray-500">({s.value})</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Department bar chart */}
        <div
          className="rounded-xl p-5 shadow-lg border border-gray-700"
          style={{ backgroundColor: "#1e2d3d" }}
        >
          <h3
            className="text-white text-lg font-semibold mb-4"
            style={{ fontFamily: font }}
          >
            Monto por Departamento (MXN)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={deptData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v: number) => fmtMXN(v)}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#293C47",
                  border: "1px solid #3d7d80",
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: font,
                  fontSize: 12,
                }}
                formatter={(value: number) => [fmtMXN(value), "Monto"]}
              />
              <Bar dataKey="value" fill="#00aa85" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Exchange Chart */}
      <ExchangeChart />

      {/* Recent Requests */}
      <div>
        <h3
          className="text-white text-lg font-semibold mb-3"
          style={{ fontFamily: font }}
        >
          Solicitudes Recientes
        </h3>
        <RecentRequestsTable requests={recent} />
      </div>
    </div>
  );
};

export default Dashboard;
