import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmText = 'Eliminar', danger = true }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Focus the cancel button when modal opens
    cancelRef.current?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel} role="presentation">
      <div
        className="bg-white rounded-xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-800">{title || 'Confirmar acción'}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar diálogo">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle size={20} className={danger ? 'text-red-500' : 'text-amber-500'} aria-hidden="true" />
            </div>
            <p id="confirm-modal-desc" className="text-gray-600 text-sm mt-2">{message || '¿Estás seguro de que deseas continuar? Esta acción no se puede deshacer.'}</p>
          </div>
          <div className="flex gap-3">
            <button ref={cancelRef} onClick={onCancel}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
              Cancelar
            </button>
            <button onClick={onConfirm}
              className={`flex-1 py-2 rounded-lg text-white font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
