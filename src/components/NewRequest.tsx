import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchProjects, fetchOCsByProject, fetchVendorName } from "../services/sheets";
import type { Request } from "../data/mockData";
import { Combobox } from "./Combobox";
import { CheckCircle2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types for NS endpoint responses                                    */
/* ------------------------------------------------------------------ */
interface NSProject {
  code: string;
  name: string;
  internal_id: string;
  project_type?: string;
  start_date?: string;
  customer?: { id: string; code: string; name: string };
}

interface NSOC {
  internal_id: string;
  oc_number: string;
  fecha: string;
  estatus: string;
  vendor_id: string;
  vendor_code: string;
  moneda: string;
  tipo_cambio: number;
  monto_total: number;
  nota?: string;
}

interface NSVendor {
  id: string;
  code: string;
  name: string;
  rfc: string;
  email?: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  onAddRequest: (req: Request) => void;
  onNavigate: (tab: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
/** Map NS moneda string → standard currency code */
const normalizeCurrency = (moneda: string): string => {
  const m = moneda.toLowerCase();
  if (m.includes("dollar") || m.includes("usd") || m.includes("dólar")) return "USD";
  return "MXN";
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const NewRequest: React.FC<Props> = ({ onAddRequest, onNavigate }) => {
  const { user } = useAuth();

  // ---- Cascade data ----
  const [projects, setProjects] = useState<NSProject[]>([]);
  const [ocList, setOcList] = useState<NSOC[]>([]);
  const [vendor, setVendor] = useState<NSVendor | null>(null);

  // ---- Loading / error states ----
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingOCs, setLoadingOCs] = useState(false);
  const [loadingVendor, setLoadingVendor] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ---- Selections ----
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedOcId, setSelectedOcId] = useState("");

  // ---- Manual fields ----
  const [paymentType, setPaymentType] = useState<"Completo" | "Parcial">("Completo");
  const [partialSubtotal, setPartialSubtotal] = useState("");
  const [concept, setConcept] = useState("");
  const [department, setDepartment] = useState("");

  // ---- Validation ----
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---- Post-submit ----
  const [submitted, setSubmitted] = useState(false);
  const [generatedId, setGeneratedId] = useState("");

  // ---- Derived from selected OC ----
  const selectedOC = ocList.find((oc) => oc.internal_id === selectedOcId) ?? null;
  const selectedProject = projects.find((p) => p.internal_id === selectedProjectId) ?? null;

  const currency = selectedOC ? normalizeCurrency(selectedOC.moneda) : "MXN";
  const ocTotal = selectedOC?.monto_total ?? 0;
  const exchangeRate = selectedOC?.tipo_cambio ?? 0;

  // ocTotal viene de NetSuite como t.total, que YA incluye el 16% de IVA.
  const subtotalNum =
    paymentType === "Completo"
      ? +(ocTotal / 1.16).toFixed(2)
      : Number(partialSubtotal) || 0;
  const iva =
    paymentType === "Completo"
      ? +(ocTotal - subtotalNum).toFixed(2)
      : +(subtotalNum * 0.16).toFixed(2);
  const total = paymentType === "Completo" ? ocTotal : +(subtotalNum + iva).toFixed(2);

  // ================================================================
  //  1. Fetch projects on mount
  // ================================================================
  useEffect(() => {
    let cancelled = false;
    setLoadingProjects(true);
    setFetchError(null);
    fetchProjects()
      .then((list: any[]) => {
        if (!cancelled) setProjects(list as NSProject[]);
      })
      .catch((err) => {
        if (!cancelled) setFetchError("No se pudieron cargar los proyectos.");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ================================================================
  //  2. Fetch OCs when project changes
  // ================================================================
  const handleProjectChange = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    // Reset downstream
    setSelectedOcId("");
    setOcList([]);
    setVendor(null);
    setPaymentType("Completo");
    setPartialSubtotal("");
    setErrors({});

    if (!projectId) return;

    setLoadingOCs(true);
    setFetchError(null);
    fetchOCsByProject(projectId)
      .then((data: any) => {
        setOcList((data.oc_list || []) as NSOC[]);
      })
      .catch((err) => {
        setFetchError("No se pudieron cargar las OCs del proyecto.");
        console.error(err);
      })
      .finally(() => setLoadingOCs(false));
  }, []);

  // ================================================================
  //  3. Fetch vendor when OC changes
  // ================================================================
  const handleOCChange = useCallback(
    (ocInternalId: string) => {
      setSelectedOcId(ocInternalId);
      setVendor(null);
      setPaymentType("Completo");
      setPartialSubtotal("");
      setErrors({});

      const oc = ocList.find((o) => o.internal_id === ocInternalId);
      if (!oc) return;

      setLoadingVendor(true);
      fetchVendorName(oc.vendor_id)
        .then((v: any) => setVendor(v as NSVendor))
        .catch((err) => {
          setFetchError("No se pudo obtener datos del proveedor.");
          console.error(err);
        })
        .finally(() => setLoadingVendor(false));
    },
    [ocList]
  );

  // ================================================================
  //  Validation
  // ================================================================
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!selectedProjectId) e.project = "Selecciona un proyecto";
    if (!selectedOcId) e.oc = "Selecciona una OC";
    if (!concept.trim()) e.concept = "Concepto requerido";
    if (!department.trim()) e.department = "Departamento requerido";
    if (paymentType === "Parcial") {
      const v = Number(partialSubtotal);
      if (!partialSubtotal || v <= 0) e.subtotal = "Subtotal válido requerido";
      else if (v > ocTotal) e.subtotal = `No puede exceder el total de la OC ($${ocTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })})`;
    }
    return e;
  };

  // ================================================================
  //  Submit
  // ================================================================
  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    const newId = `PAY-${String(Math.floor(Math.random() * 900) + 100)}`;
    const newReq: Request = {
      id: newId,
      poNumber: selectedOC?.oc_number || "",
      projectNumber: selectedProject ? `${selectedProject.code} — ${selectedProject.name}` : "",
      beneficiary: vendor?.name || "",
      concept: concept.trim(),
      subtotal: subtotalNum,
      iva,
      amount: total,
      currency,
      department: department.trim(),
      status: "Autorización",
      submittedBy: user?.name || "Usuario Actual",
      submittedByEmail: user?.email,
      date: new Date().toISOString().slice(0, 10),
      statusHistory: [
        { status: "Draft", timestamp: new Date().toISOString(), changedBy: user?.name || "" },
        { status: "Autorización", timestamp: new Date().toISOString(), changedBy: user?.name || "" },
      ],
      // NS-sourced metadata
      nsProjectId: selectedProjectId,
      nsOcInternalId: selectedOcId,
      vendorId: vendor?.id,
      vendorRfc: vendor?.rfc,
      paymentType,
      ocTotal,
      exchangeRate,
    };
    onAddRequest(newReq);
    setGeneratedId(newId);
    setSubmitted(true);
  };

  // ================================================================
  //  Reset
  // ================================================================
  const resetForm = () => {
    setSubmitted(false);
    setSelectedProjectId("");
    setSelectedOcId("");
    setOcList([]);
    setVendor(null);
    setPaymentType("Completo");
    setPartialSubtotal("");
    setConcept("");
    setDepartment("");
    setErrors({});
    setFetchError(null);
  };

  // ================================================================
  //  Success screen (unchanged UX)
  // ================================================================
  if (submitted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="rounded-xl p-8 text-center border border-[#00aa85] shadow-xl max-w-md w-full"
          style={{ backgroundColor: "#1e2d3d" }}
        >
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#00aa85]/20 text-[#00aa85] flex items-center justify-center">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: "Alexandria, sans-serif" }}>
            ¡Solicitud Enviada!
          </h2>
          <p className="text-gray-400 mb-4">Tu solicitud ha sido registrada y enviada a la cola de autorización.</p>
          <div className="bg-[#293C47] rounded-lg px-4 py-3 mb-6">
            <p className="text-gray-400 text-xs mb-1">ID de Solicitud</p>
            <p className="text-[#00aa85] text-2xl font-bold">{generatedId}</p>
          </div>
          <p className="text-gray-400 text-sm mb-6">Tu solicitud será revisada en un plazo de 1-2 días hábiles.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={resetForm} className="px-5 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: "#293C47" }}>
              Nueva Solicitud
            </button>
            <button onClick={() => onNavigate("mis-solicitudes")} className="px-5 py-2 rounded-lg text-white font-medium" style={{ backgroundColor: "#00aa85" }}>
              Ver Mis Solicitudes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  //  Main form
  // ================================================================
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
          Nueva Solicitud de Pago
        </h2>
        <p className="text-gray-400 text-sm">Selecciona proyecto y OC. Los datos se auto-llenan desde NetSuite.</p>
      </div>

      {/* Global fetch error banner */}
      {fetchError && (
        <div className="rounded-lg px-4 py-3 border border-red-700 text-red-300 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
          {fetchError}
        </div>
      )}

      {/* ---- Section 1: Proyecto ---- */}
      <FormSection title="Proyecto">
        <div>
          <label className="block text-gray-300 text-xs font-medium mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
            Proyecto <span className="text-red-400">*</span>
          </label>
          {loadingProjects ? (
            <Skeleton />
          ) : (
            <Combobox
              options={projects.map((p) => ({
                value: p.internal_id,
                label: `${p.code} — ${p.name}`,
              }))}
              value={selectedProjectId}
              onChange={handleProjectChange}
              placeholder="Seleccionar proyecto..."
              emptyMessage="No se encontraron proyectos."
              hasError={!!errors.project}
            />
          )}
          {errors.project && <p className="text-red-400 text-xs mt-1">{errors.project}</p>}
        </div>
      </FormSection>

      {/* ---- Section 2: OC (visible after project selected) ---- */}
      {selectedProjectId && (
        <FormSection title="Orden de Compra">
          <div>
            <label className="block text-gray-300 text-xs font-medium mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
              OC <span className="text-red-400">*</span>
            </label>
            {loadingOCs ? (
              <Skeleton />
            ) : ocList.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">No se encontraron OCs abiertas para este proyecto.</p>
            ) : (
              <Combobox
                options={ocList.map((oc) => ({
                  value: oc.internal_id,
                  label: `${oc.oc_number} — $${oc.monto_total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${normalizeCurrency(oc.moneda)}`,
                }))}
                value={selectedOcId}
                onChange={handleOCChange}
                placeholder="Seleccionar OC..."
                emptyMessage="No se encontraron OCs."
                hasError={!!errors.oc}
              />
            )}
            {errors.oc && <p className="text-red-400 text-xs mt-1">{errors.oc}</p>}
          </div>
        </FormSection>
      )}

      {/* ---- Section 3: Auto-filled fields (visible after OC + vendor loaded) ---- */}
      {selectedOC && (
        <FormSection title="Datos de la OC (NetSuite)">
          {loadingVendor ? (
            <Skeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReadonlyField label="OC" value={selectedOC.oc_number} />
              <ReadonlyField label="Beneficiario" value={vendor?.name || "Cargando..."} />
              <ReadonlyField label="RFC" value={vendor?.rfc || "—"} />
              <ReadonlyField label="Moneda" value={currency} />
              <ReadonlyField label="Tipo de Cambio" value={exchangeRate > 0 ? exchangeRate.toFixed(4) : "—"} />
              <ReadonlyField
                label="Monto Total OC"
                value={`$ ${ocTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`}
              />
              <ReadonlyField label="Estatus OC" value={selectedOC.estatus} />
              <ReadonlyField label="Fecha OC" value={selectedOC.fecha} />
            </div>
          )}
        </FormSection>
      )}

      {/* ---- Section 4: Payment details (visible after OC selected) ---- */}
      {selectedOC && !loadingVendor && (
        <FormSection title="Detalles del Pago">
          {/* Payment type toggle */}
          <div>
            <label className="block text-gray-300 text-xs font-medium mb-2" style={{ fontFamily: "Alexandria, sans-serif" }}>
              Tipo de pago <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {(["Completo", "Parcial"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setPaymentType(t);
                    setPartialSubtotal("");
                    setErrors((prev) => { const n = { ...prev }; delete n.subtotal; return n; });
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border ${paymentType === t
                    ? "text-white border-[#00aa85]"
                    : "text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                  style={{
                    backgroundColor: paymentType === t ? "rgba(0,170,133,0.15)" : "#293C47",
                    fontFamily: "Alexandria, sans-serif",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subtotal */}
            {paymentType === "Completo" ? (
              <ReadonlyField
                label="Subtotal"
                value={`$ ${subtotalNum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
              />
            ) : (
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
                  Subtotal <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={partialSubtotal}
                  onChange={(e) => {
                    setPartialSubtotal(e.target.value);
                    setErrors((prev) => { const n = { ...prev }; delete n.subtotal; return n; });
                  }}
                  placeholder={`Máximo ${ocTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
                  step="0.01"
                  max={ocTotal}
                  className={`w-full px-3 py-2 rounded-lg text-white text-sm outline-none border transition-colors ${errors.subtotal ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"
                    }`}
                  style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                />
                {errors.subtotal && <p className="text-red-400 text-xs mt-1">{errors.subtotal}</p>}
              </div>
            )}

            {/* IVA */}
            <ReadonlyField
              label="IVA (16%)"
              value={iva > 0 ? `$ ${iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
            />
          </div>

          {/* Monto Solicitado + Divisa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg px-3 py-2 border border-[#00aa85]" style={{ backgroundColor: "#293C47" }}>
              <label className="block text-[#00aa85] text-xs font-semibold mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
                Monto Solicitado
              </label>
              <p className="text-white text-lg font-bold" style={{ fontFamily: "Alexandria, sans-serif" }}>
                {total > 0 ? `$ ${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
              </p>
            </div>
            <ReadonlyField label="Divisa" value={currency} />
          </div>
        </FormSection>
      )}

      {/* ---- Section 5: Concepto + Solicitante ---- */}
      {selectedOC && !loadingVendor && (
        <>
          <FormSection title="Concepto">
            <div>
              <label className="block text-gray-300 text-xs font-medium mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
                Concepto de pago <span className="text-red-400">*</span>
              </label>
              <textarea
                value={concept}
                onChange={(e) => {
                  setConcept(e.target.value);
                  setErrors((prev) => { const n = { ...prev }; delete n.concept; return n; });
                }}
                placeholder="Describe el concepto del pago"
                rows={3}
                className={`w-full px-3 py-2 rounded-lg text-white text-sm outline-none border transition-colors resize-none ${errors.concept ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"
                  }`}
                style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
              />
              {errors.concept && <p className="text-red-400 text-xs mt-1">{errors.concept}</p>}
            </div>
          </FormSection>

          <FormSection title="Solicitante">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
                  Departamento solicitante <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setErrors((prev) => { const n = { ...prev }; delete n.department; return n; });
                  }}
                  placeholder="Tu departamento"
                  className={`w-full px-3 py-2 rounded-lg text-white text-sm outline-none border transition-colors ${errors.department ? "border-red-500" : "border-gray-600 focus:border-[#00aa85]"
                    }`}
                  style={{ backgroundColor: "#293C47", fontFamily: "Alexandria, sans-serif" }}
                />
                {errors.department && <p className="text-red-400 text-xs mt-1">{errors.department}</p>}
              </div>
              <ReadonlyField label="Persona Solicitante" value={user?.name || "Sin sesión"} />
            </div>
          </FormSection>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              className="px-8 py-3 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition-colors"
              style={{ backgroundColor: "#00aa85", fontFamily: "Alexandria, sans-serif" }}
            >
              Enviar Solicitud →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Reusable sub-components                                            */
/* ================================================================== */

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl p-5 border border-gray-700 space-y-4" style={{ backgroundColor: "#1e2d3d" }}>
    <h3 className="text-[#00aa85] text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "Alexandria, sans-serif" }}>
      {title}
    </h3>
    {children}
  </div>
);

const ReadonlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <label className="block text-gray-300 text-xs font-medium mb-1" style={{ fontFamily: "Alexandria, sans-serif" }}>
      {label}
    </label>
    <div
      className="w-full px-3 py-2 rounded-lg text-gray-400 text-sm border border-gray-600 cursor-not-allowed"
      style={{ backgroundColor: "#243340", fontFamily: "Alexandria, sans-serif" }}
    >
      {value}
    </div>
  </div>
);

/** Placeholder skeleton while async data loads */
const Skeleton: React.FC = () => (
  <div className="w-full h-10 rounded-lg animate-pulse" style={{ backgroundColor: "#293C47" }} />
);

export default NewRequest;