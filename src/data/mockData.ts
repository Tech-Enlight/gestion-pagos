export interface ExchangeRate {
  date: string;
  rate: number;
}

export interface FinanceNote {
  text: string;
  timestamp: string;
  user: string;
}

export interface StatusEvent {
  status: string;
  timestamp: string;
  changedBy: string;
  comment?: string;
  rejectReason?: string;
  clarificationRequest?: string;
  clarificationResponse?: string;
}

export interface Request {
  id: string;
  poNumber: string;
  projectNumber: string;
  beneficiary: string;
  concept: string;
  subtotal: number;
  iva: number;
  amount: number;
  currency: string;
  department: string;
  status: string;
  submittedBy: string;
  date: string;
  comment?: string;
  rejectReason?: string;
  clarificationRequest?: string;
  clarificationResponse?: string;
  financeObservations?: string;
  amountPaid?: number;
  exchangeRateUsed?: number;
  amountMXN?: number;
  bankName?: string;
  operationRef?: string;
  paymentMode?: string;
  invoiceNumber?: string;
  invoiceLink?: string;
  expenseType?: string;
  operationType?: string;
  ocStatus?: string;
  client?: string;
  serviceDelivery?: string;
  proposal?: string;
  paymentProof?: string;
  statusHistory: StatusEvent[];
  nsProjectId?: string;
  nsOcInternalId?: string;
  vendorId?: string;
  vendorRfc?: string;
  paymentType?: string;
  ocTotal?: number;
  exchangeRate?: number;
  estimatedPaymentDate?: string;
}

export const exchangeRates: ExchangeRate[] = [
  { date: "2023-10-01", rate: 17.55 },
  { date: "2023-10-02", rate: 17.62 },
  { date: "2023-10-03", rate: 17.48 },
  { date: "2023-10-04", rate: 17.8 },
  { date: "2023-10-05", rate: 17.75 },
  { date: "2023-10-06", rate: 17.68 },
  { date: "2023-10-07", rate: 17.72 },
  { date: "2023-10-08", rate: 17.9 },
  { date: "2023-10-09", rate: 17.85 },
  { date: "2023-10-10", rate: 17.78 },
  { date: "2023-10-11", rate: 17.65 },
  { date: "2023-10-12", rate: 17.7 },
  { date: "2023-10-13", rate: 17.82 },
  { date: "2023-10-14", rate: 17.95 },
  { date: "2023-10-15", rate: 18.02 },
  { date: "2023-10-16", rate: 17.98 },
  { date: "2023-10-17", rate: 17.88 },
  { date: "2023-10-18", rate: 17.75 },
  { date: "2023-10-19", rate: 17.6 },
  { date: "2023-10-20", rate: 17.55 },
  { date: "2023-10-21", rate: 17.48 },
  { date: "2023-10-22", rate: 17.52 },
  { date: "2023-10-23", rate: 17.65 },
  { date: "2023-10-24", rate: 17.7 },
  { date: "2023-10-25", rate: 17.8 },
  { date: "2023-10-26", rate: 17.88 },
  { date: "2023-10-27", rate: 17.92 },
  { date: "2023-10-28", rate: 17.85 },
  { date: "2023-10-29", rate: 17.78 },
  { date: "2023-10-30", rate: 17.72 },
];

export const mockRequests: Request[] = [
  {
    id: "PAY-001",
    poNumber: "OC-8829",
    projectNumber: "Solar Farm Alpha",
    beneficiary: "Suministros Eléctricos S.A.",
    concept: "Compra de transformadores",
    subtotal: 38793.1,
    iva: 6206.9,
    amount: 45000,
    currency: "MXN",
    department: "Ingeniería",
    status: "Autorización",
    submittedBy: "Juan Perez",
    date: "2023-10-25",
    statusHistory: [
      {
        status: "Draft",
        timestamp: "2023-10-25T09:00:00Z",
        changedBy: "Juan Perez",
      },
      {
        status: "Autorización",
        timestamp: "2023-10-25T09:05:00Z",
        changedBy: "Juan Perez",
      },
    ],
  },
  {
    id: "PAY-002",
    poNumber: "OC-9012",
    projectNumber: "Residencial Beta",
    beneficiary: "Paneles del Norte",
    concept: "Paneles solares 450W",
    subtotal: 1077.59,
    iva: 172.41,
    amount: 1250,
    currency: "USD",
    department: "Compras",
    status: "Approved",
    submittedBy: "Maria Garcia",
    date: "2023-10-24",
    statusHistory: [
      {
        status: "Draft",
        timestamp: "2023-10-24T08:30:00Z",
        changedBy: "Maria Garcia",
      },
      {
        status: "Autorización",
        timestamp: "2023-10-24T08:35:00Z",
        changedBy: "Maria Garcia",
      },
      {
        status: "Pending Fin",
        timestamp: "2023-10-24T14:20:00Z",
        changedBy: "Sebastián Torres",
      },
      {
        status: "Approved",
        timestamp: "2023-10-25T10:15:00Z",
        changedBy: "Pedro Avalos",
      },
    ],
  },
  {
    id: "PAY-003",
    poNumber: "OC-7721",
    projectNumber: "Industrial Gamma",
    beneficiary: "Logística Express",
    concept: "Flete de materiales",
    subtotal: 7672.41,
    iva: 1227.59,
    amount: 8900,
    currency: "MXN",
    department: "Logística",
    status: "Pending Fin",
    submittedBy: "Carlos Ruiz",
    date: "2023-10-26",
    statusHistory: [
      {
        status: "Draft",
        timestamp: "2023-10-26T07:45:00Z",
        changedBy: "Carlos Ruiz",
      },
      {
        status: "Autorización",
        timestamp: "2023-10-26T07:50:00Z",
        changedBy: "Carlos Ruiz",
      },
      {
        status: "Pending Fin",
        timestamp: "2023-10-26T16:30:00Z",
        changedBy: "Israel Mendoza",
      },
    ],
  },
  {
    id: "PAY-004",
    poNumber: "OC-8830",
    projectNumber: "Solar Farm Alpha",
    beneficiary: "Conductores del Sur",
    concept: "Cable fotovoltaico 10 AWG",
    subtotal: 19396.55,
    iva: 3103.45,
    amount: 22500,
    currency: "MXN",
    department: "Ingeniería",
    status: "Rejected",
    submittedBy: "Ana López",
    date: "2023-10-22",
    comment: "Documentación incompleta",
    statusHistory: [
      {
        status: "Draft",
        timestamp: "2023-10-22T10:00:00Z",
        changedBy: "Ana López",
      },
      {
        status: "Autorización",
        timestamp: "2023-10-22T10:05:00Z",
        changedBy: "Ana López",
      },
      {
        status: "Rejected",
        timestamp: "2023-10-23T11:40:00Z",
        changedBy: "Gabriel Ríos",
        comment: "Documentación incompleta",
      },
    ],
  },
  {
    id: "PAY-005",
    poNumber: "OC-6610",
    projectNumber: "Eólico Delta",
    beneficiary: "TechnoVerde S.A.",
    concept: "Servicio de mantenimiento preventivo",
    subtotal: 2758.62,
    iva: 441.38,
    amount: 3200,
    currency: "USD",
    department: "Operaciones",
    status: "Draft",
    submittedBy: "Emiliano Martínez Tejeda",
    date: "2023-10-27",
    statusHistory: [
      {
        status: "Draft",
        timestamp: "2023-10-27T11:00:00Z",
        changedBy: "Emiliano Martínez Tejeda",
      },
    ],
  },
];

export const projects = [
  "Solar Farm Alpha",
  "Residencial Beta",
  "Industrial Gamma",
  "Eólico Delta",
  "Hidro Epsilon",
];

export const poNumbers = [
  "OC-8829",
  "OC-9012",
  "OC-7721",
  "OC-8830",
  "OC-6610",
  "OC-5501",
  "OC-4432",
  "OC-3321",
];

export const statusColors: Record<string, string> = {
  Draft: "bg-gray-500",
  Autorización: "bg-yellow-500",
  "Pending Fin": "bg-blue-500",
  Approved: "bg-green-500",
  Rejected: "bg-red-500",
  Paid: "bg-purple-500",
};

// Agregar al final de mockData.ts
export const STATUS = {
  DRAFT: "Draft",
  AUTORIZACION: "Autorizaci\u00f3n",
  PENDING_FIN: "Pending Fin",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
} as const;

export const STATUS_LABEL: Record<string, string> = {
  Draft: "Borrador",
  "Autorización": "En autorización",
  "Pending Fin": "Revisión Finanzas",
  Approved: "Aprobada",
  Paid: "Pagada",
  Rejected: "Rechazada",
};

export const STATUS_DESC: Record<string, string> = {
  Draft: "Pendiente de envío",
  "Autorización": "Tu jefe directo está revisando",
  "Pending Fin": "El equipo de Finanzas la está revisando",
  Approved: "Lista para programar el pago",
  Paid: "Pago procesado correctamente",
  Rejected: "Revisa el motivo y corrige si aplica",
};

// Hex equivalents — para charts, dots, sombras (no para Tailwind).
export const STATUS_HEX: Record<string, string> = {
  Draft: "#828080",
  "Autorización": "#eab308",
  "Pending Fin": "#3D7D80",
  Approved: "#00AA85",
  Paid: "#a855f7",
  Rejected: "#ef4444",
};