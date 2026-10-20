import React, { useMemo } from "react";
import {
  Shield,
  ClipboardCheck,
  Wallet,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { STATUS, STATUS_HEX } from "../data/mockData";
import type { Request, ExchangeRate } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { canAccessView } from "./Sidebar";
import ExchangeChart from "../components/ExchangeChart";
import DashboardHero from "../components/dashboard/DashboardHero";
import HeroKPI from "../components/dashboard/HeroKPI";
import PipelineFunnel from "../components/dashboard/PipelineFunnel";
import PriorityQueue from "../components/dashboard/PriorityQueue";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import {
  UNPAID_AFTER_AUTH,
  avgCycleDays,
  paidMXN,
  paidThisMonth,
  queueAmountSeries,
  rejectionRate,
  toMXN,
} from "../components/dashboard/metrics";

export type DashboardDataState = "loading" | "ready" | "error";

interface DashboardProps {
  requests: Request[];
  lastExchangeRate: ExchangeRate;
  /** Cierre inmediato anterior, para mostrar la variación del T/C. */
  previousExchangeRate: number | null;
  /** false mientras el T/C real no ha llegado (el estado inicial es un placeholder). */
  exchangeRateReady: boolean;
  dataState: DashboardDataState;
  onRetry: () => void;
  onNavigate: (view: string) => void;
}

const DASH = "—";
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const fmtMXN = (n: number) =>
  `$${n.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

// /tipo-cambio entrega "19/10/2026" (DD/MM/YYYY), que Date() no entiende (mes 19 → Invalid Date);
// otras fuentes entregan ISO. Se aceptan ambos como día local.
const parseDay = (s: string): Date | null => {
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  return null;
};

const fmtDate = (s: string) => {
  const d = parseDay(s);
  return d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—";
};

/** Vista a la que lleva cada estado; null si el rol no tiene acceso. */
const viewForStatus = (status: string): string => {
  if (status === STATUS.AUTORIZACION) return "aprobaciones";
  if (status === STATUS.PENDING_FIN || status === STATUS.APPROVED) return "decision-pagos";
  if (status === STATUS.PAYMENT_APPROVED) return "finanzas";
  return "explorador";
};

/* --- Variación entre dos valores reales ------------------------- */
interface TrendLabelProps {
  current: number;
  previous: number | null;
  comparedTo: string;
  color: string;
}
const TrendLabel: React.FC<TrendLabelProps> = ({ current, previous, comparedTo, color }) => {
  // Sin base de comparación (0 o inexistente) un % no significa nada.
  if (previous == null || previous === 0) {
    return (
      <>
        <Clock size={12} color={color} aria-hidden />
        <span style={{ color: "rgba(255,255,255,0.6)" }}>Sin base de comparación</span>
      </>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const isDown = pct < 0;
  const Icon = isDown ? TrendingDown : TrendingUp;
  return (
    <>
      <Icon size={12} color={isDown ? STATUS_HEX.Rejected : color} aria-hidden />
      <span>
        <strong className="text-white">
          {pct > 0 ? "+" : ""}
          {pct.toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
        </strong>{" "}
        {comparedTo}
      </span>
    </>
  );
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
          color: "rgba(255,255,255,0.6)",
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
  loading: boolean;
}
const TOP_DEPTS = 6;
const DeptBreakdown: React.FC<DeptBreakdownProps> = ({ requests, rate, loading }) => {
  const { data, hidden } = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r) => {
      // Borradores y rechazadas no son gasto: ni comprometido ni ejecutado.
      if (r.status === STATUS.DRAFT || r.status === STATUS.REJECTED) return;
      const name = r.department?.trim() || "Sin departamento";
      const amount = r.status === STATUS.PAID ? paidMXN(r, rate) : toMXN(r, rate);
      map[name] = (map[name] || 0) + amount;
    });
    const all = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { data: all.slice(0, TOP_DEPTS), hidden: Math.max(all.length - TOP_DEPTS, 0) };
  }, [requests, rate]);
  const max = Math.max(...data.map((d) => d.value), 1);
  // Sin una escala de colores por categoría (los departamentos son nominales):
  // el líder destaca en jade y el resto queda neutro.
  const barColor = (i: number) => (i === 0 ? "var(--enl-jade)" : "rgba(255,255,255,0.3)");

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
        <p className="m-0 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
          Solicitudes en flujo y pagadas · MXN equivalente
        </p>
      </div>
      <div style={{ padding: "16px 20px 20px" }}>
        {data.length === 0 && (
          <p className="m-0 text-center text-xs" style={{ padding: "16px 0", color: "rgba(255,255,255,0.6)" }}>
            {loading ? "Cargando…" : "Aún no hay gasto para mostrar."}
          </p>
        )}
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const isLast = i === data.length - 1;
          return (
            <div key={d.name} style={{ marginBottom: isLast ? 0 : 16 }}>
              <div className="flex justify-between gap-3 mb-1.5">
                <span className="text-white text-[13.5px] font-medium truncate">{d.name}</span>
                <span
                  className="text-[13px] tabular-nums flex-shrink-0"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  {fmtMXN(d.value)}
                </span>
              </div>
              <div
                className="overflow-hidden"
                style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 999 }}
              >
                <div
                  className="transition-transform duration-[600ms] ease-out motion-reduce:transition-none"
                  style={{
                    height: "100%",
                    width: "100%",
                    transform: `scaleX(${pct / 100})`,
                    transformOrigin: "left",
                    background: barColor(i),
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          );
        })}
        {hidden > 0 && (
          <p className="m-0 mt-4 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            +{hidden} {hidden === 1 ? "departamento más" : "departamentos más"}
          </p>
        )}
      </div>
    </div>
  );
};

/* --- Dashboard ------------------------------------------------- */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const Dashboard: React.FC<DashboardProps> = ({
  requests,
  lastExchangeRate,
  previousExchangeRate,
  exchangeRateReady,
  dataState,
  onRetry,
  onNavigate,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const firstName = user?.name?.split(" ")[0] || "";
  const loading = dataState === "loading";
  const rate = lastExchangeRate.rate;
  // Sin T/C real, cualquier monto USD→MXN sería inventado: mejor no mostrarlo.
  const moneyReady = !loading && exchangeRateReady;

  // Cola que le toca trabajar a cada rol (matriz 2026-07-15): dirección autoriza,
  // admin decide en Decisión de Pagos, superadmin ve ambas.
  const queueStatuses = useMemo<string[]>(() => {
    if (role === "admin") return [STATUS.PENDING_FIN, STATUS.APPROVED];
    if (role === "superadmin") return [STATUS.AUTORIZACION, STATUS.PENDING_FIN, STATUS.APPROVED];
    return [STATUS.AUTORIZACION];
  }, [role]);
  const primaryView = role === "admin" ? "decision-pagos" : "aprobaciones";

  const go = (view: string) => {
    if (canAccessView(view, role)) onNavigate(view);
  };

  const m = useMemo(() => {
    const count = (...s: string[]) => requests.filter((r) => s.includes(r.status)).length;
    const unpaid = requests.filter((r) => UNPAID_AFTER_AUTH.includes(r.status));
    return {
      pendingAmount: unpaid.reduce((s, r) => s + toMXN(r, rate), 0),
      pendingCount: unpaid.length,
      pendingAuth: count(STATUS.AUTORIZACION),
      pendingDecision: count(STATUS.PENDING_FIN),
      readyToPay: count(STATUS.APPROVED, STATUS.PAYMENT_APPROVED),
      rejectRate: rejectionRate(requests),
      total: requests.length,
      queueCount: count(...queueStatuses),
    };
  }, [requests, rate, queueStatuses]);

  const paid = useMemo(() => paidThisMonth(requests, rate), [requests, rate]);
  const unpaidSeries = useMemo(
    () => queueAmountSeries(requests, UNPAID_AFTER_AUTH, rate, 12),
    [requests, rate]
  );
  const cycleDays = useMemo(() => avgCycleDays(requests), [requests]);

  const hero = useMemo(() => {
    const cycle =
      cycleDays != null
        ? ` Ciclo promedio de pago (últimos 30 días): ${cycleDays.toFixed(1)} días.`
        : "";
    let summary: string;
    if (loading) {
      summary = "Cargando solicitudes…";
    } else if (dataState === "error") {
      summary = "No pudimos cargar las solicitudes; los números de abajo pueden estar incompletos.";
    } else if (m.queueCount === 0) {
      summary = `Todo está al corriente. No hay solicitudes pendientes de tu ${
        role === "admin" ? "decisión" : "autorización"
      }.${cycle}`;
    } else if (role === "admin") {
      summary = `${m.queueCount} ${plural(m.queueCount, "solicitud está", "solicitudes están")} en Decisión de Pagos esperando tu aprobación.${cycle}`;
    } else if (role === "superadmin") {
      summary = `${m.pendingAuth} en autorización y ${m.pendingDecision} en decisión de pagos.${cycle}`;
    } else {
      summary = `${m.queueCount} ${plural(m.queueCount, "solicitud está", "solicitudes están")} en autorización esperando tu revisión.${cycle}`;
    }
    const isAdmin = role === "admin";
    return {
      summary,
      primary: {
        label: isAdmin ? "Ir a decisión de pagos" : "Ir a aprobaciones",
        count: loading ? 0 : m.queueCount,
        icon: isAdmin ? <ClipboardCheck size={14} /> : <Shield size={14} />,
        onClick: () => go(primaryView),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, m, cycleDays, loading, dataState, primaryView]);

  const queue = useMemo(
    () =>
      requests
        .filter((r) => queueStatuses.includes(r.status))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [requests, queueStatuses]
  );

  const now = new Date();
  const stageClickable = (status: string) => canAccessView(viewForStatus(status), role);

  return (
    <div className="space-y-6">
      {dataState === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg text-sm"
          style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "rgba(255,255,255,0.9)",
          }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} aria-hidden /> No se pudieron cargar las solicitudes.
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--enl-jade)]"
            style={{ border: "1px solid var(--border-on-dark)", background: "transparent" }}
          >
            <RefreshCw size={12} aria-hidden /> Reintentar
          </button>
        </div>
      )}

      <DashboardHero
        userFirstName={firstName}
        loading={loading}
        totalWaiting={m.queueCount}
        summary={hero.summary}
        primary={hero.primary}
        onNewRequest={() => go("nueva-solicitud")}
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroKPI
          label="Por procesar"
          value={moneyReady ? fmtMXN(m.pendingAmount) : DASH}
          sub={`${loading ? DASH : m.pendingCount} ${plural(m.pendingCount, "solicitud", "solicitudes")} sin pagar · al T/C actual`}
          accent="var(--enl-jade)"
          sparkData={moneyReady ? unpaidSeries : undefined}
          sparkLabel="Monto por procesar, últimos 12 días"
          trend={
            moneyReady ? (
              <TrendLabel
                current={unpaidSeries[unpaidSeries.length - 1] ?? 0}
                previous={unpaidSeries[unpaidSeries.length - 1 - 7] ?? null}
                comparedTo="vs. hace 7 días"
                color="var(--enl-jade)"
              />
            ) : undefined
          }
        />
        <HeroKPI
          label="Pagado este mes"
          value={moneyReady ? fmtMXN(paid.current) : DASH}
          sub={`Del 1 al ${now.getDate()} de ${MONTHS_ES[now.getMonth()]} · MXN`}
          accent={STATUS_HEX.Paid}
          sparkData={moneyReady ? paid.cumulativeByDay : undefined}
          sparkLabel="Pagado acumulado en el mes"
          trend={
            moneyReady ? (
              <TrendLabel
                current={paid.current}
                previous={paid.previousSamePeriod}
                comparedTo="vs. mismo periodo del mes anterior"
                color={STATUS_HEX.Paid}
              />
            ) : undefined
          }
        />
        <HeroKPI
          label="T/C Banxico"
          value={exchangeRateReady ? `$${rate.toFixed(4)}` : DASH}
          sub={exchangeRateReady ? `Cierre ${fmtDate(lastExchangeRate.date)} · 1 USD → MXN` : "Cargando tipo de cambio…"}
          accent="var(--enl-cerceta)"
          trend={
            exchangeRateReady ? (
              <TrendLabel
                current={rate}
                previous={previousExchangeRate}
                comparedTo="vs. cierre anterior"
                color="var(--enl-cerceta)"
              />
            ) : undefined
          }
        />
      </div>

      {/* Secondary KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SecondaryKPI
          label="En autorización"
          value={loading ? DASH : String(m.pendingAuth)}
          icon={<Shield size={16} />}
          color={STATUS_HEX["Autorización"]}
        />
        <SecondaryKPI
          label="Decisión de pagos"
          value={loading ? DASH : String(m.pendingDecision)}
          icon={<ClipboardCheck size={16} />}
          color={STATUS_HEX["Pending Fin"]}
        />
        <SecondaryKPI
          label="Listas para pagar"
          value={loading ? DASH : String(m.readyToPay)}
          icon={<Wallet size={16} />}
          color={STATUS_HEX["Payment Approved"]}
        />
        <SecondaryKPI
          label="Tasa de rechazo"
          value={loading || m.rejectRate == null ? DASH : `${m.rejectRate.toFixed(1)}%`}
          icon={<AlertTriangle size={16} />}
          color={STATUS_HEX.Rejected}
        />
      </div>

      {/* Priority queue + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        <PriorityQueue
          queue={queue}
          loading={loading}
          viewAllLabel={role === "admin" ? "Ir a Decisión de Pagos" : "Ver todas"}
          onViewAll={() => go(primaryView)}
          onOpen={(status) => go(viewForStatus(status))}
        />
        <div
          className="rounded-xl"
          style={{
            background: "var(--bg-card-dark, #1e2d3d)",
            border: "1px solid var(--border-on-dark)",
          }}
        >
          <div className="flex items-start justify-between" style={{ padding: "16px 20px 8px" }}>
            <div>
              <h3
                className="m-0 text-white font-semibold"
                style={{ fontFamily: "var(--font-primary)", fontSize: 16 }}
              >
                Pipeline
              </h3>
              <p className="m-0 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                Cómo avanzan las solicitudes
              </p>
            </div>
            <div
              className="text-[10.5px] font-semibold uppercase"
              style={{
                fontFamily: "var(--font-secondary)",
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {loading ? DASH : m.total} totales
            </div>
          </div>
          <div style={{ padding: "12px 20px 20px" }}>
            <PipelineFunnel
              requests={requests}
              isClickable={stageClickable}
              onStageClick={(status) => go(viewForStatus(status))}
            />
          </div>
        </div>
      </div>

      {/* Exchange chart */}
      <ExchangeChart />

      {/* Activity + Departments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeed requests={requests} />
        <DeptBreakdown requests={requests} rate={rate} loading={loading} />
      </div>
    </div>
  );
};

export default Dashboard;
