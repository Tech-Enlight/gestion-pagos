import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { Request } from "../data/mockData";

interface Props {
  onAddRequest: (req: Request) => void;
  onNavigate: (tab: string) => void;
}

const currencies = ["MXN", "USD"];

const NewRequest: React.FC<Props> = ({ onAddRequest, onNavigate }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    poNumber: "",
    projectNumber: "",
    beneficiary: "",
    concept: "",
    subtotal: "",
    currency: "MXN",
    department: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [generatedId, setGeneratedId] = useState("");

  const subtotalNum = Number(form.subtotal) || 0;
  const iva = +(subtotalNum * 0.16).toFixed(2);
  const total = +(subtotalNum + iva).toFixed(2);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.poNumber.trim()) e.poNumber = "Ingresa el número de OC";
    if (!form.projectNumber.trim())
      e.projectNumber = "Ingresa el proyecto o departamento";
    if (!form.beneficiary.trim()) e.beneficiary = "Nombre requerido";
    if (!form.concept.trim()) e.concept = "Concepto requerido";
    if (!form.subtotal || subtotalNum <= 0)
      e.subtotal = "Subtotal válido requerido";
    if (!form.department.trim()) e.department = "Departamento requerido";
    return e;
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    const newId = `PAY-${String(Math.floor(Math.random() * 900) + 100)}`;
    const newReq: Request = {
      id: newId,
      poNumber: form.poNumber,
      projectNumber: form.projectNumber,
      beneficiary: form.beneficiary,
      concept: form.concept,
      subtotal: subtotalNum,
      iva,
      amount: total,
      currency: form.currency,
      department: form.department,
      status: "Autorización",
      submittedBy: user?.name || "Usuario Actual",
      date: new Date().toISOString().slice(0, 10),
      statusHistory: [
        {
          status: "Draft",
          timestamp: new Date().toISOString(),
          changedBy: user?.name || "Usuario Actual",
        },
        {
          status: "Autorización",
          timestamp: new Date().toISOString(),
          changedBy: user?.name || "Usuario Actual",
        },
      ],
    };
    onAddRequest(newReq);
    setGeneratedId(newId);
    setSubmitted(true);
  };

  const resetForm = () => {
    setSubmitted(false);
    setForm({
      poNumber: "",
      projectNumber: "",
      beneficiary: "",
      concept: "",
      subtotal: "",
      currency: "MXN",
      department: "",
    });
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="rounded-xl p-8 text-center border border-[#00aa85] shadow-xl max-w-md w-full"
          style={{ backgroundColor: "#1e2d3d" }}
        >
          <div className="text-5xl mb-4">✅</div>
          <h2
            className="text-white text-2xl font-bold mb-2"
            style={{ fontFamily: "Alexandria, sans-serif" }}
          >
            ¡Solicitud Enviada!
          </h2>
          <p className="text-gray-400 mb-4">
            Tu solicitud ha sido registrada y enviada a la cola de autorización.
          </p>
          <div className="bg-[#293C47] rounded-lg px-4 py-3 mb-6">
            <p className="text-gray-400 text-xs mb-1">ID de Solicitud</p>
            <p className="text-[#00aa85] text-2xl font-bold">{generatedId}</p>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Tu solicitud será revisada en un plazo de 1-2 días hábiles.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetForm}
              className="px-5 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: "#293C47" }}
            >
              Nueva Solicitud
            </button>
            <button
              onClick={() => onNavigate("mis-solicitudes")}
              className="px-5 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: "#00aa85" }}
            >
              Ver Mis Solicitudes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2
          className="text-white text-2xl font-bold mb-1"
          style={{ fontFamily: "Alexandria, sans-serif" }}
        >
          Nueva Solicitud de Pago
        </h2>
        <p className="text-gray-400 text-sm">
          Completa todos los campos para enviar la solicitud a revisión MAC.
        </p>
      </div>

      <FormSection title="Detalles del Proyecto y OC">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="OC"
            value={form.poNumber}
            onChange={(v) => handleChange("poNumber", v)}
            placeholder="Ej: OC-8829"
            error={errors.poNumber}
            required
          />
          <InputField
            label="No. de Proyecto o Departamento"
            value={form.projectNumber}
            onChange={(v) => handleChange("projectNumber", v)}
            placeholder="Proyecto o depto. para imputar"
            error={errors.projectNumber}
            required
          />
        </div>
      </FormSection>

      <FormSection title="Información del Beneficiario">
        <InputField
          label="Beneficiario"
          value={form.beneficiary}
          onChange={(v) => handleChange("beneficiary", v)}
          placeholder="Razón social o nombre"
          error={errors.beneficiary}
          required
        />
      </FormSection>

      <FormSection title="Concepto">
        <div>
          <label
            className="block text-gray-300 text-xs font-medium mb-1"
            style={{ fontFamily: "Alexandria, sans-serif" }}
          >
            Concepto de pago <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.concept}
            onChange={(e) => handleChange("concept", e.target.value)}
            placeholder="Describe el concepto del pago"
            rows={3}
            className={`w-full px-3 py-2 rounded-lg text-white text-sm outline-none border transition-colors resize-none ${
              errors.concept
                ? "border-red-500"
                : "border-gray-600 focus:border-[#00aa85]"
            }`}
            style={{
              backgroundColor: "#293C47",
              fontFamily: "Alexandria, sans-serif",
            }}
          />
          {errors.concept && (
            <p className="text-red-400 text-xs mt-1">{errors.concept}</p>
          )}
        </div>
      </FormSection>

      <FormSection title="Detalles del Pago">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Subtotal"
            value={form.subtotal}
            onChange={(v) => handleChange("subtotal", v)}
            placeholder="0.00"
            error={errors.subtotal}
            required
            type="number"
          />
          <ReadonlyField
            label="IVA (16%)"
            value={
              iva > 0
                ? iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })
                : "—"
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div
            className="rounded-lg px-3 py-2 border border-[#00aa85]"
            style={{ backgroundColor: "#293C47" }}
          >
            <label
              className="block text-[#00aa85] text-xs font-semibold mb-1"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              Monto Solicitado
            </label>
            <p
              className="text-white text-lg font-bold"
              style={{ fontFamily: "Alexandria, sans-serif" }}
            >
              {total > 0
                ? `$ ${total.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                  })}`
                : "—"}
            </p>
          </div>
          <SelectField
            label="Divisa"
            value={form.currency}
            onChange={(v) => handleChange("currency", v)}
            options={currencies}
          />
        </div>
      </FormSection>

      <FormSection title="Solicitante">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Departamento solicitante"
            value={form.department}
            onChange={(v) => handleChange("department", v)}
            placeholder="Tu departamento"
            error={errors.department}
            required
          />
          <ReadonlyField
            label="Persona Solicitante"
            value={user?.name || "Sin sesión"}
          />
        </div>
      </FormSection>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-8 py-3 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-colors"
          style={{
            backgroundColor: "#00aa85",
            fontFamily: "Alexandria, sans-serif",
          }}
        >
          Enviar Solicitud →
        </button>
      </div>
    </div>
  );
};

/* ---- Reusable sub-components ---- */

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div
    className="rounded-xl p-5 border border-gray-700 space-y-4"
    style={{ backgroundColor: "#1e2d3d" }}
  >
    <h3
      className="text-[#00aa85] text-sm font-semibold uppercase tracking-wider"
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {title}
    </h3>
    {children}
  </div>
);

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  required?: boolean;
  type?: string;
}
const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  type = "text",
}) => (
  <div>
    <label
      className="block text-gray-300 text-xs font-medium mb-1"
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg text-white text-sm outline-none border transition-colors ${
        error ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"
      }`}
      style={{
        backgroundColor: "#293C47",
        fontFamily: "Alexandria, sans-serif",
      }}
    />
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const ReadonlyField: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div>
    <label
      className="block text-gray-300 text-xs font-medium mb-1"
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {label}
    </label>
    <div
      className="w-full px-3 py-2 rounded-lg text-gray-400 text-sm border border-gray-600 cursor-not-allowed"
      style={{
        backgroundColor: "#243340",
        fontFamily: "Alexandria, sans-serif",
      }}
    >
      {value}
    </div>
  </div>
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}
const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  options,
}) => (
  <div>
    <label
      className="block text-gray-300 text-xs font-medium mb-1"
      style={{ fontFamily: "Alexandria, sans-serif" }}
    >
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-[#00aa85] transition-colors"
      style={{
        backgroundColor: "#293C47",
        fontFamily: "Alexandria, sans-serif",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

export default NewRequest;
