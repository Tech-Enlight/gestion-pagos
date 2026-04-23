import React, { useState } from 'react';

interface Props {
  requestId: string;
  onConfirm: (id: string, comment: string) => void;
  onCancel: () => void;
}

const RejectModal: React.FC<Props> = ({ requestId, onConfirm, onCancel }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!comment.trim()) { setError('Por favor, proporciona un motivo de rechazo.'); return; }
    onConfirm(requestId, comment.trim());
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl p-6 border border-red-700 shadow-2xl max-w-md w-full mx-4" style={{ backgroundColor: '#1e2d3d' }}>
        <h3 className="text-white text-lg font-bold mb-2" style={{ fontFamily: 'Alexandria, sans-serif' }}>Rechazar Solicitud {requestId}</h3>
        <p className="text-gray-400 text-sm mb-4">Proporciona el motivo del rechazo. El solicitante será notificado.</p>
        <textarea
          value={comment}
          onChange={e => { setComment(e.target.value); setError(''); }}
          placeholder="Describe el motivo del rechazo..."
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none border border-gray-600 focus:border-red-500 resize-none"
          style={{ backgroundColor: '#293C47', fontFamily: 'Alexandria, sans-serif' }}
        />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-gray-300 text-sm font-medium border border-gray-600 hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition-colors"
          >
            Confirmar Rechazo
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;