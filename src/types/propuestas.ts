// Propuesta de pagos: lote semanal que arma Finanzas y que pasa por aprobación de dos niveles.
// El estado se deriva en n8n reproduciendo un log de eventos (hoja PropuestasEventos).
export type PropuestaEstado = "Borrador" | "Nivel 1" | "Nivel 2" | "Aprobada" | "Cancelada";

export interface PropuestaItem {
  requestId: string;
  /** YYYY-MM-DD */
  fechaProgramada: string;
  agregadoPor: string;
  agregadoEn: string;
}

export interface PropuestaHistorial {
  evento: string;
  requestId: string;
  nota: string;
  por: string;
  rol: string;
  en: string;
  fechaProgramada: string;
}

export interface Propuesta {
  id: string;
  nombre: string;
  /** YYYY-MM-DD */
  fechaCorte: string;
  estado: PropuestaEstado;
  creadaPor: { email: string; nombre: string; rol: string };
  creadaEn: string;
  enviadaEn: string;
  /** Quién aprobó cada nivel (se vacía si la propuesta regresa a Borrador). */
  aprobaciones: { nivel1?: { por: string; en: string }; nivel2?: { por: string; en: string } };
  /** Última devolución a Finanzas, con el motivo del aprobador. */
  devolucion: { por: string; nota: string; en: string } | null;
  /** Monto objetivo en MXN fijado por quien edita; null = sin meta. */
  meta: number | null;
  items: PropuestaItem[];
  historial: PropuestaHistorial[];
}

export type PropuestaEventoTipo = "crear" | "agregar" | "quitar" | "fecha" | "enviar" | "retirar" | "cancelar" | "aprobar" | "devolver" | "sincronizar" | "meta" | "reprogramar" | "excluir";

export interface PropuestaEvento {
  evento: PropuestaEventoTipo;
  requestId?: string;
  fechaProgramada?: string;
  nombre?: string;
  fechaCorte?: string;
  nota?: string;
  /** Solo "excluir": a dónde va el pago. solicitante = corrige datos (aclaración); aplazar = vuelve a Planeación. */
  destino?: "solicitante" | "aplazar";
  /** Solo para el evento "meta": monto objetivo en MXN (null la quita). */
  mxn?: number | null;
  /** JSON con el resumen de lo aprobado (totales) para auditoría; el servidor solo lo guarda. */
  datos?: string;
}
