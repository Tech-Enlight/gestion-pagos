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
  nsOcStatusMap?: Record<string, string>;
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
  invoiceNumber: string;
  invoiceLink: string;
  expenseType: string;
  operationType: string;
  ocStatus: string;
  client: string;
  serviceDelivery: string;
  proposal: string;
  paymentProof: string;
  nsPaymentId?: string;
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
  nsOcStatusMap,
  onConfirm,
  onConfirmBulk,
  onCancel,
}) => {
  const lastRate = lastExchangeRate;
  const isBulk = Array.isArray(requests) && requests.length > 0;
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
  // Bulk mode: which request IDs are missing each per-row required field —
  // drives the red-border highlight on individual table cells.
  const [bulkFieldErrors, setBulkFieldErrors] = useState<Record<string, string[]>>({});

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
  const [paymentProof, setPaymentProof] = useState("");

  // Propuesta is derived, not user-entered: a request that already went through
  // Programar Pago (has an estimatedPaymentDate) was "Aplazado"; otherwise it was
  // approved straight to payment ("Autorizado").
  const getProposal = (r: Request) => (r.estimatedPaymentDate ? "Aplazado" : "Autorizado");

  // Pre-fill from NS bill when available
  useEffect(() => {
    if (activeBill) {
      setAmountPaid(activeBill.payment_amount?.toString() ?? activeBill.bill_total.toString());
      setExchangeRate(activeBill.exchange_rate.toString());
      setSingleInvoiceNumber(activeBill.bill_number);
      if (activeBill.bank_account) {
        setBankName(activeBill.bank_account);
      }
      if (activeBill.payment_tranid) {
        setSingleOperationRef(activeBill.payment_tranid);
      }
    }
  }, [activeBill]);

  // Bulk-only state
  const [individualRefs, setIndividualRefs] = useState<Record<string, string>>({});
  const [individualInvoices, setIndividualInvoices] = useState<Record<string, string>>({});
  const [individualInvoiceLinks, setIndividualInvoiceLinks] = useState<Record<string, string>>({});
  const [individualClients, setIndividualClients] = useState<Record<string, string>>({});
  const [individualServiceDeliveries, setIndividualServiceDeliveries] = useState<Record<string, string>>({});
  const [individualPaymentProofs, setIndividualPaymentProofs] = useState<Record<string, string>>({});
  const [individualOcStatuses, setIndividualOcStatuses] = useState<Record<string, string>>({});
  const [individualBanks, setIndividualBanks] = useState<Record<string, string>>({});
  // Which NS bill/payment (index into nsPaidBillsMap[id]) is selected per row —
  // matters when a request has more than one candidate payment matching by amount.
  const [selectedBillIdxByRequest, setSelectedBillIdxByRequest] = useState<Record<string, number>>({});

  const getBillsForRequest = (id: string): NSBill[] => nsPaidBillsMap?.[id] ?? [];
  const getActiveBillForRequest = (r: Request): NSBill | null => {
    const bills = getBillsForRequest(r.id);
    return bills[selectedBillIdxByRequest[r.id] ?? 0] ?? null;
  };

  // Auto-assign each row's default bill/payment, preferring one not already
  // claimed by an earlier row in this same batch (bulk gating guarantees every
  // eligible row has at least one candidate). Also prefills invoice/ref/bank
  // per row from the picked bill's own data — bulk mode should record what
  // NetSuite actually shows for THAT payment, not the request's own amount or
  // a one-size-fits-all reference.
  useEffect(() => {
    if (!isBulk || !nsPaidBillsMap) return;
    const usedPaymentIds = new Set<string>();
    const idxMap: Record<string, number> = {};
    const refMap: Record<string, string> = {};
    const invMap: Record<string, string> = {};
    const bankMap: Record<string, string> = {};

    requests!.forEach((r) => {
      const bills = nsPaidBillsMap[r.id] || [];
      let idx = bills.findIndex((b) => !usedPaymentIds.has(b.payment_id));
      if (idx === -1) idx = 0;
      idxMap[r.id] = idx;
      const bill = bills[idx];
      if (bill) {
        usedPaymentIds.add(bill.payment_id);
        if (bill.payment_tranid) refMap[r.id] = bill.payment_tranid;
        if (bill.bill_number) invMap[r.id] = bill.bill_number;
        if (bill.bank_account) bankMap[r.id] = bill.bank_account;
      }
    });

    setSelectedBillIdxByRequest(idxMap);
    setIndividualRefs((prev) => ({ ...prev, ...refMap }));
    setIndividualInvoices((prev) => ({ ...prev, ...invMap }));
    setIndividualBanks((prev) => ({ ...prev, ...bankMap }));
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

  useEffect(() => {
    if (isBulk && nsOcStatusMap) {
      setIndividualOcStatuses((prev) => ({ ...prev, ...nsOcStatusMap }));
    }
  }, [isBulk, nsOcStatusMap]);

  // When the analista manually picks a different candidate bill for a row,
  // re-derive that row's invoice/ref/bank from the newly-selected bill.
  const handleBillSelectionChange = (id: string, idx: number) => {
    setSelectedBillIdxByRequest((prev) => ({ ...prev, [id]: idx }));
    const bill = getBillsForRequest(id)[idx];
    if (bill) {
      setIndividualRefs((prev) => ({ ...prev, [id]: bill.payment_tranid || "" }));
      setIndividualInvoices((prev) => ({ ...prev, [id]: bill.bill_number || "" }));
      setIndividualBanks((prev) => ({ ...prev, [id]: bill.bank_account || "" }));
    }
    setBulkFieldErrors((prev) => ({
      ...prev,
      invoice: (prev.invoice || []).filter((x) => x !== id),
      bank: (prev.bank || []).filter((x) => x !== id),
    }));
  };

  const handleIndividualFieldChange = (
    field: "ref" | "invoice" | "link" | "client" | "delivery" | "ocStatus" | "proof" | "bank",
    id: string,
    val: string
  ) => {
    if (field === "ref") {
      setIndividualRefs((prev) => ({ ...prev, [id]: val }));
    } else if (field === "invoice") {
      setIndividualInvoices((prev) => ({ ...prev, [id]: val }));
    } else if (field === "link") {
      setIndividualInvoiceLinks((prev) => ({ ...prev, [id]: val }));
    } else if (field === "client") {
      setIndividualClients((prev) => ({ ...prev, [id]: val }));
    } else if (field === "delivery") {
      setIndividualServiceDeliveries((prev) => ({ ...prev, [id]: val }));
    } else if (field === "ocStatus") {
      setIndividualOcStatuses((prev) => ({ ...prev, [id]: val }));
    } else if (field === "proof") {
      setIndividualPaymentProofs((prev) => ({ ...prev, [id]: val }));
    } else if (field === "bank") {
      setIndividualBanks((prev) => ({ ...prev, [id]: val }));
    }
    if (val.trim()) {
      setBulkFieldErrors((prev) => {
        if (!prev[field]?.includes(id)) return prev;
        return { ...prev, [field]: prev[field].filter((x) => x !== id) };
      });
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
    if (!paymentMode) e.paymentMode = "Selecciona modo de pago";
    if (!operationType) e.operationType = "Selecciona tipo de operación";
    if (!expenseType) e.expenseType = "Selecciona tipo de gasto";

    if (!isBulk) {
      if (!bankName) e.bankName = "Selecciona un banco";
      if (!amountPaid || amountPaidNum <= 0) e.amountPaid = "Monto requerido";
      if (!singleOperationRef.trim()) e.singleOperationRef = "Referencia requerida";
      if (request?.currency === "USD" && exchangeRateNum <= 0)
        e.exchangeRate = "T/C inválido";
      if (!singleInvoiceNumber.trim()) e.singleInvoiceNumber = "N° de factura requerido";
      if (!invoiceLink.trim()) e.invoiceLink = "Link de factura requerido";
      if (!client.trim()) e.client = "Cliente requerido";
      if (!serviceDelivery) e.serviceDelivery = "Selecciona prestación del bien o servicio";
      if (!ocStatus.trim()) e.ocStatus = "Estatus OC requerido";
      if (!paymentProof.trim()) e.paymentProof = "Comprobante de pago requerido";
    } else {
      const fieldDefs: { key: "ref" | "invoice" | "link" | "client" | "delivery" | "ocStatus" | "proof" | "bank"; map: Record<string, string> }[] = [
        { key: "ref", map: individualRefs },
        { key: "invoice", map: individualInvoices },
        { key: "link", map: individualInvoiceLinks },
        { key: "client", map: individualClients },
        { key: "delivery", map: individualServiceDeliveries },
        { key: "ocStatus", map: individualOcStatuses },
        { key: "proof", map: individualPaymentProofs },
        { key: "bank", map: individualBanks },
      ];
      const missingByField: Record<string, string[]> = {};
      const missingIds = new Set<string>();
      fieldDefs.forEach(({ key, map }) => {
        const missing = requests!.filter((r) => !(map[r.id] || "").trim()).map((r) => r.id);
        if (missing.length > 0) {
          missingByField[key] = missing;
          missing.forEach((id) => missingIds.add(id));
        }
      });
      setBulkFieldErrors(missingByField);
      if (missingIds.size > 0) {
        e.bulkReferences = `Completa todos los campos obligatorios de la tabla (Falta en: ${Array.from(missingIds).join(", ")})`;
      }

      // Two rows must never settle off the same NetSuite payment.
      const requestIdsByPaymentId: Record<string, string[]> = {};
      requests!.forEach((r) => {
        const bill = getActiveBillForRequest(r);
        if (bill?.payment_id) {
          (requestIdsByPaymentId[bill.payment_id] ??= []).push(r.id);
        }
      });
      const duplicateIds = Object.values(requestIdsByPaymentId)
        .filter((ids) => ids.length > 1)
        .flat();
      if (duplicateIds.length > 0) {
        e.bulkDuplicatePayment = `Dos o más solicitudes tienen seleccionado el mismo pago de NetSuite (IDs: ${duplicateIds.join(", ")}). Elige una factura/pago distinto para cada una.`;
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
        invoiceNumber: singleInvoiceNumber.trim(),
        invoiceLink: invoiceLink.trim(),
        expenseType,
        operationType,
        ocStatus: ocStatus.trim(),
        client: client.trim(),
        serviceDelivery,
        proposal: getProposal(request!),
        paymentProof: paymentProof.trim(),
        nsPaymentId: activeBill?.payment_id,
      });
    } else if (onConfirmBulk) {
      const data = requests!.map((r) => {
        const bill = getActiveBillForRequest(r);
        // Record what NetSuite actually shows for THIS payment, not the
        // request's own stated amount / today's generic FX rate.
        const amtPaid = bill?.payment_amount ?? bill?.bill_total ?? r.amount;
        const exRate = bill?.exchange_rate ?? lastRate.rate;
        const amtMXN = r.currency === "USD" ? amtPaid * exRate : amtPaid;
        const ref = (individualRefs[r.id] || "").trim();
        const invNum = (individualInvoices[r.id] || "").trim();
        const invLink = (individualInvoiceLinks[r.id] || "").trim();
        const cl = (individualClients[r.id] || "").trim();
        const del = (individualServiceDeliveries[r.id] || "").trim();
        const ocSt = (individualOcStatuses[r.id] || "").trim();
        const proof = (individualPaymentProofs[r.id] || "").trim();
        const bankForRow = (individualBanks[r.id] || "").trim();

        const paymentData: PaymentData = {
          amountPaid: amtPaid,
          exchangeRate: exRate,
          amountMXN: amtMXN,
          bankName: bankForRow,
          operationRef: ref,
          paymentMode,
          invoiceNumber: invNum,
          invoiceLink: invLink,
          expenseType,
          operationType,
          ocStatus: ocSt,
          client: cl,
          serviceDelivery: del,
          proposal: getProposal(r),
          paymentProof: proof,
          nsPaymentId: bill?.payment_id,
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
  const bulkCellClass = (field: string, id: string) =>
    `w-full px-2 py-1 rounded text-white text-xs outline-none border transition-colors ${bulkFieldErrors[field]?.includes(id) ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"
    }`;
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
              {/* Banco — single mode only; bulk sources bank per row from NetSuite (see below) */}
              {!isBulk && (
                <div>
                  <label className={labelClass}>
                    Banco*
                    {activeBill?.bank_account && <span className="text-[#00aa85] ml-1">(NS)</span>}
                  </label>
                  {activeBill?.bank_account ? (
                    <input
                      type="text"
                      value={bankName}
                      readOnly
                      className={`${inputClass} opacity-70 cursor-not-allowed`}
                      style={inputStyle}
                    />
                  ) : (
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
                  )}
                  {errors.bankName && (
                    <p className="text-red-400 text-xs mt-1">{errors.bankName}</p>
                  )}
                </div>
              )}

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
                    <label className={labelClass}>
                      Referencia de Operación*{" "}
                      {activeBill?.payment_tranid && (
                        <span className="text-gray-500">(NetSuite)</span>
                      )}
                    </label>
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

            </div>
          </div>

          {/* Bulk Mode: per-request NetSuite payment confirmation — the
              money-critical fields (which bill/payment, amount, FX, bank,
              reference) live here, one card per request, instead of buried in
              the details table, so an ambiguous or duplicate match is visible
              before confirming. */}
          {isBulk && (() => {
            const paymentIdCounts: Record<string, number> = {};
            requests!.forEach((r) => {
              const b = getActiveBillForRequest(r);
              if (b?.payment_id) paymentIdCounts[b.payment_id] = (paymentIdCounts[b.payment_id] || 0) + 1;
            });
            return (
              <div className="space-y-2">
                <p
                  className="text-[#00aa85] text-xs font-semibold uppercase tracking-wide"
                  style={{ fontFamily: "Alexandria, sans-serif" }}
                >
                  Confirmación de Pago por Solicitud (NetSuite)
                </p>
                {(errors.bulkReferences || errors.bulkDuplicatePayment) && (
                  <div className="space-y-1">
                    {errors.bulkDuplicatePayment && (
                      <p className="text-red-400 text-xs">{errors.bulkDuplicatePayment}</p>
                    )}
                    {errors.bulkReferences && (
                      <p className="text-red-400 text-xs">{errors.bulkReferences}</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {requests!.map((r) => {
                    const bills = getBillsForRequest(r.id);
                    const selectedIdx = selectedBillIdxByRequest[r.id] ?? 0;
                    const bill = bills[selectedIdx] ?? null;
                    const isDuplicate = !!bill && (paymentIdCounts[bill.payment_id] || 0) > 1;
                    const amtPaid = bill?.payment_amount ?? bill?.bill_total ?? r.amount;
                    const exRate = bill?.exchange_rate ?? lastRate.rate;

                    return (
                      <div
                        key={r.id}
                        className={`rounded-lg border p-3 space-y-2 ${isDuplicate ? "border-red-500" : "border-gray-700"}`}
                        style={{ backgroundColor: "#1e2d3d" }}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-[#00aa85]">{r.id}</span>
                            <span className="text-gray-400">{r.beneficiary}</span>
                          </div>
                          {isDuplicate && (
                            <span className="text-red-400 text-[10px] font-bold uppercase tracking-wide">
                              Pago duplicado en el lote
                            </span>
                          )}
                        </div>

                        {bills.length > 1 ? (
                          <div>
                            <label className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 block font-semibold">
                              Pago de NetSuite a aplicar*
                            </label>
                            <select
                              value={selectedIdx}
                              onChange={(e) => handleBillSelectionChange(r.id, Number(e.target.value))}
                              className={`w-full px-2 py-1.5 rounded text-white text-xs outline-none border transition-colors ${isDuplicate ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"
                                }`}
                              style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            >
                              {bills.map((b, i) => (
                                <option key={`${b.payment_id}-${i}`} value={i}>
                                  {b.bill_number} — ${b.payment_amount?.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {b.currency} — {b.payment_date}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-[10px]">
                            Factura NS: <span className="text-gray-300">{bill?.bill_number}</span> · Pagada {bill?.payment_date}
                          </p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          <div>
                            <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 block">
                              Monto Pagado (NS)
                            </label>
                            <div
                              className="px-2 py-1.5 rounded text-[#00aa85] text-xs font-semibold border border-gray-700"
                              style={{ backgroundColor: "#243545" }}
                            >
                              ${amtPaid.toLocaleString("es-MX", { minimumFractionDigits: 2 })} {bill?.currency ?? r.currency}
                            </div>
                          </div>
                          <div>
                            <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 block">
                              Tipo de Cambio
                            </label>
                            <div
                              className="px-2 py-1.5 rounded text-gray-300 text-xs border border-gray-700"
                              style={{ backgroundColor: "#243545" }}
                            >
                              {exRate.toFixed(4)}
                            </div>
                          </div>
                          <div>
                            <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 block">
                              N° Factura (NS)
                            </label>
                            <div
                              className="px-2 py-1.5 rounded text-white text-xs border border-gray-700 opacity-70"
                              style={{ backgroundColor: "#243545" }}
                            >
                              {bill?.bill_number || "—"}
                            </div>
                          </div>
                          <div>
                            <label className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 block font-semibold">
                              Banco*
                              {bill?.bank_account && <span className="text-[#00aa85] ml-1">(NS)</span>}
                            </label>
                            {bill?.bank_account ? (
                              <div
                                className="px-2 py-1.5 rounded text-white text-xs border border-gray-700 opacity-70"
                                style={{ backgroundColor: "#243545" }}
                              >
                                {individualBanks[r.id]}
                              </div>
                            ) : (
                              <select
                                value={individualBanks[r.id] || ""}
                                onChange={(e) => handleIndividualFieldChange("bank", r.id, e.target.value)}
                                className={bulkCellClass("bank", r.id)}
                                style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                              >
                                <option value="">Seleccionar...</option>
                                {BANK_OPTIONS.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div>
                            <label className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 block font-semibold">
                              Ref. Operación*
                              {bill?.payment_tranid && <span className="text-[#00aa85] ml-1">(NS)</span>}
                            </label>
                            <input
                              type="text"
                              value={individualRefs[r.id] || ""}
                              onChange={(e) => handleIndividualFieldChange("ref", r.id, e.target.value)}
                              className={bulkCellClass("ref", r.id)}
                              style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                              placeholder="Ej: TRF-20231027-001"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Bulk Mode: Inline Requests Details Table */}
          {isBulk && (
            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <div
                className="px-4 py-2 border-b border-gray-700 text-xs font-bold text-gray-300 uppercase tracking-wide"
                style={{ backgroundColor: "#243545" }}
              >
                Información Administrativa por Solicitud
              </div>
              <div className="max-h-80 overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs text-left min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400" style={{ backgroundColor: "#1e2d3d" }}>
                      <th className="px-3 py-2 w-[70px]">ID</th>
                      <th className="px-3 py-2 w-[150px]">Beneficiario</th>
                      <th className="px-3 py-2 w-[120px]">Monto</th>
                      <th className="px-3 py-2 w-[200px]">Link Factura*</th>
                      <th className="px-3 py-2 w-[160px]">Cliente*</th>
                      <th className="px-3 py-2 w-[220px]">Prestación Bien/Servicio*</th>
                      <th className="px-3 py-2 w-[130px]">Propuesta</th>
                      <th className="px-3 py-2 w-[180px]">Estatus OC*</th>
                      <th className="px-3 py-2 w-[220px]">Comprobante Pago*</th>
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
                            value={individualInvoiceLinks[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("link", r.id, e.target.value)}
                            className={bulkCellClass("link", r.id)}
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            placeholder="Ej: https://..."
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualClients[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("client", r.id, e.target.value)}
                            className={bulkCellClass("client", r.id)}
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={individualServiceDeliveries[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("delivery", r.id, e.target.value)}
                            className={bulkCellClass("delivery", r.id)}
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
                        <td className="px-3 py-2 text-gray-300">{getProposal(r)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualOcStatuses[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("ocStatus", r.id, e.target.value)}
                            className={bulkCellClass("ocStatus", r.id)}
                            style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                            placeholder="Ej: Entregada, Parcial"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={individualPaymentProofs[r.id] || ""}
                            onChange={(e) => handleIndividualFieldChange("proof", r.id, e.target.value)}
                            className={bulkCellClass("proof", r.id)}
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

          {/* === Additional fields (all mandatory) === */}
          <div>
            <p
              className="text-gray-500 text-xs font-semibold mb-3 uppercase tracking-wide"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Datos complementarios
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Single Mode Only Fields */}
              {!isBulk && (
                <>
                  <div>
                    <label className={labelClass}>
                      N° de Factura*
                      {hasNsBills && <span className="text-[#00aa85] ml-1">(NS)</span>}
                    </label>
                    <input
                      type="text"
                      value={singleInvoiceNumber}
                      onChange={(e) => {
                        if (!hasNsBills) {
                          setSingleInvoiceNumber(e.target.value);
                          setErrors((p) => ({ ...p, singleInvoiceNumber: "" }));
                        }
                      }}
                      readOnly={hasNsBills}
                      className={`${inputClass} ${hasNsBills ? "opacity-70 cursor-not-allowed" : ""} ${errors.singleInvoiceNumber ? "border-red-500" : ""}`}
                      style={inputStyle}
                      placeholder="Ej: FAC-2023-1234"
                    />
                    {errors.singleInvoiceNumber && (
                      <p className="text-red-400 text-xs mt-1">{errors.singleInvoiceNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Link Factura*</label>
                    <input
                      type="text"
                      value={invoiceLink}
                      onChange={(e) => {
                        setInvoiceLink(e.target.value);
                        setErrors((p) => ({ ...p, invoiceLink: "" }));
                      }}
                      className={`${inputClass} ${errors.invoiceLink ? "border-red-500" : ""}`}
                      style={inputStyle}
                      placeholder="URL del documento"
                    />
                    {errors.invoiceLink && (
                      <p className="text-red-400 text-xs mt-1">{errors.invoiceLink}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Cliente*</label>
                    <input
                      type="text"
                      value={client}
                      onChange={(e) => {
                        setClient(e.target.value);
                        setErrors((p) => ({ ...p, client: "" }));
                      }}
                      className={`${inputClass} ${errors.client ? "border-red-500" : ""}`}
                      style={inputStyle}
                    />
                    {errors.client && (
                      <p className="text-red-400 text-xs mt-1">{errors.client}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      Prestación del Bien o Servicio*
                    </label>
                    <select
                      value={serviceDelivery}
                      onChange={(e) => {
                        setServiceDelivery(e.target.value);
                        setErrors((p) => ({ ...p, serviceDelivery: "" }));
                      }}
                      className={`${inputClass} ${errors.serviceDelivery ? "border-red-500" : ""}`}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar...</option>
                      {SERVICE_DELIVERY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {errors.serviceDelivery && (
                      <p className="text-red-400 text-xs mt-1">{errors.serviceDelivery}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Propuesta</label>
                    <div
                      className="px-3 py-2 rounded-lg text-white text-sm border border-gray-700"
                      style={{ backgroundColor: "#243545", fontFamily: "Alexandria, sans-serif" }}
                    >
                      {getProposal(request!)}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Estatus OC*</label>
                    <input
                      type="text"
                      value={ocStatus}
                      onChange={(e) => {
                        setOcStatus(e.target.value);
                        setErrors((p) => ({ ...p, ocStatus: "" }));
                      }}
                      className={`${inputClass} ${errors.ocStatus ? "border-red-500" : ""}`}
                      style={inputStyle}
                      placeholder="Ej: Entregada, Parcial"
                    />
                    {errors.ocStatus && (
                      <p className="text-red-400 text-xs mt-1">{errors.ocStatus}</p>
                    )}
                  </div>
                </>
              )}

              {/* Shared Fields in both Single and Bulk modes */}
              <div>
                <label className={labelClass}>Tipo de Operación*</label>
                <select
                  value={operationType}
                  onChange={(e) => {
                    setOperationType(e.target.value);
                    setErrors((p) => ({ ...p, operationType: "" }));
                  }}
                  className={`${inputClass} ${errors.operationType ? "border-red-500" : ""}`}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {OPERATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.operationType && (
                  <p className="text-red-400 text-xs mt-1">{errors.operationType}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>Tipo de Gasto*</label>
                <select
                  value={expenseType}
                  onChange={(e) => {
                    setExpenseType(e.target.value);
                    setErrors((p) => ({ ...p, expenseType: "" }));
                  }}
                  className={`${inputClass} ${errors.expenseType ? "border-red-500" : ""}`}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.expenseType && (
                  <p className="text-red-400 text-xs mt-1">{errors.expenseType}</p>
                )}
              </div>

              {/* Single Mode Only: Comprobante de pago */}
              {!isBulk && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Comprobante de Pago*</label>
                  <input
                    type="text"
                    value={paymentProof}
                    onChange={(e) => {
                      setPaymentProof(e.target.value);
                      setErrors((p) => ({ ...p, paymentProof: "" }));
                    }}
                    className={`${inputClass} ${errors.paymentProof ? "border-red-500" : ""}`}
                    style={inputStyle}
                    placeholder="URL o referencia del comprobante"
                  />
                  {errors.paymentProof && (
                    <p className="text-red-400 text-xs mt-1">{errors.paymentProof}</p>
                  )}
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