import React from "react";

/**
 * Small inline line chart (no axes, no grid) for KPI cards.
 * data: number[] — the line is auto-scaled to its own min/max.
 */
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = "var(--enl-jade)",
  width = 80,
  height = 32,
}) => {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xStep = width / (data.length - 1 || 1);
  const points = data.map((v, i) => ({
    x: i * xStep,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path
        d={path}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </svg>
  );
};

/**
 * Hero KPI — the large dark cards at the top of the dashboard.
 * Replaces the old KPICard for the 3 most important figures.
 *
 * Visual elements:
 *  - left accent bar in `accent` color
 *  - 30px value
 *  - sub-label below
 *  - sparkline aligned bottom-right
 *  - trend row at the bottom
 */
interface HeroKPIProps {
  label: string;
  value: string;
  sub: string;
  trend?: React.ReactNode;
  sparkData?: number[];
  accent?: string;
}

const HeroKPI: React.FC<HeroKPIProps> = ({
  label,
  value,
  sub,
  trend,
  sparkData,
  accent = "var(--enl-jade)",
}) => (
  <div
    className="relative overflow-hidden rounded-xl"
    style={{
      background: "var(--enl-acero)",
      border: "1px solid var(--border-on-dark)",
      padding: "22px 24px",
    }}
  >
    <div
      className="absolute top-0 left-0 h-full"
      style={{ width: 3, background: accent }}
    />
    <p
      className="m-0 mb-2 text-[10.5px] font-semibold uppercase"
      style={{
        fontFamily: "var(--font-secondary)",
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.5)",
      }}
    >
      {label}
    </p>
    <div className="flex items-end justify-between gap-3">
      <div>
        <p
          className="m-0 text-white"
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "-0.015em",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        <p
          className="mt-2 text-xs m-0"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {sub}
        </p>
      </div>
      {sparkData && (
        <Sparkline data={sparkData} color={accent} width={80} height={32} />
      )}
    </div>
    {trend && (
      <p
        className="mt-3.5 mb-0 text-xs flex items-center gap-1.5"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        {trend}
      </p>
    )}
  </div>
);

export default HeroKPI;
