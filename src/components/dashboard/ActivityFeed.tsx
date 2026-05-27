import React from "react";
import { STATUS_LABEL } from "../../data/mockData";
import type { Request } from "../../data/mockData";
import { STATUS_HEX } from "./PipelineFunnel";

/**
 * Vertical timeline of the latest status changes across all requests.
 * Reads each request's statusHistory[], flattens to a single sorted list,
 * shows the 6 most recent events.
 */

interface ActivityFeedProps {
  requests: Request[];
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ requests }) => {
  const events = requests
    .flatMap((r) =>
      (r.statusHistory || []).map((h) => ({
        ...h,
        requestId: r.id,
        beneficiary: r.beneficiary,
      }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6);

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
          Actividad reciente
        </h3>
        <p
          className="m-0 mt-0.5 text-xs"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Lo último que ha pasado en el portal
        </p>
      </div>

      <div style={{ padding: "8px 4px 12px" }}>
        {events.length === 0 ? (
          <p
            className="m-0 text-center text-xs"
            style={{
              padding: "24px 16px",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Aún no hay actividad para mostrar.
          </p>
        ) : (
          events.map((ev, i) => {
            const color = STATUS_HEX[ev.status] || "#828080";
            const isLast = i === events.length - 1;
            return (
              <div
                key={`${ev.requestId}-${ev.timestamp}-${i}`}
                className="flex gap-3.5 relative"
                style={{ padding: "10px 18px" }}
              >
                {!isLast && (
                  <div
                    className="absolute"
                    style={{
                      left: 22,
                      top: 36,
                      bottom: -10,
                      width: 1.5,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  />
                )}
                <div
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 14,
                    height: 14,
                    background: color,
                    marginTop: 5,
                    boxShadow: `0 0 0 3px ${color}33`,
                    zIndex: 1,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <span className="text-white text-[13px] font-medium">
                      <span
                        style={{
                          color: "var(--enl-jade)",
                          fontFamily: "var(--font-secondary)",
                        }}
                      >
                        {ev.requestId}
                      </span>
                      {" · "}
                      {STATUS_LABEL[ev.status] || ev.status}
                    </span>
                    <span
                      className="text-[11px] whitespace-nowrap"
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "var(--font-secondary)",
                      }}
                    >
                      {fmtDateTime(ev.timestamp)}
                    </span>
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {ev.beneficiary} · por {ev.changedBy}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
