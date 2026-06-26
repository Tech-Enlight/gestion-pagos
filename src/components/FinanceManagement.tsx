import React, { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Banknote,
  HelpCircle,
  XCircle,
  Save,
  User,
  Clock,
  Loader2,
  DollarSign,
  AlertTriangle,
  X
} from "lucide-react";
import StatusPill from "./StatusPill";
import RejectModal from "./RejectModal";
import PaymentModal from "./PaymentModal";
import { STATUS } from "../data/mockData";
import type { Request, FinanceNote, ExchangeRate } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import type { PaymentData } from "./PaymentModal";
import { fetchBillsByOC, fetchProjectById, fetchInvoiceLinkByOC } from "../services/sheets";
import type { NSBill } from "../services/sheets";

interface Props {
  requests: Request[];
  lastExchangeRate: ExchangeRate;
  onUpdateRequest: (id: string, status: string, extra?: any) => void;
  onUpdateFinanceFields: (id: string, fields: Partial<Request>) => void;
}

type Filter = "all" | "pending" | "approved";

const FinanceManagement: React.FC<Props> = ({
  requests,
  lastExchangeRate,
  onUpdateRequest,
  onUpdateFinanceFields,
}) => {
  const { user } = useAuth();
  const isAnalista = user?.role === "analista_contable";
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [clarifyTarget, setClarifyTarget] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<string | null>(null);
  const [estimatedDateTarget, setEstimatedDateTarget] = useState<string | null>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [isBulkPaying, setIsBulkPaying] = useState(false);
  const [bulkClarifyTarget, setBulkClarifyTarget] = useState<string[] | null>(null);
  const [bulkRejectTarget, setBulkRejectTarget] = useState<string[] | null>(null);
  const [bulkEstimatedDateTarget, setBulkEstimatedDateTarget] = useState<string[] | null>(null);

  // NS bills gate state
  const [nsLoading, setNsLoading] = useState(false);
  const [nsBlockMessage, setNsBlockMessage] = useState<string | null>(null);
  const [nsPaidBills, setNsPaidBills] = useState<NSBill[] | null>(null);
  const [nsPoStatus, setNsPoStatus] = useState<string | null>(null);
  const [nsProjectClient, setNsProjectClient] = useState<string | null>(null);
  const [nsInvoiceLink, setNsInvoiceLink] = useState<string | null>(null);
  const [nsClientMap, setNsClientMap] = useState<Record<string, string> | null>(null);
  const [nsInvoiceLinkMap, setNsInvoiceLinkMap] = useState<Record<string, string> | null>(null);
  // For bulk: track which requests were blocked
  const [nsBulkBlocked, setNsBulkBlocked] = useState<string[]>([]);
  const [nsPaidBillsMap, setNsPaidBillsMap] = useState<Record<string, NSBill[]> | null>(null);

  // Editable finance fields for the selected request
  const [finObs, setFinObs] = useState("");

  const lastRate = lastExchangeRate;

  // Filter logic
  const financeRequests = useMemo(() => {
    if (isAnalista) {
      return requests.filter((r) => r.status === STATUS.PAYMENT_APPROVED);
    }
    return requests.filter((r) => {
      if (filter === "pending") return r.status === STATUS.PENDING_FIN;
      if (filter === "approved") return r.status === STATUS.APPROVED;
      return r.status === STATUS.PENDING_FIN || r.status === STATUS.APPROVED;
    });
  }, [requests, filter, isAnalista]);

  const selected = financeRequests.find((r) => r.id === selectedId) ?? null;

  // Clear selections when filter/tab changes
  useEffect(() => {
    setSelectedIds([]);
  }, [filter]);

  const counts = useMemo(() => {
    const pending = requests.filter((r) => r.status === STATUS.PENDING_FIN).length;
    const approved = requests.filter((r) => r.status === STATUS.APPROVED).length;
    const paymentApproved = requests.filter((r) => r.status === STATUS.PAYMENT_APPROVED).length;
    return { pending, approved, paymentApproved, all: pending + approved };
  }, [requests]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Selection calculations
  const selectedRequests = useMemo(() => {
    return requests.filter((r) => selectedIds.includes(r.id));
  }, [requests, selectedIds]);

  const allPending = selectedRequests.length > 0 && selectedRequests.every(r => r.status === STATUS.PENDING_FIN);
  const allApproved = selectedRequests.length > 0 && selectedRequests.every(r => r.status === STATUS.APPROVED);
  const allPaymentApproved = selectedRequests.length > 0 && selectedRequests.every(r => r.status === STATUS.PAYMENT_APPROVED);
  const isMixed = selectedRequests.length > 0 && !allPending && !allApproved && !allPaymentApproved;

  // When selecting a row, load its current finObs
  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    setSaveSuccess(false);
    if (id) {
      const req = requests.find((r) => r.id === id);
      setFinObs(req?.financeObservations || "");
    }
  };

  // Actions
  const handleApprove = () => {
    if (!selected) return;
    // Save observations if any
    if (finObs.trim()) {
      onUpdateFinanceFields(selected.id, {
        financeObservations: finObs.trim(),
      });
    }
    onUpdateRequest(selected.id, STATUS.APPROVED);
    setSelectedId(null);
  };

  const handleApprovePayment = () => {
    if (!selected) return;
    if (finObs.trim()) {
      onUpdateFinanceFields(selected.id, { financeObservations: finObs.trim() });
    }
    onUpdateRequest(selected.id, STATUS.PAYMENT_APPROVED);
    setSelectedId(null);
  };

  const handleMarkPaid = (id: string, paymentData: PaymentData) => {
    onUpdateFinanceFields(id, {
      amountPaid: paymentData.amountPaid,
      exchangeRateUsed: paymentData.exchangeRate,
      amountMXN: paymentData.amountMXN,
      bankName: paymentData.bankName,
      operationRef: paymentData.operationRef,
      paymentMode: paymentData.paymentMode,
      invoiceNumber: paymentData.invoiceNumber,
      invoiceLink: paymentData.invoiceLink,
      expenseType: paymentData.expenseType,
      operationType: paymentData.operationType,
      ocStatus: paymentData.ocStatus,
      client: paymentData.client,
      serviceDelivery: paymentData.serviceDelivery,
      proposal: paymentData.proposal,
      paymentProof: paymentData.paymentProof,
      financeObservations: finObs.trim() || undefined,
    });
    onUpdateRequest(id, STATUS.PAID);
    setPayTarget(null);
    setSelectedId(null);
  };

  const handleReject = (id: string, comment: string) => {
    if (finObs.trim()) {
      onUpdateFinanceFields(id, { financeObservations: finObs.trim() });
    }
    onUpdateRequest(id, STATUS.REJECTED, { rejectReason: comment });
    setRejectTarget(null);
    setSelectedId(null);
  };

  const handleClarifyConfirm = (id: string, comment: string) => {
    if (finObs.trim()) {
      onUpdateFinanceFields(id, { financeObservations: finObs.trim() });
    }
    onUpdateRequest(id, STATUS.DRAFT, { clarificationRequest: comment });
    setClarifyTarget(null);
    setSelectedId(null);
  };

  const handleSaveEstimatedDate = (id: string, date: string) => {
    onUpdateFinanceFields(id, {
      estimatedPaymentDate: date,
      financeObservations: finObs.trim() || undefined,
    });
    setEstimatedDateTarget(null);
  };

  const handleSaveObs = async () => {
    if (!selected || isSaving || !finObs.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateFinanceFields(selected.id, { financeObservations: finObs.trim() });
      setFinObs(""); // Clear the input
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // NS-gated "Marcar Pagado" — individual
  const handleMarkPaidGate = async (req: Request) => {
    if (!req.nsOcInternalId) {
      setNsBlockMessage("No hay OC vinculada a NetSuite para esta solicitud.");
      return;
    }
    setNsLoading(true);
    setNsBlockMessage(null);
    setNsPoStatus(null);
    setNsProjectClient(null);
    setNsInvoiceLink(null);
    try {
      const data = await fetchBillsByOC(req.nsOcInternalId);
      const paidBills = data.bills.filter((b) => b.is_paid);
      if (paidBills.length === 0) {
        setNsBlockMessage(
          "El pago aún no está registrado en NetSuite. Registra el pago en NS antes de marcar como pagado en el portal."
        );
      } else {
        setNsPaidBills(paidBills);
        setNsPoStatus(data.po_status ?? null);
        if (req.nsProjectId) {
          fetchProjectById(req.nsProjectId).then(proj => {
            setNsProjectClient(proj?.customer?.name ?? null);
          });
        }
        if (req.poNumber) {
          fetchInvoiceLinkByOC(req.poNumber).then(result => {
            setNsInvoiceLink(result?.drive_folder_url ?? null);
          });
        }
        setPayTarget(req.id);
      }
    } catch (err) {
      console.error(err);
      setNsBlockMessage("Error al consultar NetSuite. Intenta de nuevo.");
    } finally {
      setNsLoading(false);
    }
  };

  // NS-gated "Marcar Pagadas" — bulk
  const handleBulkMarkPaidGate = async () => {
    if (selectedIds.length === 0) return;
    setNsLoading(true);
    setNsBlockMessage(null);
    setNsBulkBlocked([]);

    const eligible: Request[] = [];
    const blocked: string[] = [];
    const allPaidBillsMap: Record<string, NSBill[]> = {};
    const allPoStatusMap: Record<string, string> = {};

    try {
      const allClientMap: Record<string, string> = {};
      const allInvoiceLinkMap: Record<string, string> = {};

      for (const req of selectedRequests) {
        if (!req.nsOcInternalId) {
          blocked.push(req.id);
          continue;
        }
        const [data, proj, invLink] = await Promise.all([
          fetchBillsByOC(req.nsOcInternalId),
          req.nsProjectId ? fetchProjectById(req.nsProjectId) : Promise.resolve(null),
          req.poNumber ? fetchInvoiceLinkByOC(req.poNumber) : Promise.resolve(null),
        ]);
        const paidBills = data.bills.filter((b) => b.is_paid);
        if (paidBills.length === 0) {
          blocked.push(req.id);
        } else {
          eligible.push(req);
          allPaidBillsMap[req.id] = paidBills;
          if (data.po_status) allPoStatusMap[req.id] = data.po_status;
          if (proj?.customer?.name) allClientMap[req.id] = proj.customer.name;
          if (invLink?.drive_folder_url) allInvoiceLinkMap[req.id] = invLink.drive_folder_url;
        }
      }

      if (blocked.length > 0) {
        setNsBulkBlocked(blocked);
      }
      if (eligible.length === 0) {
        setNsBlockMessage(
          "Ninguna solicitud tiene pago registrado en NetSuite. Registra los pagos en NS primero."
        );
      } else {
        setNsPaidBillsMap(allPaidBillsMap);
        setNsClientMap(allClientMap);
        setNsInvoiceLinkMap(allInvoiceLinkMap);
        // Filter selectedIds to only eligible, then open bulk payment modal
        setSelectedIds(eligible.map((r) => r.id));
        setIsBulkPaying(true);
      }
    } catch (err) {
      console.error(err);
      setNsBlockMessage("Error al consultar NetSuite. Intenta de nuevo.");
    } finally {
      setNsLoading(false);
    }
  };

  // Bulk Action Handlers
  const allSelected = financeRequests.length > 0 && selectedIds.length === financeRequests.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(financeRequests.map(r => r.id));
    }
  };

  const handleSelectRow = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`¿Aprobar las ${selectedIds.length} solicitudes de finanzas seleccionadas?`)) return;
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        if (finObs.trim()) {
          await onUpdateFinanceFields(id, { financeObservations: finObs.trim() });
        }
        await onUpdateRequest(id, STATUS.APPROVED);
      }
      setSelectedIds([]);
      setSelectedId(null);
    } catch (error) {
      console.error("Error bulk approving:", error);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkApprovePayment = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`¿Aprobar el pago de las ${selectedIds.length} solicitudes seleccionadas?`)) return;
    setIsBulkOperating(true);
    try {
      for (const id of selectedIds) {
        if (finObs.trim()) {
          await onUpdateFinanceFields(id, { financeObservations: finObs.trim() });
        }
        await onUpdateRequest(id, STATUS.PAYMENT_APPROVED);
      }
      setSelectedIds([]);
      setSelectedId(null);
    } catch (error) {
      console.error("Error bulk approving payment:", error);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkClarificationConfirm = async (_labelId: string, comment: string) => {
    if (!bulkClarifyTarget) return;
    setIsBulkOperating(true);
    try {
      for (const id of bulkClarifyTarget) {
        if (finObs.trim()) {
          await onUpdateFinanceFields(id, { financeObservations: finObs.trim() });
        }
        await onUpdateRequest(id, STATUS.DRAFT, { clarificationRequest: comment });
      }
      setSelectedIds([]);
      setBulkClarifyTarget(null);
      setSelectedId(null);
    } catch (error) {
      console.error("Error bulk clarifying:", error);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkRejectConfirm = async (_labelId: string, comment: string) => {
    if (!bulkRejectTarget) return;
    setIsBulkOperating(true);
    try {
      for (const id of bulkRejectTarget) {
        if (finObs.trim()) {
          await onUpdateFinanceFields(id, { financeObservations: finObs.trim() });
        }
        await onUpdateRequest(id, STATUS.REJECTED, { rejectReason: comment });
      }
      setSelectedIds([]);
      setBulkRejectTarget(null);
      setSelectedId(null);
    } catch (error) {
      console.error("Error bulk rejecting:", error);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkSaveEstimatedDate = async (_labelId: string, date: string) => {
    if (!bulkEstimatedDateTarget) return;
    setIsBulkOperating(true);
    try {
      for (const id of bulkEstimatedDateTarget) {
        await onUpdateFinanceFields(id, {
          estimatedPaymentDate: date,
          financeObservations: finObs.trim() || undefined,
        });
      }
      setSelectedIds([]);
      setBulkEstimatedDateTarget(null);
    } catch (error) {
      console.error("Error bulk saving estimated date:", error);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkMarkPaidConfirm = async (data: { id: string; paymentData: PaymentData }[]) => {
    setIsBulkOperating(true);
    setIsBulkPaying(false);
    try {
      for (const item of data) {
        await onUpdateFinanceFields(item.id, {
          ...item.paymentData,
          financeObservations: finObs.trim() || undefined,
        });
        await onUpdateRequest(item.id, STATUS.PAID);
      }
      setSelectedIds([]);
      setSelectedId(null);
    } catch (error) {
      console.error("Error bulk marking paid:", error);
    } finally {
      setIsBulkOperating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-white text-2xl font-bold mb-1"
            style={{ fontFamily: "Alexandria, sans-serif" }}
          >
            Gestión de Finanzas
          </h2>
          <p className="text-gray-400 text-sm">
            Control de tesorería y programación de pagos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isBulkOperating && (
            <div className="flex items-center gap-2 text-xs text-[#00aa85] font-semibold bg-[#243545] px-3 py-1.5 rounded-lg border border-[#00aa85]/20 animate-pulse mr-2">
              <Loader2 size={14} className="animate-spin" />
              Procesando lote...
            </div>
          )}

          {/* Banxico T/C indicator */}
          <div
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 flex items-center gap-1.5"
            style={{ backgroundColor: "#1e2d3d" }}
          >
            <DollarSign size={12} className="text-[#00aa85]" />
            <span>T/C Banxico:</span>
            <strong className="text-white">
              ${lastRate.rate.toFixed(4)}
            </strong>
            <span className="text-gray-500">({lastRate.date})</span>
          </div>
        </div>
      </div>

      {/* Tabs / Filters */}
      <div className="flex gap-2">
        {isAnalista ? (
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00aa85] text-white"
            style={{ fontFamily: "Alexandria, sans-serif" }}
          >
            Pago Aprobado ({counts.paymentApproved})
          </button>
        ) : (
          <>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === "all"
                ? "bg-[#00aa85] text-white"
                : "bg-[#1e2d3d] text-gray-400 hover:text-white"
                }`}
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Todas ({counts.all})
            </button>
            <button
              onClick={() => setFilter("pending")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === "pending"
                ? "bg-[#00aa85] text-white"
                : "bg-[#1e2d3d] text-gray-400 hover:text-white"
                }`}
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Pendientes Finanzas ({counts.pending})
            </button>
            <button
              onClick={() => setFilter("approved")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === "approved"
                ? "bg-[#00aa85] text-white"
                : "bg-[#1e2d3d] text-gray-400 hover:text-white"
                }`}
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Aprobadas ({counts.approved})
            </button>
          </>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-[#00aa85]/30 bg-[#243545] shadow-lg shadow-[#00aa85]/5 transition-all duration-300">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[#00aa85] text-sm font-bold">✓</span>
              <span className="text-gray-200 text-sm font-medium">
                {selectedIds.length} solicitud{selectedIds.length !== 1 ? "es" : ""} seleccionada{selectedIds.length !== 1 ? "s" : ""}
              </span>
            </div>
            {isMixed && (
              <span className="text-yellow-400 text-[10px] font-medium">
                <AlertTriangle size={11} className="inline mr-1" /> Selección mixta: Filtra por pestaña para ver acciones específicas (Aprobación/Pago).
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allPending && !isAnalista && (
              <button
                onClick={handleBulkApprove}
                disabled={isBulkOperating}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors shadow shadow-green-950/20"
              >
                <CheckCircle2 size={14} />
                Aprobar Finanzas
              </button>
            )}

            {allApproved && !isAnalista && (
              <>
                <button
                  onClick={handleBulkApprovePayment}
                  disabled={isBulkOperating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow shadow-blue-950/20"
                >
                  <CheckCircle2 size={14} />
                  Aprobar Pago
                </button>
                <button
                  onClick={() => setBulkEstimatedDateTarget(selectedIds)}
                  disabled={isBulkOperating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow shadow-blue-950/20"
                >
                  <Clock size={14} />
                  Fecha Estimada
                </button>
              </>
            )}

            {allPaymentApproved && isAnalista && (
              <button
                onClick={handleBulkMarkPaidGate}
                disabled={isBulkOperating || nsLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors shadow shadow-purple-950/20"
              >
                {nsLoading ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
                {nsLoading ? "Consultando NS..." : "Marcar Pagadas"}
              </button>
            )}

            <button
              onClick={() => setBulkClarifyTarget(selectedIds)}
              disabled={isBulkOperating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 transition-colors shadow shadow-yellow-950/20"
            >
              <HelpCircle size={14} />
              Aclaración
            </button>
            <button
              onClick={() => setBulkRejectTarget(selectedIds)}
              disabled={isBulkOperating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors shadow shadow-red-950/20"
            >
              <XCircle size={14} />
              Rechazar
            </button>
            <div className="w-[1px] h-6 bg-gray-700 mx-1"></div>
            <button
              onClick={() => setSelectedIds([])}
              disabled={isBulkOperating}
              className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs font-medium border border-gray-600 hover:border-gray-500 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div
        className="rounded-xl border border-gray-700 overflow-hidden"
        style={{ backgroundColor: "#1e2d3d" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#293C47" }}>
              <th className="px-4 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  disabled={isBulkOperating || financeRequests.length === 0}
                  className="rounded border-gray-600 text-[#00aa85] focus:ring-0 focus:ring-offset-0 bg-[#293C47] cursor-pointer disabled:opacity-50"
                />
              </th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                ID
              </th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                Beneficiario
              </th>
              <th className="text-left px-4 py-3 text-gray-300 font-semibold">
                Proyecto / Depto
              </th>
              <th className="text-right px-4 py-3 text-gray-300 font-semibold">
                Monto
              </th>
              <th className="text-center px-4 py-3 text-gray-300 font-semibold">
                Estado
              </th>
              <th className="text-center px-4 py-3 text-gray-300 font-semibold">
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {financeRequests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hay solicitudes en esta bandeja
                </td>
              </tr>
            )}
            {financeRequests.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-gray-700 transition-colors cursor-pointer ${selectedId === r.id ? "bg-[#243545]" : "hover:bg-[#243545]"
                  }`}
                onClick={() => handleSelect(selectedId === r.id ? null : r.id)}
              >
                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={(e) => handleSelectRow(e, r.id)}
                    disabled={isBulkOperating}
                    className="rounded border-gray-600 text-[#00aa85] focus:ring-0 focus:ring-offset-0 bg-[#293C47] cursor-pointer disabled:opacity-50"
                  />
                </td>
                <td className="px-4 py-3 text-[#00aa85] font-medium">{r.id}</td>
                <td className="px-4 py-3 text-gray-300">{r.beneficiary}</td>
                <td className="px-4 py-3 text-gray-400">{r.projectNumber}</td>
                <td className="px-4 py-3 text-gray-200 text-right">
                  {r.amount.toLocaleString("es-MX")} {r.currency}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(r.id);
                    }}
                    className="px-3 py-1 rounded text-xs font-medium text-white transition-colors hover:opacity-90 animate-fadeIn"
                    style={{ backgroundColor: "#3d7d80" }}
                  >
                    Revisar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline Detail Panel (when selected) */}
      {selected && (
        <div
          className="rounded-xl border border-gray-700 overflow-hidden animate-fadeIn"
          style={{ backgroundColor: "#1e2d3d" }}
        >
          {/* Panel Header */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b border-gray-700"
            style={{ backgroundColor: "#293C47" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-white font-semibold"
                style={{ fontFamily: "Alexandria, sans-serif" }}
              >
                {selected.id}
              </span>
              <StatusPill status={selected.status} />
            </div>
            <button
              onClick={() => handleSelect(null)}
              className="btn-close" aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Core Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            <Field label="Beneficiario" value={selected.beneficiary} />
            <Field label="Proyecto / Depto." value={selected.projectNumber} />
            <Field label="OC" value={selected.poNumber} />
            <Field label="Concepto" value={selected.concept} />
            <Field label="Departamento" value={selected.department} />
            <Field label="Solicitante" value={selected.submittedBy} />
            <Field
              label="Subtotal"
              value={`$${selected.subtotal.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}`}
            />
            <Field
              label="IVA"
              value={`$${selected.iva.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })}`}
            />
            <Field
              label="Monto Solicitado"
              value={`$${selected.amount.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })} ${selected.currency}`}
              highlight
            />
          </div>

          {/* Finance notes section */}
          <div className="px-5 py-4 border-t border-gray-700">
            <label className="text-gray-400 text-xs font-medium mb-1 block">
              Notas y Observaciones de Finanzas
            </label>
            <div className="flex gap-2">
              <textarea
                value={finObs}
                onChange={(e) => setFinObs(e.target.value)}
                placeholder="Escribe una observación interna..."
                rows={2}
                className="flex-1 px-3 py-1.5 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-[#00aa85] resize-none"
                style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
              />
              <button
                onClick={handleSaveObs}
                disabled={isSaving || !finObs.trim()}
                className="px-4 rounded-lg text-white text-xs font-semibold bg-[#00aa85] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all"
              >
                {isSaving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 size={14} />
                    ¡Guardado!
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Guardar nota
                  </>
                )}
              </button>
            </div>

            {/* Observation History Timeline */}
            {selected.financeObservations && (
              <div className="mt-4 space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  let notes: FinanceNote[] = [];
                  try {
                    const parsed = JSON.parse(selected.financeObservations);
                    notes = Array.isArray(parsed) ? parsed : [{ text: selected.financeObservations, timestamp: new Date().toISOString(), user: "Nota anterior" }];
                  } catch {
                    notes = [{ text: selected.financeObservations, timestamp: new Date().toISOString(), user: "Nota anterior" }];
                  }

                  return notes.slice().reverse().map((note, idx) => (
                    <div key={idx} className="bg-[#1a2b34] p-3 rounded-lg border border-gray-700/50">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#00aa85] font-medium uppercase tracking-wider">
                          <User size={10} />
                          {note.user}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Clock size={10} />
                          {new Date(note.timestamp).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed" style={{ fontFamily: "Alexandria, sans-serif" }}>
                        {note.text}
                      </p>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Show previously saved finance data if exists */}
          {(selected.amountPaid ||
            selected.bankName ||
            selected.operationRef ||
            selected.estimatedPaymentDate) && (
              <div className="px-5 py-3 border-t border-gray-700">
                <p
                  className="text-purple-400 text-xs font-semibold mb-3 uppercase tracking-wide"
                  style={{ fontFamily: "Alexandria, sans-serif" }}
                >
                  Datos de Pago Registrados / Programados
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selected.estimatedPaymentDate && (
                    <Field
                      label="Fecha Est. Pago"
                      value={selected.estimatedPaymentDate}
                    />
                  )}
                  {selected.amountPaid && (
                    <Field
                      label="Monto Pagado"
                      value={`$${selected.amountPaid.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })} ${selected.currency}`}
                    />
                  )}
                  {selected.bankName && (
                    <Field label="Banco" value={selected.bankName} />
                  )}
                  {selected.operationRef && (
                    <Field label="Ref. Operación" value={selected.operationRef} />
                  )}
                  {selected.paymentMode && (
                    <Field label="Modo Pago" value={selected.paymentMode} />
                  )}
                  {selected.exchangeRateUsed && (
                    <Field
                      label="T/C Usado"
                      value={selected.exchangeRateUsed.toFixed(4)}
                    />
                  )}
                  {selected.amountMXN && (
                    <Field
                      label="Monto MXN"
                      value={`$${selected.amountMXN.toLocaleString("es-MX", {
                        minimumFractionDigits: 2,
                      })}`}
                    />
                  )}
                  {selected.invoiceNumber && (
                    <Field label="Factura" value={selected.invoiceNumber} />
                  )}
                  {selected.operationType && (
                    <Field
                      label="Tipo Operación"
                      value={selected.operationType}
                    />
                  )}
                  {selected.expenseType && (
                    <Field label="Tipo Gasto" value={selected.expenseType} />
                  )}
                </div>
              </div>
            )}

          {/* Comment from previous step */}
          {selected.comment && (
            <div className="px-5 pb-4">
              <div
                className="rounded-lg p-3 border border-yellow-600"
                style={{ backgroundColor: "#2a2a1a" }}
              >
                <p className="text-yellow-400 text-xs font-medium mb-1">
                  Comentario de Aclaración / Rechazo anterior
                </p>
                <p className="text-yellow-200 text-xs">{selected.comment}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-700 flex-wrap">
            {selected.status === STATUS.PENDING_FIN && !isAnalista && (
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-green-600 hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20"
              >
                <CheckCircle2 size={16} />
                Aprobar
              </button>
            )}
            {selected.status === STATUS.APPROVED && !isAnalista && (
              <>
                <button
                  onClick={handleApprovePayment}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                >
                  <CheckCircle2 size={16} />
                  Aprobar Pago
                </button>
                <button
                  onClick={() => setEstimatedDateTarget(selected.id)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                >
                  <Clock size={16} />
                  Fecha Estimada
                </button>
              </>
            )}
            {selected.status === STATUS.PAYMENT_APPROVED && isAnalista && (
              <button
                onClick={() => handleMarkPaidGate(selected)}
                disabled={nsLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-purple-900/20"
              >
                {nsLoading ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
                {nsLoading ? "Consultando NS..." : "Marcar Pagado"}
              </button>
            )}
            <button
              onClick={() => setClarifyTarget(selected.id)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 transition-colors shadow-lg shadow-yellow-900/20"
            >
              <HelpCircle size={16} />
              Aclaración
            </button>
            <button
              onClick={() => setRejectTarget(selected.id)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
            >
              <XCircle size={16} />
              Rechazar
            </button>
          </div>
        </div>
      )}

      {/* NS Block Message Banner */}
      {nsBlockMessage && (
        <div
          className="rounded-xl border border-red-600/50 p-4 flex items-start gap-3 animate-fadeIn"
          style={{ backgroundColor: "#2a1a1a" }}
        >
          <XCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">{nsBlockMessage}</p>
            {nsBulkBlocked.length > 0 && (
              <p className="text-red-400/70 text-xs mt-1">
                Solicitudes bloqueadas: {nsBulkBlocked.join(", ")}
              </p>
            )}
          </div>
          <button
            onClick={() => { setNsBlockMessage(null); setNsBulkBlocked([]); }}
            className="btn-close" aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Individual Modals */}
      {rejectTarget && (
        <RejectModal
          requestId={rejectTarget}
          onConfirm={handleReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      {clarifyTarget && (
        <ClarifyModal
          requestId={clarifyTarget}
          onConfirm={handleClarifyConfirm}
          onCancel={() => setClarifyTarget(null)}
        />
      )}
      {payTarget && selected && (
        <PaymentModal
          request={selected}
          lastExchangeRate={lastExchangeRate}
          nsPaidBills={nsPaidBills ?? undefined}
          nsPoStatus={nsPoStatus ?? undefined}
          nsProjectClient={nsProjectClient ?? undefined}
          nsInvoiceLink={nsInvoiceLink ?? undefined}
          onConfirm={handleMarkPaid}
          onCancel={() => { setPayTarget(null); setNsPaidBills(null); setNsPoStatus(null); setNsProjectClient(null); setNsInvoiceLink(null); }}
        />
      )}
      {estimatedDateTarget && selected && (
        <EstimatedDateModal
          requestId={estimatedDateTarget}
          currentDate={selected.estimatedPaymentDate}
          onConfirm={handleSaveEstimatedDate}
          onCancel={() => setEstimatedDateTarget(null)}
        />
      )}

      {/* Bulk Action Modals */}
      {bulkClarifyTarget && (
        <ClarifyModal
          requestId={`${bulkClarifyTarget.length} solicitudes`}
          onConfirm={handleBulkClarificationConfirm}
          onCancel={() => setBulkClarifyTarget(null)}
        />
      )}
      {bulkRejectTarget && (
        <RejectModal
          requestId={`de ${bulkRejectTarget.length} solicitudes`}
          onConfirm={handleBulkRejectConfirm}
          onCancel={() => setBulkRejectTarget(null)}
        />
      )}
      {bulkEstimatedDateTarget && (
        <EstimatedDateModal
          requestId={`${bulkEstimatedDateTarget.length} solicitudes`}
          onConfirm={handleBulkSaveEstimatedDate}
          onCancel={() => setBulkEstimatedDateTarget(null)}
        />
      )}
      {isBulkPaying && (
        <PaymentModal
          requests={selectedRequests}
          lastExchangeRate={lastExchangeRate}
          nsPaidBillsMap={nsPaidBillsMap ?? undefined}
          nsClientMap={nsClientMap ?? undefined}
          nsInvoiceLinkMap={nsInvoiceLinkMap ?? undefined}
          onConfirm={() => { }}
          onConfirmBulk={handleBulkMarkPaidConfirm}
          onCancel={() => { setIsBulkPaying(false); setNsPaidBillsMap(null); setNsClientMap(null); setNsInvoiceLinkMap(null); }}
        />
      )}
    </div>
  );
};

/* Reusable field display */
const Field: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-gray-500 text-xs">{label}</span>
    <span
      className={`text-sm font-medium ${highlight ? "text-[#00aa85]" : "text-gray-200"
        }`}
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {value}
    </span>
  </div>
);

/* Clarify modal */
const ClarifyModal: React.FC<{
  requestId: string;
  onConfirm: (id: string, comment: string) => void;
  onCancel: () => void;
}> = ({ requestId, onConfirm, onCancel }) => {
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState("");

  const handleConfirm = () => {
    if (!comment.trim()) {
      setError("Describe qué necesitas que se aclare.");
      return;
    }
    onConfirm(requestId, comment.trim());
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="rounded-xl p-6 border border-yellow-700 shadow-2xl max-w-md w-full mx-4"
        style={{ backgroundColor: "#1e2d3d" }}
      >
        <h3
          className="text-white text-lg font-bold mb-2"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Solicitar Aclaración — {requestId}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Describe qué información necesitas que se corrija o se aclare.
        </p>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setError("");
          }}
          placeholder="Ej: Falta factura anexa, verificar monto..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-yellow-500 resize-none"
          style={{
            backgroundColor: "#293C47",
            fontFamily: "Alexandria, sans-serif",
          }}
        />
        {error && <p className="text-yellow-400 text-xs mt-1">{error}</p>}
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-gray-300 text-sm font-medium border border-gray-600 hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 transition-colors"
          >
            Enviar Aclaración
          </button>
        </div>
      </div>
    </div>
  );
};

/* Estimated Date modal */
const EstimatedDateModal: React.FC<{
  requestId: string;
  currentDate?: string;
  onConfirm: (id: string, date: string) => void;
  onCancel: () => void;
}> = ({ requestId, currentDate = "", onConfirm, onCancel }) => {
  const [date, setDate] = React.useState(currentDate);
  const [error, setError] = React.useState("");

  const handleConfirm = () => {
    if (!date) {
      setError("Por favor selecciona una fecha.");
      return;
    }
    onConfirm(requestId, date);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="rounded-xl p-6 border border-blue-700 shadow-2xl max-w-md w-full mx-4"
        style={{ backgroundColor: "#1e2d3d" }}
      >
        <h3
          className="text-white text-lg font-bold mb-2"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Fecha Estimada de Pago — {requestId}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Selecciona la fecha estimada en la que se realizará el pago de esta solicitud o lote.
        </p>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setError("");
          }}
          className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-blue-500"
          style={{
            backgroundColor: "#293C47",
            fontFamily: "Alexandria, sans-serif",
          }}
        />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-gray-300 text-sm font-medium border border-gray-600 hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Guardar Fecha
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceManagement;