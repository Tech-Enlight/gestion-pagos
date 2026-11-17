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
        <p>
          Consulta el estatus de tus propias solicitudes y su avance: <strong>Solicitada</strong> (Finanzas
          la incluirá en una propuesta de pagos), <strong>Pago aprobado</strong> (la propuesta ya se aprobó
          y tu pago tiene fecha programada) y <strong>Pagada</strong>.
        </p>
        <p>
          Si Finanzas detecta algo que corregir, te pide una <strong>aclaración</strong> y la solicitud
          pasa a <em>Borrador</em>. Puedes elegir entre <em>"Solo responder y reenviar"</em> (respondes el
          comentario) o <em>"Editar solicitud"</em> (puedes corregir Concepto, Departamento, Tipo de Pago
          y montos antes de reenviarla). Al reenviarla vuelve a <strong>Solicitada</strong>.
        </p>
      </>
    ),
  },
  {
    title: "Planeación de pagos",
    body: (
      <>
        <p>
          Aquí se arma y se aprueba la <strong>propuesta semanal de pagos</strong>. Finanzas ve todas las
          solicitudes abiertas (con el veredicto Procede / Revisar / Bloquear y el vencimiento), crea una
          propuesta, agrega las que se pagan esa semana y fija la fecha de cada una; lo que no agrega queda
          aplazado. Al terminar, la envía a aprobación.
        </p>
        <p>
          La propuesta pasa por dos niveles: <strong>Nivel 1</strong> (Dirección: administración) y después{" "}
          <strong>Nivel 2</strong> (Operaciones, Ingeniería, Servicios y PMO). Basta con que apruebe una
          persona de cada nivel. Quien aprueba puede quitar pagos, mover fechas o fijar una{" "}
          <em>meta de total</em> antes de aprobar, o <strong>devolver</strong> la propuesta a Finanzas con un
          motivo. Con la aprobación del Nivel 2, los pagos pasan a Finanzas con su fecha programada.
        </p>
      </>
    ),
  },
  {
    title: "Decisión de Pagos",
    body: (
      <p>
        Vista de consulta y análisis para administración, analista contable y superadmin: resumen, proveedores,
        clientes y vencimientos, con el veredicto de cada pago (OC aprobada y avance del proyecto). Aquí ya no se
        aprueba: la aprobación se hace sobre la propuesta en Planeación de pagos. Sí se puede pedir una
        Aclaración o Rechazar una solicitud en particular. Al expandir una tarjeta se muestra el enlace directo
        a la factura real (PDF) cuando está disponible.
      </p>
    ),
  },
  {
    title: "Finanzas / Ejecución de pagos",
    body: (
      <>
        <p>
          El analista contable ejecuta lo aprobado: los pagos aparecen agrupados por fecha programada
          (Vencidos, Hoy, Mañana, Esta semana…), cada uno con su estado en NetSuite. Al marcar un pago, el
          sistema busca la factura/pago real en NetSuite y prellena Monto Pagado, Tipo de Cambio, Banco,
          Referencia y Comprobante de Pago.
        </p>
        <p>
          Si el monto de NetSuite no coincide exactamente con el solicitado (por ejemplo, por una
          retención contractual), aparece una advertencia amarilla — revisa el detalle antes de
          confirmar. También se puede marcar como pagada en lote. Si una fecha no se puede cumplir, se
          usa <em>Reprogramar</em> (con motivo); si hay un problema, <em>Reportar problema</em>: se envía al
          solicitante para corregir datos o se aplaza y vuelve a Planeación.
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
    a: "La visibilidad depende de tu rol. Planeación de pagos la ven Finanzas, administración, Operaciones, Ingeniería, Servicios y PMO; Finanzas (Ejecución de pagos) es solo para analista contable y superadmin; Decisión de Pagos y Explorador son para administración/analista/superadmin.",
  },
  {
    q: "¿Dónde apruebo una propuesta de pagos?",
    a: "En Planeación de pagos (menú lateral). La propuesta que espera tu aprobación se abre sola; revisa los pagos, ajusta lo que haga falta y usa «Aprobar», o «Devolver a Finanzas» con un motivo. También te llega un correo cuando una propuesta espera tu aprobación.",
  },
  {
    q: "¿Qué pasó con la pantalla de Aprobaciones?",
    a: "Ya no existe: ahora no se autoriza cada solicitud por separado, sino la propuesta semanal completa en Planeación de pagos. La aprobación individual en Decisión de Pagos también se retiró; esa vista quedó para consulta y análisis.",
  },
  {
    q: "Mi solicitud sigue en 'Solicitada', ¿es normal?",
    a: "Sí. Quiere decir que Finanzas todavía no la incluye en una propuesta aprobada. Cuando se apruebe, pasará a «Pago aprobado» y recibirás un correo con la fecha programada.",
  },
  {
    q: "Mi solicitud está en 'Borrador' con una aclaración, ¿qué hago?",
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
            color: "var(--enl-jade)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            color: "var(--wa-60)",
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
      <p style={{ color: "var(--wa-60)", fontSize: 13.5, marginBottom: 28, fontFamily: "Albert Sans, sans-serif" }}>
        Guía rápida del Portal de Pagos: qué hace cada sección y respuestas a las dudas más comunes.
      </p>

      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--wa-60)",
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
              border: "1px solid var(--wa-08)",
              borderRadius: 12,
              padding: "16px 18px",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8, color: "var(--enl-jade)" }}>
              {s.title}
            </div>
            <div style={{ color: "var(--wa-60)", fontSize: 13, fontFamily: "Albert Sans, sans-serif", lineHeight: 1.6 }}>
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
          color: "var(--wa-60)",
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
