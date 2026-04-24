import React from 'react';
import { statusColors } from '../data/mockData';

import {
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  AlertCircle
} from "lucide-react";

interface Props {
  status: string;
}

const getStatusIcon = (status: string) => {
  const size = 12;
  switch (status) {
    case "Draft": return <FileEdit size={size} />;
    case "Autorización": return <AlertCircle size={size} />;
    case "Pending Fin": return <Clock size={size} />;
    case "Approved": return <CheckCircle2 size={size} />;
    case "Rejected": return <XCircle size={size} />;
    case "Paid": return <CreditCard size={size} />;
    default: return null;
  }
};

const StatusPill: React.FC<Props> = ({ status }) => {
  const colorClass = statusColors[status] || "bg-gray-500";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-sm ${colorClass}`}
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {getStatusIcon(status)}
      {status}
    </span>
  );
};

export default StatusPill;