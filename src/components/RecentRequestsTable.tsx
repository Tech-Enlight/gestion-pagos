import React from "react";
import StatusPill from "./StatusPill";
import type { Request } from "../data/mockData";

interface Props {
  requests: Request[];
}

const RecentRequestsTable: React.FC<Props> = ({ requests }) => {
  return (
    <div
      className="rounded-xl border border-gray-700 overflow-hidden shadow-lg"
      style={{ backgroundColor: "#1e2d3d" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#293C47" }}>
            <th
              className="text-left px-4 py-3 text-gray-300 font-semibold"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              ID
            </th>
            <th className="text-left px-4 py-3 text-gray-300 font-semibold">
              Proyecto
            </th>
            <th className="text-left px-4 py-3 text-gray-300 font-semibold">
              Beneficiario
            </th>
            <th className="text-right px-4 py-3 text-gray-300 font-semibold">
              Monto
            </th>
            <th className="text-center px-4 py-3 text-gray-300 font-semibold">
              Estado
            </th>
            <th className="text-left px-4 py-3 text-gray-300 font-semibold">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr
              key={r.id}
              className="border-t border-gray-700 hover:bg-[#243545] transition-colors"
            >
              <td className="px-4 py-3 text-[#00aa85] font-medium">{r.id}</td>
              <td className="px-4 py-3 text-gray-300">{r.projectNumber}</td>
              <td className="px-4 py-3 text-gray-300">{r.beneficiary}</td>
              <td className="px-4 py-3 text-gray-200 text-right font-medium">
                {r.currency === "USD" ? "$" : "$"}
                {r.amount.toLocaleString("es-MX")} {r.currency}
              </td>
              <td className="px-4 py-3 text-center">
                <StatusPill status={r.status} />
              </td>
              <td className="px-4 py-3 text-gray-400">{r.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentRequestsTable;
