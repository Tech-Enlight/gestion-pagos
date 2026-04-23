import React from 'react';
import { statusColors } from '../data/mockData';

interface Props {
  status: string;
}

const StatusPill: React.FC<Props> = ({ status }) => {
  const colorClass = statusColors[status] || 'bg-gray-500';
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-white text-xs font-medium ${colorClass}`}
      style={{ fontFamily: 'Alexandria, sans-serif' }}>
      {status}
    </span>
  );
};

export default StatusPill;