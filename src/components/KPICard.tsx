import React from 'react';

interface KPICardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, color }) => {
  return (
    <div
      className="rounded-xl p-5 shadow-lg border border-gray-700"
      style={{ backgroundColor: '#1e2d3d' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="w-2 h-10 rounded-full" style={{ backgroundColor: color }}></div>
      </div>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1" style={{ fontFamily: 'Alexandria, sans-serif' }}>{label}</p>
      <p className="text-white text-2xl font-bold" style={{ fontFamily: 'Alexandria, sans-serif', color }}>{value}</p>
    </div>
  );
};

export default KPICard;