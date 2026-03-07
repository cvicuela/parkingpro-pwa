import { useState, useRef, useEffect } from 'react';
import { X, Printer, Eye, Download, Maximize2, Minimize2 } from 'lucide-react';

const PRINTER_STYLES = `
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #000; background: #fff; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 18px; }
  .small { font-size: 10px; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
  .plate { font-size: 24px; font-weight: bold; letter-spacing: 2px; }
  .qr { width: 160px; height: 160px; margin: 8px auto; display: block; }
  .mt { margin-top: 8px; }
  .mb { margin-bottom: 8px; }
`;

export default function PrintPreviewModal({ open, onClose, html, title = 'Vista Previa' }) {
  const iframeRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (open && iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PRINTER_STYLES}</style></head><body>${html}</body></html>`);
      doc.close();
    }
  }, [open, html]);

  if (!open) return null;

  const handlePrint = () => {
    const selectedPrinter = localStorage.getItem('pp_default_printer');
    const w = window.open('', '_blank', 'width=350,height=600');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>${PRINTER_STYLES} @media print { body { width: 80mm; } }</style></head><body>${html}
<script>setTimeout(()=>{window.print();setTimeout(()=>window.close(),500)},400)<\/script>
</body></html>`);
    w.document.close();
  };

  const handleDownloadPDF = () => {
    // Use print-to-PDF via browser
    handlePrint();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-col ${fullscreen ? 'w-full h-full' : 'max-w-md w-full max-h-[90vh]'}`}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Eye className="text-indigo-600" size={20} />
            <h3 className="font-bold text-gray-800">{title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setFullscreen(f => !f)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview area - simulates 80mm thermal paper */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100 flex justify-center">
          <div className="bg-white shadow-lg border border-gray-200" style={{ width: '302px', minHeight: '400px' }}>
            <iframe
              ref={iframeRef}
              title="preview"
              className="w-full border-0"
              style={{ width: '302px', minHeight: '500px', height: 'auto' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-gray-700 hover:bg-gray-100 font-medium text-sm">
            Cerrar
          </button>
          <button onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-2.5 hover:bg-indigo-700 font-medium text-sm">
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
