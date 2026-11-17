/**
 * Interruptor del flujo de propuestas de pago (decidido con Pedro Avalos el 2026-11-17).
 *
 * false → flujo actual: MAC autoriza en Aprobaciones, admin aprueba en Decisión de Pagos, y la vista
 *         Planeación es solo para superadmin (pruebas).
 * true  → flujo nuevo: Finanzas arma la propuesta, la aprueban Nivel 1 y Nivel 2; Aprobaciones se
 *         retira, Decisión de Pagos queda como vista de análisis (sin botón Aprobar) y Planeación se
 *         abre a todos los roles que participan.
 *
 * POR QUÉ un interruptor y no código condicional suelto: el cambio también exige mover n8n (estado
 * "Solicitada", avisos de correo, migración de filas) y esas dos mitades deben salir el mismo día.
 * Se activa en el cutover coordinado, no antes (ver CLAUDE.md § Nuevo flujo de propuestas).
 */
export const FLUJO_PROPUESTAS = true;
