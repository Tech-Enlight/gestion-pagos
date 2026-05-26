import React, { useState, useEffect } from "react";
import type { Request, ExchangeRate } from "../data/mockData";
import type { NSBill } from "../services/sheets";

interface Props {
  request?: Request;
  requests?: Request[];
  lastExchangeRate: ExchangeRate;
  nsPaidBills?: NSBill[];
  nsPaidBillsMap?: Record<string, NSBill[]>;
  nsPoStatus?: string;
  nsProjectClient?: string;
  nsInvoiceLink?: string;
  nsClientMap?: Record<string, string>;
  nsInvoiceLinkMap?: Record<string, string>;
  onConfirm: (id: string, paymentData: PaymentData) => void;
  onConfirmBulk?: (data: { id: string; paymentData: PaymentData }[]) => void;
  onCancel: () => void;
}

export interface PaymentData {
  amountPaid: number;
  exchangeRate: number;
  amountMXN: number;
  bankName: string;
  operationRef: string;
  paymentMode: string;
  invoiceNumber?: string;
  invoiceLink?: string;
  expenseType?: string;
  operationType?: string;
  ocStatus?: string;
  client?: string;
  serviceDelivery?: string;
  proposal?: string;
  paymentProof?: string;
}

const BANK_OPTIONS = [
  "BBVA",
  "Banorte",
  "HSBC",
  "Santander",
  "Scotiabank",
  "Citibanamex",
  "Otro",
];
const PAYMENT_MODES = [
  "Transferencia",
];
const EXPENSE_TYPES = ["O&M", "Avance de Obra", "SG&A"];
const OPERATION_TYPES = [
  "Pago a proveedor",
  "Reembolso",
  "Anticipo",
  "Pago de nómina",
  "Otro",
];
const SERVICE_DELIVERY_OPTIONS = [
  "Mano de obra",
  "Material eléctrico",
  "Otros gastos de la operación",
  "Gastos de departamento",
];
const PROPOSAL_OPTIONS = [
  "Autorizado",
  "Aplazado",
];

const PaymentModal: React.FC<Props> = ({
  request,
  requests,
  lastExchangeRate,
  nsPaidBills,
  nsPaidBillsMap,
  nsPoStatus,
  nsProjectClient,
  nsInvoiceLink,
  nsClientMap,
  nsInvoiceLinkMap,
  onConfirm,
  onConfirmBulk,
  onCancel,
}) => {
  const lastRate = lastExchangeRate;
  const isBulk = Array.isArray(requests) && requests.length > 0;
  const requestList = isBulk ? requests! : request ? [request] : [];
  const hasNsBills = !isBulk && Array.isArray(nsPaidBills) && nsPaidBills.length > 0;

  // Bill selector for when NS returns multiple paid bills
  const [selectedBillIdx, setSelectedBillIdx] = useState(0);
  const activeBill = hasNsBills ? nsPaidBills![selectedBillIdx] : null;

  // Shared state
  const [bankName, setBankName] = useState("");
  const [paymentMode, setPaymentMode] = useState("Transferencia");
  const [expenseType, setExpenseType] = useState("");
  const [operationType, setOperationType] = useState("");
  const [ocStatus, setOcStatus] = useState(nsPoStatus ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Single-only state
  const [amountPaid, setAmountPaid] = useState<string>(
    !isBulk && request ? request.amount.toString() : "0"
  );
  const [exchangeRate, setExchangeRate] = useState<string>(
    lastRate.rate.toString()
  );
  const [singleOperationRef, setSingleOperationRef] = useState("");
  const [singleInvoiceNumber, setSingleInvoiceNumber] = useState("");
  const [invoiceLink, setInvoiceLink] = useState(nsInvoiceLink ?? "");
  const [client, setClient] = useState(nsProjectClient ?? "");
  const [serviceDelivery, setServiceDelivery] = useState("");
  const [proposal, setProposal] = useState("");
  const [paymentProof, setPaymentProof] = useState("");

  // Pre-fill from NS bill when available
  useEffect(() => {
    if (activeBill) {
      setAmountPaid(activeBill.payment_amount?.toString() ?? activeBill.bill_total.toString());
      setExchangeRate(activeBill.exchange_rate.toString());
      setSingleInvoiceNumber(activeBill.bill_number);
    }
  }, [activeBill]);

  // Bulk-only state
  const [applyRefToAll, setApplyRefToAll] = useState(true);
  const [commonRef, setCommonRef] = useState("");
  const [individualRefs, setIndividualRefs] = useState<Record<string, string>>({});
  const [individualInvoices, setIndividualInvoices] = useState<Record<string, string>>({});
  const [individualInvoiceLinks, setIndividualInvoiceLinks] = useState<Record<string, string>>({});
  const [individualClients, setIndividualClients] = useState<Record<string, string>>({});
  const [individualServiceDeliveries, setIndividualServiceDeliveries] = useState<Record<string, string>>({});
  const [individualProposals, setIndividualProposals] = useState<Record<string, string>>({});
  const [individualPaymentProofs, setIndividualPaymentProofs] = useState<Record<string, string>>({});

  // Pre-fill from NS bills map for bulk mode
  useEffect(() => {
    if (isBulk && nsPaidBillsMap) {
      const prefilledInvoices: Record<string, string> = {};
      requests!.forEach((r) => {
        const bills = nsPaidBillsMap[r.id];
        if (bills && bills.length > 0) {
          const firstBill = bills[0];
          if (firstBill.bill_number) {
            prefilledInvoices[r.id] = firstBill.bill_number;
          }
        }
      });
      setIndividualInvoices((prev) => ({ ...prev, ...prefilledInvoices }));
    }
  }, [isBulk, nsPaidBillsMap, requests]);

  useEffect(() => {
    if (isBulk && nsClientMap) {
      setIndividualClients((prev) => ({ ...prev, ...nsClientMap }));
    }
  }, [isBulk, nsClientMap]);

  useEffect(() => {
    if (isBulk && nsInvoiceLinkMap) {
      setIndividualInvoiceLinks((prev) => ({ ...prev, ...nsInvoiceLinkMap }));
    }
  }, [isBulk, nsInvoiceLinkMap]);



  // Handle common reference changes for bulk
  const handleCommonRefChange = (val: string) => {
    setCommonRef(val);
    if (applyRefToAll) {
      const updated: Record<string, string> = {};
      requestList.forEach((r) => {
        updated[r.id] = val;
      });
      setIndividualRefs(updated);
    }
  };

  // When toggle is checked, synchronize all references with commonRef
  useEffect(() => {
    if (isBulk && applyRefToAll) {
      const updated: Record<string, string> = {};
      requestList.forEach((r) => {
        updated[r.id] = commonRef;
      });
      setIndividualRefs(updated);
    }
  }, [applyRefToAll, commonRef, isBulk]);

  const handleIndividualFieldChange = (
    field: "ref" | "invoice" | "link" | "client" | "delivery" | "proposal" | "proof",
    id: string,
    val: string
  ) => {
    if (field === "ref") {
      setApplyRefToAll(false);
      setIndividualRefs((prev) => ({ ...prev, [id]: val }));
    } else if (field === "invoice") {
      setIndividualInvoices((prev) => ({ ...prev, [id]: val }));
    } else if (field === "link") {
      setIndividualInvoiceLinks((prev) => ({ ...prev, [id]: val }));
    } else if (field === "client") {
      setIndividualClients((prev) => ({ ...prev, [id]: val }));
    } else if (field === "delivery") {
      setIndividualServiceDeliveries((prev) => ({ ...prev, [id]: val }));
    } else if (field === "proposal") {
      setIndividualProposals((prev) => ({ ...prev, [id]: val }));
    } else if (field === "proof") {
      setIndividualPaymentProofs((prev) => ({ ...prev, [id]: val }));
    }
  };

  // Calculations for single mode
  const amountPaidNum = parseFloat(amountPaid) || 0;
  const exchangeRateNum = parseFloat(exchangeRate) || 0;
  const amountMXN =
    !isBulk && request && request.currency === "USD"
      ? amountPaidNum * exchangeRateNum
      : amountPaidNum;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!bankName) e.bankName = "Selecciona un banco";
    if (!paymentMode) e.paymentMode = "Selecciona modo de pago";

    if (!isBulk) {
      if (!amountPaid || amountPaidNum <= 0) e.amountPaid = "Monto requerido";
      if (!singleOperationRef.trim()) e.singleOperationRef = "Referencia requerida";
      if (request?.currency === "USD" && exchangeRateNum <= 0)
        e.exchangeRate = "T/C inválido";
    } else {
      const missingRefs: string[] = [];
      requests!.forEach((r) => {
        const ref = (individualRefs[r.id] || "").trim();
        if (!ref) {
          missingRefs.push(r.id);
        }
      });
      if (missingRefs.length > 0) {
        e.bulkReferences = `Referencia requerida para todas las solicitudes (Falta en: ${missingRefs.join(", ")})`;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirmClick = () => {
    if (!validate()) return;

    if (!isBulk) {
      onConfirm(request!.id, {
        amountPaid: amountPaidNum,
        exchangeRate: exchangeRateNum,
        amountMXN,
        bankName,
        operationRef: singleOperationRef.trim(),
        paymentMode,
        invoiceNumber: singleInvoiceNumber.trim() || undefined,
        invoiceLink: invoiceLink.trim() || undefined,
        expenseType: expenseType || undefined,
        operationType: operationType || undefined,
        ocStatus: ocStatus.trim() || undefined,
        client: client.trim() || undefined,
        serviceDelivery: serviceDelivery.trim() || undefined,
        proposal: proposal.trim() || undefined,
        paymentProof: paymentProof.trim() || undefined,
      });
    } else if (onConfirmBulk) {
      const data = requests!.map((r) => {
        const amtPaid = r.amount;
        const exRate = lastRate.rate;
        const amtMXN = r.currency === "USD" ? amtPaid * exRate : amtPaid;
        const ref = (individualRefs[r.id] || "").trim();
        const invNum = (individualInvoices[r.id] || "").trim() || undefined;
        const invLink = (individualInvoiceLinks[r.id] || "").trim() || undefined;
        const cl = (individualClients[r.id] || "").trim() || undefined;
        const del = (individualServiceDeliveries[r.id] || "").trim() || undefined;
        const prop = (individualProposals[r.id] || "").trim() || undefined;
        const proof = (individualPaymentProofs[r.id] || "").trim() || undefined;

        const paymentData: PaymentData = {
          amountPaid: amtPaid,
          exchangeRate: exRate,
          amountMXN: amtMXN,
          bankName,
          operationRef: ref,
          paymentMode,
          invoiceNumber: invNum,
          invoiceLink: invLink,
          expenseType: expenseType || undefined,
          operationType: operationType || undefined,
          ocStatus: ocStatus.trim() || undefined,
          client: cl,
          serviceDelivery: del,
          proposal: prop,
          paymentProof: proof,
        };
        return { id: r.id, paymentData };
      });
      onConfirmBulk(data);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-[#00aa85] transition-colors";
  const inputStyle = {
    backgroundColor: "#293C47",
    fontFamily: "Alexandria, sans-serif",
  };
  const labelClass = "text-gray-400 text-xs font-medium mb-1 block";

  const totalUSD = isBulk ? requests!.filter(r => r.currency === "USD").reduce((sum, r) => sum + r.amount, 0) : 0;
  const totalMXN = isBulk ? requests!.filter(r => r.currency === "MXN").reduce((sum, r) => sum + r.amount, 0) : 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className={`rounded-xl border border-gray-600 shadow-2xl w-full mx-4 max-h-[90vh] flex flex-col transition-all duration-300 ${isBulk ? "max-w-6xl" : "max-w-2xl"
          }`}
        style={{ backgroundColor: "#1e2d3d" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-700 flex-shrink-0"
          style={{ backgroundColor: "#293C47", borderRadius: "12px 12px 0 0" }}
        >
          <h3
            className="text-white text-lg font-bold"
            style={{ fontFamily: "Alexandria, sans-serif" }}
          >
            {isBulk ? "Registrar Pagos en Lote" : `Registrar Pago — ${request?.id}`}
          </h3>
          <p className="text-gray-400 text-xs mt-1">
            {isBulk ? (
              <span>
                Seleccionadas: <strong className="text-white">{requests!.length} solicitudes</strong>
                {totalUSD > 0 && ` · Total USD: ${totalUSD.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                {totalMXN > 0 && ` · Total MXN: ${totalMXN.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
              </span>
            ) : (
              `${request?.beneficiary} · ${request?.amount.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
              })} ${request?.currency}`
            )}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* === Required fields === */}
          <div>
            <p
              className="text-[#00aa85] text-xs font-semibold mb-3 uppercase tracking-wide"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Datos obligatorios comunes
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Banco */}
              <div>
                <label className={labelClass}>Banco*</label>
                <select
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    setErrors((p) => ({ ...p, bankName: "" }));
                  }}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {errors.bankName && (
                  <p className="text-red-400 text-xs mt-1">{errors.bankName}</p>
                )}
              </div>

              {/* Modo de Pago */}
              <div>
                <label className={labelClass}>Modo de Pago*</label>
                <select
                  value={paymentMode}
                  onChange={(e) => {
                    setPaymentMode(e.target.value);
                    setErrors((p) => ({ ...p, paymentMode: "" }));
                  }}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {errors.paymentMode && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.paymentMode}
                  </p>
                )}
              </div>

              {/* Single Mode: Monto Pagado & T/C & Ref */}
              {!isBulk && (
                <>
                  {/* NS Bill Selector — only when multiple paid bills */}
                  {hasNsBills && nsPaidBills!.length > 1 && (
                    <div className="md:col-span-2">
                      <label className={labelClass}>Factura de NS a referenciar*</label>
                      <select
                        value={selectedBillIdx}
                        onChange={(e) => setSelectedBillIdx(Number(e.target.value))}
                        className={inputClass}
                        style={inputStyle}
                      >
                        {nsPaidBills!.map((b, i) => (
                          <option key={b.bill_id} value={i}>
                            {b.bill_number} — ${b.payment_amount?.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {b.currency} — {b.payment_date}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* NS source badge */}
                  {hasNsBills && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#00aa85]/30 bg-[#00aa85]/10 text-xs text-[#00aa85]">
                        <span>✓</span>
                        <span>Datos pre-llenados desde NetSuite (factura {activeBill!.bill_number}, pagada {activeBill!.payment_date}). Campos de NS son de solo lectura.</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>
                      Monto Pagado ({activeBill?.currency ?? request?.currency})*
                    </label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => {
                        if (!hasNsBills) {
                          setAmountPaid(e.target.value);
                          setErrors((p) => ({ ...p, amountPaid: "" }));
                        }
                      }}
                      readOnly={hasNsBills}
                      className={`${inputClass} ${hasNsBills ? "opacity-70 cursor-not-allowed" : ""}`}
                      style={inputStyle}
                      step="0.01"
                    />
                    {errors.amountPaid && (
                      <p className="text-red-400 text-xs mt-1">
                        {errors.amountPaid}
                      </p>
                    )}
                  </div>

                  {(request?.currency === "USD" || activeBill?.currency === "USD") && (
                    <>
                      <div>
                        <label className={labelClass}>
                          Tipo de Cambio*{" "}
                          <span className="text-gray-500">
                            {hasNsBills ? "(NetSuite)" : `(Banxico ${lastRate.date})`}
                          </span>
                        </label>
                        <input
                          type="number"
                          value={exchangeRate}
                          onChange={(e) => {
                            if (!hasNsBills) {
                              setExchangeRate(e.target.value);
                              setErrors((p) => ({ ...p, exchangeRate: "" }));
                            }
                          }}
                          readOnly={hasNsBills}
                          className={`${inputClass} ${hasNsBills ? "opacity-70 cursor-not-allowed" : ""}`}
                          style={inputStyle}
                          step="0.0001"
                        />
                        {errors.exchangeRate && (
                          <p className="text-red-400 text-xs mt-1">
                            {errors.exchangeRate}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass}>Monto en MXN (calculado)</label>
                        <div
                          className="px-3 py-2 rounded-lg text-[#00aa85] text-sm font-semibold border border-gray-700"
                          style={{
                            backgroundColor: "#243545",
                            fontFamily: "Alexandria, sans-serif",
                          }}
                        >
                          $
                          {amountMXN.toLocaleString("es-MX", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          MXN
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className={labelClass}>Referencia de Operación*</label>
                    <input
                      type="text"
                      value={singleOperationRef}
                      onChange={(e) => {
                        setSingleOperationRef(e.target.value);
                        setErrors((p) => ({ ...p, singleOperationRef: "" }));
                      }}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Ej: TRF-20231027-001"
                    />
                    {errors.singleOperationRef && (
                      <p className="text-red-400 text-xs mt-1">
                        {errors.singleOperationRef}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Bulk Mode: Common Reference Input with Apply-To-All check */}
              {isBulk && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-xs font-medium">
                      Referencia de Operación Común
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[#00aa85] text-xs font-semibold select-none">
                      <input
                        type="checkbox"
                        checked={applyRefToAll}
                        onChange={(e) => setApplyRefToAll(e.target.checked)}
                        className="rounded border-gray-600 text-[#00aa85] focus:ring-0 focus:ring-offset-0 bg-[#293C47]"
                      />
                      Aplicar la misma referencia a todas
                    </label>
                  </div>
                  <input
                    type="text"
                    value={commonRef}
                    onChange={(e) => handleCommonRefChange(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="Ej: TRF-MismoLote-2026"
                  />
                  {errors.bulkReferences && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.bulkReferences}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bulk Mode: Inline Requests Details Table */}
          {isBulk && (
            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <div
                className="px-4 py-2 border-b border-gray-700 text-xs font-bold text-gray-300 uppercase tracking-wide"
                style={{ backgroundColor: "#243545" }}
              >
                Información y Campos Únicos por Solicitud
              </div>
              <div className="max-h-80 overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs text-left min-w-[1500px]">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400" style={{ backgroundColor: "#1e2d3d" }}>
                      <th className="px-3 py-2 w-[70px]">ID</th>
                      <th className="px-3 py-2 w-[150px]">Beneficiario</th>
                      <th className="px-3 py-2 w-[120px]">Monto</th>
                      <th className="px-3 py-2 w-[220px]">Ref. Operación*</th>
                      <th className="px-3 py-2 w-[180px]">N° Factura</th>
                      <th className="px-3 py-2 w-[200px]">Link Factura</th>
                      <th className="px-3 py-2 w-[160px]">Cliente</th>
                      <th className="px-3 py-2 w-[220px]">Prestación Bien/Servicio</th>
                      <th className="px-3 py-2 w-[160px]">Propuesta</th>
                      <th className="px-3 py-2 w-[220px]">Comprobante Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests!.map((r) => (
                      <tr key={r.id} className="border-b border-gray-700/50 hover:bg-[#243545]/30">
                        <td className="px-3 py-2 font-semibold text-[#00aa85]">{r.id}</td>
                        <td className="px-3 py-2 text-gray-300 max-w-[150px] truncate" title={r.beneficiary}>
                          {r.beneficiary}
                        </td>
                        <td className="px-3 py-2 text-gray-300 font-medium">
                          {r.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {r.currency}
                          {r.currency === "USD" && (
                            <span className="block text-[10px] text-gray-500 font-normal">
                              MXN: ${(r.amount * lastRate.rate).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualRefs[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("ref", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            placeholder="Requerido"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualInvoices[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("invoice", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            placeholder="Ej: FAC-123"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualInvoiceLinks[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("link", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            placeholder="Ej: https://..."
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualClients[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("client", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={individualServiceDeliveries[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("delivery", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                          >
                            <option value="">Seleccionar...</option>
                            {SERVICE_DELIVERY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={individualProposals[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("proposal", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                          >
                            <option value="">Seleccionar...</option>
                            {PROPOSAL_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualPaymentProofs[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("proof", r.id, e.target.value)}
                            className="w-full px-2 py-1 rounded text-white text-xs outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            placeholder="URL o ref"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === Optional fields === */}
          <div>
            <p
              className="text-gray-500 text-xs font-semibold mb-3 uppercase tracking-wide"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Datos complementarios comunes (opcionales)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Single Mode Only Fields */}
              {!isBulk && (
                <>
                  <div>
                    <label className={labelClass}>
                      N° de Factura
                      {hasNsBills && <span className="text-[#00aa85] ml-1">(NS)</span>}
                    </label>
                    <input
                      type="text"
                      value={singleInvoiceNumber}
                      onChange={(e) => { if (!hasNsBills) setSingleInvoiceNumber(e.target.value); }}
                      readOnly={hasNsBills}
                      className={`${inputClass} ${hasNsBills ? "opacity-70 cursor-not-allowed" : ""}`}
                      style={inputStyle}
                      placeholder="Ej: FAC-2023-1234"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Link Factura</label>
                    <input
                      type="text"
                      value={invoiceLink}
                      onChange={(e) => setInvoiceLink(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="URL del documento"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Cliente</label>
                    <input
                      type="text"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Prestación del Bien o Servicio
                    </label>
                    <select
                      value={serviceDelivery}
                      onChange={(e) => setServiceDelivery(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar...</option>
                      {SERVICE_DELIVERY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Propuesta</label>
                    <select
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar...</option>
                      {PROPOSAL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Shared Fields in both Single and Bulk modes */}
              <div>
                <label className={labelClass}>Tipo de Operación</label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {OPERATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Tipo de Gasto</label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Estatus OC</label>
                <input
                  type="text"
                  value={ocStatus}
                  onChange={(e) => setOcStatus(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Ej: Entregada, Parcial"
                />
              </div>

              {/* Single Mode Only: Comprobante de pago */}
              {!isBulk && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Comprobante de Pago</label>
                  <input
                    type="text"
                    value={paymentProof}
                    onChange={(e) => setPaymentProof(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="URL o referencia del comprobante"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <p className="text-gray-500 text-xs">* Campos obligatorios</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-gray-300 text-sm font-medium border border-gray-600 hover:border-gray-400 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmClick}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-900/10"
            >
              {isBulk ? `Confirmar Pagos (${requests!.length})` : "Confirmar Pago"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;