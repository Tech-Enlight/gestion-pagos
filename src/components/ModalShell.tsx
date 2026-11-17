import React, { useEffect, useRef } from "react";

// Elementos que reciben foco con Tab dentro del diálogo (visibles y no deshabilitados)
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const focusablesIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

interface Props {
  /** id del título visible (aria-labelledby). */
  labelledBy?: string;
  /** Nombre accesible cuando no hay título visible. */
  label?: string;
  /**
   * Esc cierra el diálogo. Omitirlo lo desactiva: útil en formularios largos donde un Esc accidental
   * perdería lo capturado (p. ej. "Marcar Pagado"); el usuario sigue pudiendo cerrar con el botón.
   */
  onClose?: () => void;
  /** Clic en el fondo oscuro (no dentro del contenido). Si se omite, el fondo no cierra. */
  onBackdropClick?: () => void;
  /**
   * Dónde cae el foco al abrir. "first" (por defecto): el primer control. "container": el propio diálogo,
   * para formularios cuyo primer campo reaccionaría al foco (listas que se despliegan, pickers) y
   * donde se quiere conservar el comportamiento previo de no enfocar nada automáticamente.
   */
  initialFocus?: "first" | "container";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Overlay modal accesible: rol de diálogo, foco que entra al abrir, queda atrapado mientras está abierto
 * y regresa a donde estaba al cerrar. Solo agrega comportamiento: la apariencia la sigue dando el
 * `className`/`style` que ya usaba cada modal, así migrar uno no cambia cómo se ve.
 */
export const ModalShell: React.FC<Props> = ({ labelledBy, label, onClose, onBackdropClick, initialFocus = "first", className, style, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previo = document.activeElement as HTMLElement | null;
    // Si el modal ya enfocó algo (autoFocus) se respeta; si no, el primer control, o el propio diálogo
    if (!root.contains(document.activeElement)) (initialFocus === "container" ? root : (focusablesIn(root)[0] ?? root)).focus();
    return () => {
      // Solo se restaura si el elemento sigue en pantalla (la lista pudo re-renderizarse al cerrar)
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [initialFocus]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      // Un control interno (p. ej. la lista del Combobox) que ya consumió Esc lo marca con preventDefault
      if (onClose && !e.defaultPrevented) { e.stopPropagation(); onClose(); }
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const items = focusablesIn(ref.current);
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // El foco no se escapa del diálogo: Tab desde el último vuelve al primero y Shift+Tab al revés
    if (e.shiftKey && (active === first || active === ref.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      // -1: un clic en texto del modal no debe mandar el foco al body (se perdería Esc/Tab)
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onBackdropClick ? (e) => { if (e.target === e.currentTarget) onBackdropClick(); } : undefined}
      className={className}
      style={{ outline: "none", ...style }}
    >
      {children}
    </div>
  );
};

export default ModalShell;
