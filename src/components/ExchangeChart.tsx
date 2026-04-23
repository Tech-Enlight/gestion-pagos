import React, { useState, useEffect } from "react";
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

  const data = rateData.map((r) => ({
    date: r.date.slice(5),
    rate: r.rate,
  }));

  const minRate =
    data.length > 0
      ? Math.floor(Math.min(...data.map((d) => d.rate)) * 10) / 10 - 0.2
      : 17.2;
  const maxRate =
    data.length > 0
      ? Math.ceil(Math.max(...data.map((d) => d.rate)) * 10) / 10 + 0.2
      : 18.2;

  return (
    <div
      className="rounded-xl p-5 shadow-lg border border-gray-700"
      style={{ backgroundColor: "#1e2d3d" }}
    >
      <h3
        className="text-white text-lg font-semibold mb-4"
        style={{ fontFamily: "Alexandria, sans-serif" }}
      >
        Tipo de Cambio USD/MXN — Últimos 30 días
      </h3>
      {loading ? (
        <p className="text-gray-400 text-sm py-10 text-center">
          Cargando tipo de cambio...
        </p>
      ) : data.length === 0 ? (
        <p className="text-gray-500 text-sm py-10 text-center">
          Sin datos disponibles
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2d4a5a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              domain={[minRate, maxRate]}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#293C47",
                border: "1px solid #3d7d80",
                borderRadius: "8px",
                color: "#fff",
              }}
              labelStyle={{ color: "#00aa85" }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, "USD/MXN"]}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#00aa85"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "#00aa85" }}
              name="USD/MXN"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ExchangeChart;
