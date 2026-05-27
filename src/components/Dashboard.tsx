import React, { useMemo } from "react";
import {
  Shield,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { STATUS } from "../data/mockData";
import type { Request, ExchangeRate } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import ExchangeChart from "../components/ExchangeChart";
import DashboardHero from "../components/dashboard/DashboardHero";
import HeroKPI from "../components/dashboard/HeroKPI";
import PipelineFunnel, { STATUS_HEX } from "../components/dashboard/PipelineFunnel";
import PriorityQueue from "../components/dashboard/PriorityQueue";
import ActivityFeed from "../components/dashboard/ActivityFeed";

interface DashboardProps {
  requests: Request[];
  lastExchangeRate: ExchangeRate;
  onNavigate: (view: string) => void;
}

const fmtMXN = (n: number) =>
  `$${n.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

/* --- Small compact KPI for the secondary strip ------------------ */
interface SecondaryKPIProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}
const SecondaryKPI: React.FC<SecondaryKPIProps> = ({
  label,
  value,
  icon,
  color = "var(--enl-jade)",
}) => (
  <div
    className="flex items-center gap-3.5 rounded-lg"
    style={{
      padding: "14px 16px",
      background: "rgba(18,25,38,0.4)",
      border: "1px solid var(--border-on-dark)",
    }}
  >
    <div
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{
        width: 36,
        height: 36,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        color,
      }}
    >
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p
        className="m-0 text-[10.5px] font-medium uppercase"
        style={{
          fontFamily: "var(--font-secondary)",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </p>
      <p
        className="m-0 mt-1 text-white font-semibold"
        style={{
          fontFamily: "var(--font-primary)",
          fontSize: 18,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>
    </div>
  </div>
);

/* --- Department breakdown -------------------------------------- */
interface DeptBreakdownProps {
  requests: Request[];
  rate: number;
}
const DeptBreakdown: React.FC<DeptBreakdownProps> = ({ requests, rate }) => {
  const toMXN = (r: Request) => (r.currency === "USD" ? r.amount * rate : r.amount);
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r) => {
      map[r.department] = (map[r.department] || 0) + toMXN(r);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, rate]);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div
      className="rounded-xl"
      style={{
        background: "var(--bg-card-dark, #1e2d3d)",
        border: "1px solid var(--border-on-dark)",
      }}
    >
      <div style={{ padding: "16px 20px 8px" }}>
        <h3
          className="m-0 text-white font-semibold"
          style={{ fontFamily: "var(--font-primary)", fontSize: 16 }}
        >
          Top departamentos
        </h3>
        <p
          className="m-0 mt-0.5 text-xs"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Gasto acumulado en MXN equivalente
        </p>
      </div>
      <div style={{ padding: "16px 20px 20px" }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const isLast = i === data.length - 1;
          return (
            <div key={d.name} style={{ marginBottom: isLast ? 0 : 16 }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-white text-[13.5px] font-medium">
                  {d.name}
                </span>
                <span
                  className="text-[13px] tabular-nums"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {fmtMXN(d.value)}
                </span>
              </div>
              <div
                className="overflow-hidden"
                style={{
                  height: 4,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background:
                      i === 0
                        ? "var(--enl-jade)"
                        : i === 1
                          ? "var(--enl-cerceta)"
                          : "rgba(255,255,255,0.25)",
                    borderRadius: 999,
                    transition: "width 600ms cubic-bezier(.4,0,.2,1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* --- Dashboard ------------------------------------------------- */
const Dashboard: React.FC<DashboardProps> = ({
  requests,
  lastExchangeRate,
  onNavigate,
}) => {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "";
  const rate = lastExchangeRate.rate;
  const toMXN = (r: Request) => (r.currency === "USD" ? r.amount * rate : r.amount);

  const m = useMemo(() => {
    const pending = requests.filter(
      (r) => r.status === STATUS.PENDING_FIN || r.status === STATUS.APPROVED
    );
    const totalPending = pending.reduce((s, r) => s + toMXN(r), 0);

    const paid = requests.filter((r) => r.status === STATUS.PAID);
    const totalPaid = paid.reduce(
      (s, r) => s + (r.amountMXN ?? toMXN(r)),
      0
    );

    const pendingAuth = requests.filter(
      (r) => r.status === STATUS.AUTORIZACION
    ).length;
    const pendingFin = requests.filter(
      (r) => r.status === STATUS.PENDING_FIN
    ).length;
    const approved = requests.filter((r) => r.status === STATUS.APPROVED).length;
    const total = requests.length;
    const rejected = requests.filter((r) => r.status === STATUS.REJECTED).length;
    const rejectRate =
      total > 0 ? ((rejected / total) * 100).toFixed(1) : "0";

    return {
      totalPending,
      totalPaid,
      pendingAuth,
      pendingFin,
      approved,
      rejectRate,
      total,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, rate]);

  // Tiny mock sparkline series. Replace with real time-series when available.
  const queueTrend = useMemo(() => {
    // Conteo de pendientes en cada uno de los últimos 12 días.
    const days = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (11 - i));
      return d.toISOString().slice(0, 10);
    });
    return days.map((day) =>
      requests.filter(
        (r) =>
          r.date <= day &&
          (r.status === STATUS.PENDING_FIN || r.status === STATUS.AUTORIZACION)
      ).length
    );
  }, [requests]);

  // Mock pagados: monto acumulado en MXN por mes durante los últimos 12 meses.
  const paidTrend = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      return d.toISOString().slice(0, 7); // "YYYY-MM"
    });
    return months.map((month) =>
      requests
        .filter(
          (r) =>
            r.status === STATUS.PAID &&
            r.date.startsWith(month)
        )
        .reduce((s, r) => s + (r.amountMXN ?? toMXN(r)), 0)
    );
  }, [requests, rate]);


  return (
    <div className="space-y-6">
      <DashboardHero
        userFirstName={firstName || "Juan"}
        pendingAuth={m.pendingAuth}
        pendingFin={m.pendingFin}
        approved={m.approved}
        onGoToApprovals={() => onNavigate("aprobaciones")}
        onNewRequest={() => onNavigate("nueva-solicitud")}
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroKPI
          label="Por procesar"
          value={fmtMXN(m.totalPending)}
          sub={`${m.pendingFin + m.approved} solicitudes · al T/C actual`}
          accent="var(--enl-jade)"
          sparkData={queueTrend}
          trend={
            <>
              <TrendingUp size={12} color="var(--enl-jade)" />
              <span>
                <strong className="text-white">+12%</strong> vs. semana anterior
              </span>
            </>
          }
        />
        <HeroKPI
          label="Pagado este mes"
          value={fmtMXN(m.totalPaid)}
          sub="Acumulado a la fecha · MXN"
          accent="#a855f7"
          sparkData={paidTrend}
          trend={
            <>
              <TrendingUp size={12} color="#a855f7" />
              <span>
                <strong className="text-white">+22%</strong> vs. mes anterior
              </span>
            </>
          }
        />
        <HeroKPI
          label="T/C Banxico"
          value={`$${rate.toFixed(4)}`}
          sub={`Cierre ${fmtDate(lastExchangeRate.date)} · 1 USD → MXN`}
          accent="var(--enl-cerceta)"
          trend={
            <>
              <Clock size={12} color="var(--enl-cerceta)" />
              <span>Último cierre disponible</span>
            </>
          }
        />
      </div>

      {/* Secondary KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SecondaryKPI
          label="En autorización"
          value={String(m.pendingAuth)}
          icon={<Shield size={16} />}
          color={STATUS_HEX["Autorización"]}
        />
        <SecondaryKPI
          label="Revisión finanzas"
          value={String(m.pendingFin)}
          icon={<Wallet size={16} />}
          color={STATUS_HEX["Pending Fin"]}
        />
        <SecondaryKPI
          label="Listas para pagar"
          value={String(m.approved)}
          icon={<CheckCircle2 size={16} />}
          color={STATUS_HEX.Approved}
        />
        <SecondaryKPI
          label="Tasa de rechazo"
          value={`${m.rejectRate}%`}
          icon={<AlertTriangle size={16} />}
          color={STATUS_HEX.Rejected}
        />
      </div>

      {/* Priority queue + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        <PriorityQueue requests={requests} onView={onNavigate} />
        <div
          className="rounded-xl"
          style={{
            background: "var(--bg-card-dark, #1e2d3d)",
            border: "1px solid var(--border-on-dark)",
          }}
        >
          <div
            className="flex items-start justify-between"
            style={{ padding: "16px 20px 8px" }}
          >
            <div>
              <h3
                className="m-0 text-white font-semibold"
                style={{ fontFamily: "var(--font-primary)", fontSize: 16 }}
              >
                Pipeline
              </h3>
              <p
                className="m-0 mt-0.5 text-xs"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Cómo avanzan las solicitudes
              </p>
            </div>
            <div
              className="text-[10.5px] font-semibold uppercase"
              style={{
                fontFamily: "var(--font-secondary)",
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {m.total} totales
            </div>
          </div>
          <div style={{ padding: "12px 20px 20px" }}>
            <PipelineFunnel
              requests={requests}
              onStageClick={(status) => {
                if (status === STATUS.AUTORIZACION) onNavigate("aprobaciones");
                else if (
                  status === STATUS.PENDING_FIN ||
                  status === STATUS.APPROVED
                )
                  onNavigate("finanzas");
                else onNavigate("explorador");
              }}
            />
          </div>
        </div>
      </div>

      {/* Exchange chart */}
      <ExchangeChart />

      {/* Activity + Departments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeed requests={requests} />
        <DeptBreakdown requests={requests} rate={rate} />
      </div>
    </div>
  );
};

export default Dashboard;
