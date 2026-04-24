import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fetchExchangeRates } from "../services/sheets";

const ExchangeChart: React.FC = () => {
  const [rateData, setRateData] = useState<{ date: string; rate: number }[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExchangeRates()
      .then(setRateData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Format and sort data for better display
  const data = useMemo(() => {
    if (!rateData.length) return [];

    const monthNames = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];

    // Parse, sort and unique
    const uniqueMap = new Map<string, { name: string; rate: number; timestamp: number }>();

    rateData.forEach((r) => {
      const parts = r.date.includes("/") ? r.date.split("/") : r.date.split("-");
      let day, month, year;

      if (r.date.includes("/")) {
        // D/M/YYYY
        [day, month, year] = parts;
      } else {
        // YYYY-MM-DD
        [year, month, day] = parts;
      }

      const d = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      );
      
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          name: `${day} ${monthNames[parseInt(month) - 1]}`,
          rate: r.rate,
          timestamp: d.getTime(),
        });
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [rateData]);

  const minRate =
    data.length > 0
      ? Math.floor(Math.min(...data.map((d) => d.rate)) * 10) / 10 - 0.1
      : 17.2;
  const maxRate =
    data.length > 0
      ? Math.ceil(Math.max(...data.map((d) => d.rate)) * 10) / 10 + 0.1
      : 18.2;

  return (
    <div
      className="rounded-xl p-6 shadow-2xl border border-gray-700/50"
      style={{
        backgroundColor: "#1e2d3d",
        background: "linear-gradient(145deg, #1e2d3d 0%, #16222c 100%)",
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3
            className="text-white text-lg font-bold"
            style={{ fontFamily: "Alexandria, sans-serif" }}
          >
            Tipo de Cambio USD/MXN
          </h3>
          <p className="text-gray-500 text-xs mt-1">
            Tendencia de los últimos 30 días (Banxico)
          </p>
        </div>
        {data.length > 0 && (
          <div className="text-right">
            <span className="text-[#00aa85] text-xl font-bold block">
              ${data[data.length - 1].rate.toFixed(4)}
            </span>
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">
              Último Cierre
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-gray-400 text-sm animate-pulse">
            Cargando indicadores...
          </p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-gray-500 text-sm italic">Sin datos disponibles</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00aa85" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00aa85" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="#2d4a5a"
              opacity={0.5}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 9 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
              padding={{ left: 15, right: 15 }}
            />
            <YAxis
              domain={[minRate, maxRate]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2d3d",
                border: "1px solid #3d7d80",
                borderRadius: "12px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              }}
              itemStyle={{ color: "#00aa85", fontSize: "12px" }}
              labelStyle={{
                color: "#94a3b8",
                fontSize: "11px",
                marginBottom: "4px",
              }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, "T/C"]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#00aa85"
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 6,
                fill: "#00aa85",
                stroke: "#1e2d3d",
                strokeWidth: 2,
              }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ExchangeChart;
