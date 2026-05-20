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
import { 
  Wallet, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Activity 
} from "lucide-react";
import KPICard from "./KPICard";
import ExchangeChart from "./ExchangeChart";
import RecentRequestsTable from "./RecentRequestsTable";
import { STATUS } from "../data/mockData";
import type { Request, ExchangeRate } from "../data/mockData";

interface DashboardProps {
  requests: Request[];
  lastExchangeRate: ExchangeRate;
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

const Dashboard: React.FC<DashboardProps> = ({ requests, lastExchangeRate }) => {
  const lastRate = lastExchangeRate.rate;

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
          value={`${fmtMXN(kpis.totalPending)}`}
          icon={<Wallet size={20} />}
          color="#00aa85"
        />
        <KPICard
          label="Solicitudes Activas"
          value={String(kpis.active)}
          icon={<FileText size={20} />}
          color="#3d7d80"
        />
        <KPICard
          label="Monto Pagado"
          value={`${fmtMXN(kpis.totalPaid)}`}
          icon={<CheckCircle2 size={20} />}
          color="#a855f7"
        />
        <KPICard
          label="Pend. Autorización"
          value={String(kpis.pendingAuth)}
          icon={<Clock size={20} />}
          color="#eab308"
        />
        <KPICard
          label="Tasa de Rechazo"
          value={`${kpis.rejectRate}%`}
          icon={<XCircle size={20} />}
          color="#ef4444"
        />
        <KPICard
          label="Ciclo Promedio"
          value={kpis.avgDays > 0 ? `${kpis.avgDays.toFixed(1)} días` : "—"}
          icon={<Activity size={20} />}
          color="#3b82f6"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status donut */}
        <div
          className="rounded-xl p-6 shadow-2xl border border-gray-700/50 flex flex-col"
          style={{
            backgroundColor: "#1e2d3d",
            background: "linear-gradient(145deg, #1e2d3d 0%, #16222c 100%)",
          }}
        >
          <div className="mb-4">
            <h3
              className="text-white text-lg font-bold"
              style={{ fontFamily: font }}
            >
              Distribución por Estado
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">
              Estado actual de la cola de pagos
            </p>
          </div>

          <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="relative w-full max-w-[220px] aspect-square flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={88}
                    paddingAngle={6}
                    cornerRadius={8}
                    dataKey="value"
                    stroke="none"
                    animationBegin={0}
                    animationDuration={1500}
                  >
                    {statusData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[entry.name] || "#6b7280"}
                        className="outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e2d3d",
                      border: "1px solid #3d7d80",
                      borderRadius: 12,
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                    }}
                    itemStyle={{ fontSize: "12px", fontFamily: font }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center KPI */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-gray-500 text-[10px] uppercase tracking-widest font-semibold">
                  Total
                </span>
                <span
                  className="text-white text-2xl font-bold"
                  style={{ fontFamily: font }}
                >
                  {requests.length}
                </span>
              </div>
            </div>

            {/* Premium Legend */}
            <div className="flex-1 w-full grid grid-cols-2 gap-x-6 gap-y-3">
              {statusData.map((s) => {
                const percentage = ((s.value / requests.length) * 100).toFixed(0);
                return (
                  <div
                    key={s.name}
                    className="flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-1.5 h-4 rounded-full"
                        style={{
                          backgroundColor: PIE_COLORS[s.name] || "#6b7280",
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-gray-300 text-xs font-medium group-hover:text-white transition-colors">
                          {s.name}
                        </span>
                        <span className="text-gray-500 text-[10px]">
                          {s.value} unidad{s.value !== 1 ? "es" : ""}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs font-semibold bg-gray-800/50 px-1.5 py-0.5 rounded">
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
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
