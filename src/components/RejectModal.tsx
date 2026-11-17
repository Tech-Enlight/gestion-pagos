import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import { T } from './decision/tokens';
import { ActionBtn, BarBtn, useEscape } from './decision/ui';

interface Props {
  /** "PAY-123", "3 solicitudes" o (legacy) "de 3 solicitudes" — se normaliza para el título. */
  requestId: string;
  onConfirm: (id: string, comment: string) => void;
  onCancel: () => void;
}

// Mismo lenguaje que ClarifyModal (decision/Modals): diálogo accesible, Esc cierra, foco en el campo.
const RejectModal: React.FC<Props> = ({ requestId, onConfirm, onCancel }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  useEscape(onCancel);

  // Los llamadores pasan "de N solicitudes"; el título leía "Rechazar Solicitud de N solicitudes".
  const label = requestId.replace(/^de /, '');

  const handleConfirm = () => {
    if (!comment.trim()) { setError('Escribe el motivo del rechazo.'); return; }
    onConfirm(requestId, comment.trim());
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="reject-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: T.modalBg, borderRadius: 12, border: `1px solid ${T.red}70`, boxShadow: '0 16px 60px rgba(0,0,0,0.5)', padding: 24, width: 'min(440px, 100%)' }}>
        <div id="reject-title" style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 6 }}>
          Rechazar {label}
        </div>
        <p style={{ fontSize: 13, color: T.textSub, fontFamily: T.fontAlt, margin: '0 0 14px' }}>
          El rechazo es definitivo y el solicitante recibe el motivo por correo.
        </p>
        <textarea
          autoFocus
          aria-label="Motivo del rechazo"
          aria-invalid={!!error}
          value={comment}
          onChange={(e) => { setComment(e.target.value); setError(''); }}
          placeholder="Describe el motivo del rechazo…"
          rows={4}
          className="dp-input"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8,
            background: T.ink, color: T.text, fontSize: 13, fontFamily: T.font,
            border: `1px solid ${error ? T.red : T.cardBorder}`, outline: 'none', resize: 'none',
          }}
        />
        {error && <p role="alert" style={{ color: T.red, fontSize: 12, fontFamily: T.fontAlt, margin: '6px 0 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <BarBtn label="Cancelar" onClick={onCancel} />
          <ActionBtn label="Confirmar rechazo" color={T.red} icon={<XCircle size={14} />} onClick={handleConfirm} />
        </div>
      </div>
    </div>
  );
};

export default RejectModal;
