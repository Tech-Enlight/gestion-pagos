import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Section {
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    title: "Nueva solicitud",
    body: (
      <>
        <p>
          Crea una solicitud de pago eligiendo el <strong>Departamento solicitante</strong> (buscador
          conectado a los CeCo/proyectos de NetSuite), la OC correspondiente y el tipo de pago
          (Completo o Parcial). Si una OC ya tiene una factura totalmente pagada en NetSuite, aparece
          marcada como <em>"Ya pagada"</em> en el buscador para evitar duplicar la solicitud.
        </p>
        <p>El Beneficiario se completa automáticamente con el proveedor de la OC seleccionada.</p>
      </>
    ),
  },
  {
    title: "Mis solicitudes",
    body: (
      <>
        <p>Consulta el estatus de tus propias solicitudes y su avance paso a paso.</p>
        <p>
          Si finanzas o administración piden una <strong>aclaración</strong>, puedes elegir entre{" "}
          <em>"Solo responder y reenviar"</em> (respondes el comentario y la solicitud vuelve al flujo
          tal cual) o <em>"Editar solicitud"</em> (puedes corregir Concepto, Departamento, Tipo de Pago
          y montos antes de reenviarla).
        </p>
      </>
    ),
  },
  {
    title: "Aprobaciones",
    body: (
      <p>
        Vista para MAC/Dirección: autoriza o pide aclaración sobre las solicitudes recién enviadas
        antes de que pasen a decisión final.
      </p>
    ),
  },
  {
    title: "Decisión de Pagos",
    body: (
      <p>
        Vista de administración/superadmin: Aprobar, pedir Aclaración o Rechazar cada solicitud.
        Al expandir una tarjeta se muestra el enlace directo a la factura real (PDF) cuando está
        disponible, junto con el estatus de la OC en NetSuite.
      </p>
    ),
  },
  {
    title: "Finanzas / Marcar Pagado",
    body: (
      <>
        <p>
          El analista contable programa la fecha de pago y, cuando corresponde, marca la solicitud
          como pagada. Al marcar un pago, el sistema busca la factura/pago real en NetSuite y prellena
          Monto Pagado, Tipo de Cambio, Banco, Referencia y Comprobante de Pago.
        </p>
        <p>
          Si el monto de NetSuite no coincide exactamente con el solicitado (por ejemplo, por una
          retención contractual), aparece una advertencia amarilla — revisa el detalle antes de
          confirmar. También se puede marcar como pagada en lote (varias solicitudes a la vez).
        </p>
      </>
    ),
  },
  {
    title: "Inicio (anuncios)",
    body: (
      <p>
        Feed de anuncios del equipo de Finanzas/Administración. Cualquier usuario puede darle
        "like" (ícono de rayo) a un anuncio. La campana en la barra superior muestra cuántos
        anuncios no has leído.
      </p>
    ),
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "¿Por qué no veo cierta sección en el menú lateral?",
    a: "La visibilidad depende de tu rol. Por ejemplo, Aprobaciones es solo para MAC/Dirección y superadmin; Finanzas es solo para analista contable y superadmin; Decisión de Pagos y Explorador son para administración/analista/superadmin.",
  },
  {
    q: "Mi solicitud está en 'Aclaración', ¿qué hago?",
    a: "Ve a Mis solicitudes, ábrela y elige responder el comentario o editar los datos de la solicitud antes de reenviarla. Recibirás un correo cuando esto ocurra.",
  },
  {
    q: "¿Por qué el monto que muestra NetSuite no coincide con el que solicité?",
    a: "Puede deberse a una retención aplicada al momento de facturar. El sistema te avisa con una advertencia y te deja confirmar el pago real revisando el detalle antes de continuar.",
  },
  {
    q: "No puedo marcar una solicitud como pagada",
    a: "Revisa que la OC/factura relacionada ya tenga un pago registrado en NetSuite. Si el problema persiste, contacta al equipo de Finanzas/TECH.",
  },
];

function AccordionItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 10,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#fff",
          fontFamily: "Alexandria, sans-serif",
          fontSize: 13.5,
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        {q}
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: "#00AA85",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            color: "#94a3b8",
            fontSize: 13,
            fontFamily: "Albert Sans, sans-serif",
            lineHeight: 1.6,
          }}
        >
          {a}
        </div>
      )}
    </div>
  );
}

export default function Help() {
  return (
    <div style={{ color: "#fff", fontFamily: "Alexandria, sans-serif", maxWidth: 820 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Ayuda</h2>
      <p style={{ color: "#94a3b8", fontSize: 13.5, marginBottom: 28, fontFamily: "Albert Sans, sans-serif" }}>
        Guía rápida del Portal de Pagos: qué hace cada sección y respuestas a las dudas más comunes.
      </p>

      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Albert Sans, sans-serif",
          marginBottom: 14,
        }}
      >
        Secciones del portal
      </h3>
      <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 18px",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8, color: "#00AA85" }}>
              {s.title}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: "Albert Sans, sans-serif", lineHeight: 1.6 }}>
              {s.body}
            </div>
          </div>
        ))}
      </div>

      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Albert Sans, sans-serif",
          marginBottom: 14,
        }}
      >
        Preguntas frecuentes
      </h3>
      <div>
        {FAQ.map((item) => (
          <AccordionItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}
