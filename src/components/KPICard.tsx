import React from 'react';

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, color }) => {
  return (
    <div
      className="rounded-xl p-5 shadow-lg border border-gray-700 group hover:border-gray-500 transition-all duration-300"
      style={{
        backgroundColor: "#1e2d3d",
        background: "linear-gradient(145deg, #1e2d3d 0%, #16222c 100%)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="p-2.5 rounded-lg bg-gray-800/50 text-white"
          style={{ color }}
        >
          {icon}
        </div>
        <div
          className="w-1 h-8 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: color }}
        ></div>
      </div>
      <p
        className="text-gray-500 text-[10px] uppercase tracking-[0.15em] font-semibold mb-1"
        style={{ fontFamily: "Alexandria, sans-serif" }}
      >
        {label}
      </p>
      <p
        className="text-white text-xl font-bold tracking-tight"
        style={{ fontFamily: "Alexandria, sans-serif" }}
      >
        {value}
      </p>
    </div>
  );
};

export default KPICard;