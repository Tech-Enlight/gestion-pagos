import React, { useState } from "react";
import { exchangeRates } from "../data/mockData";
import type { Request } from "../data/mockData";

interface Props {
  request: Request;
  onConfirm: (id: string, paymentData: PaymentData) => void;
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
  "Cheque",
  "Efectivo",
  "Tarjeta corporativa",
];
const EXPENSE_TYPES = ["CAPEX", "OPEX", "SG&A"];
const OPERATION_TYPES = [
  "Pago a proveedor",
  "Reembolso",
  "Anticipo",
  "Pago de nómina",
  "Otro",
];

const PaymentModal: React.FC<Props> = ({ request, onConfirm, onCancel }) => {
  const lastRate = exchangeRates[exchangeRates.length - 1];

  const [amountPaid, setAmountPaid] = useState<string>(
    request.amount.toString()
  );
  const [exchangeRate, setExchangeRate] = useState<string>(
    lastRate.rate.toString()
  );
  const [bankName, setBankName] = useState("");
  const [operationRef, setOperationRef] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceLink, setInvoiceLink] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [operationType, setOperationType] = useState("");
  const [ocStatus, setOcStatus] = useState("");
  const [client, setClient] = useState("");
  const [serviceDelivery, setServiceDelivery] = useState("");
  const [proposal, setProposal] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amountPaidNum = parseFloat(amountPaid) || 0;
  const exchangeRateNum = parseFloat(exchangeRate) || 0;
  const amountMXN =
    request.currency === "USD"
      ? amountPaidNum * exchangeRateNum
      : amountPaidNum;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!amountPaid || amountPaidNum <= 0) e.amountPaid = "Monto requerido";
    if (!bankName) e.bankName = "Selecciona un banco";
    if (!operationRef.trim()) e.operationRef = "Referencia requerida";
    if (!paymentMode) e.paymentMode = "Selecciona modo de pago";
    if (request.currency === "USD" && exchangeRateNum <= 0)
      e.exchangeRate = "T/C inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    onConfirm(request.id, {
      amountPaid: amountPaidNum,
      exchangeRate: exchangeRateNum,
      amountMXN,
      bankName,
      operationRef: operationRef.trim(),
      paymentMode,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceLink: invoiceLink.trim() || undefined,
      expenseType: expenseType || undefined,
      operationType: operationType || undefined,
      ocStatus: ocStatus.trim() || undefined,
      client: client.trim() || undefined,
      serviceDelivery: serviceDelivery.trim() || undefined,
      proposal: proposal.trim() || undefined,
      paymentProof: paymentProof.trim() || undefined,
    });
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-[#00aa85] transition-colors";
  const inputStyle = {
    backgroundColor: "#293C47",
    fontFamily: "Alexandria, sans-serif",
  };
  const labelClass = "text-gray-400 text-xs font-medium mb-1 block";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="rounded-xl border border-gray-600 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
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
            Registrar Pago — {request.id}
          </h3>
          <p className="text-gray-400 text-xs mt-1">
            {request.beneficiary} ·{" "}
            {request.amount.toLocaleString("es-MX", {
              minimumFractionDigits: 2,
            })}{" "}
            {request.currency}
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
              Datos obligatorios
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monto Pagado */}
              <div>
                <label className={labelClass}>
                  Monto Pagado ({request.currency})*
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => {
                    setAmountPaid(e.target.value);
                    setErrors((p) => ({ ...p, amountPaid: "" }));
                  }}
                  className={inputClass}
                  style={inputStyle}
                  step="0.01"
                />
                {errors.amountPaid && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.amountPaid}
                  </p>
                )}
              </div>

              {/* T/C (only for USD) */}
              {request.currency === "USD" && (
                <div>
                  <label className={labelClass}>
                    Tipo de Cambio*{" "}
                    <span className="text-gray-500">
                      (Banxico {lastRate.date})
                    </span>
                  </label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => {
                      setExchangeRate(e.target.value);
                      setErrors((p) => ({ ...p, exchangeRate: "" }));
                    }}
                    className={inputClass}
                    style={inputStyle}
                    step="0.0001"
                  />
                  {errors.exchangeRate && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.exchangeRate}
                    </p>
                  )}
                </div>
              )}

              {/* Monto en MXN (calculated, read-only) */}
              {request.currency === "USD" && (
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
              )}

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

              {/* Referencia Operación */}
              <div>
                <label className={labelClass}>Referencia de Operación*</label>
                <input
                  type="text"
                  value={operationRef}
                  onChange={(e) => {
                    setOperationRef(e.target.value);
                    setErrors((p) => ({ ...p, operationRef: "" }));
                  }}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Ej: TRF-20231027-001"
                />
                {errors.operationRef && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.operationRef}
                  </p>
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
            </div>
          </div>

          {/* === Optional fields === */}
          <div>
            <p
              className="text-gray-500 text-xs font-semibold mb-3 uppercase tracking-wide"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Datos complementarios (opcionales)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>N° de Factura</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={inputClass}
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
                <input
                  type="text"
                  value={serviceDelivery}
                  onChange={(e) => setServiceDelivery(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass}>Propuesta</label>
                <input
                  type="text"
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
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
              onClick={handleConfirm}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              Confirmar Pago
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
