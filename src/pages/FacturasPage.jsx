import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FileText, Search, Printer, RefreshCw, X, Eye } from 'lucide-react';
import { invoicesAPI } from '../services/api';
import PrintPreviewModal from '../components/PrintPreviewModal';

const fmtMoney = (v) => { const p = Number(v || 0).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `RD$ ${p.join('.')}`; };
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo' }) : '-';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

function getItems(inv) {
  if (!inv.items) return [];
  if (Array.isArray(inv.items)) return inv.items;
  if (typeof inv.items === 'string') {
    try { return JSON.parse(inv.items); } catch { return []; }
  }
  return [];
}

function getCompanyInfo() {
  try {
    const s = JSON.parse(localStorage.getItem('pp_settings') || '{}');
    return {
      name: s.business_name || s.parking_name || 'ParkingPro',
      address: s.business_address || '',
      rnc: s.business_rnc || '',
      phone: s.business_phone || '',
    };
  } catch { return { name: 'ParkingPro', address: '', rnc: '', phone: '' }; }
}

function buildInvoiceHtml(inv) {
  const items = getItems(inv);
  const co = getCompanyInfo();
  return `
    <div class="center bold big mb">${co.name}</div>
    ${co.address ? `<div class="center small">${co.address}</div>` : ''}
    ${co.rnc ? `<div class="center small">RNC: ${co.rnc}</div>` : ''}
    ${co.phone ? `<div class="center small">Tel: ${co.phone}</div>` : ''}
    <div class="center mb" style="margin-top:6px">FACTURA DE VENTA</div>
    <div class="line"></div>
    <div class="row"><span>No.:</span><span class="bold">#${inv.invoice_number}</span></div>
    <div class="row"><span>NCF:</span><span>${inv.ncf || '-'}</span></div>
    <div class="row"><span>Fecha:</span><span>${fmtDateTime(inv.created_at)}</span></div>
    <div class="line"></div>
    <div class="bold">Cliente: ${inv.customer_name || 'N/A'}</div>
    ${inv.rnc ? `<div>RNC Cliente: ${inv.rnc}</div>` : ''}
    <div class="line"></div>
    <div class="bold small mb" style="text-decoration:underline">DETALLE</div>
    ${items.map(item => `
      <div style="margin-bottom:4px;">
        <div>${item.description}</div>
        <div class="row"><span>${item.quantity || 1} x ${fmtMoney(item.unit_price || item.amount)}</span><span>${fmtMoney(item.amount || item.subtotal)}</span></div>
      </div>
    `).join('')}
    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>${fmtMoney(inv.subtotal)}</span></div>
    <div class="row"><span>ITBIS (18%):</span><span>${fmtMoney(inv.tax_amount)}</span></div>
    <div class="line"></div>
    <div class="row bold big"><span>TOTAL:</span><span>${fmtMoney(inv.total)}</span></div>
    <div class="line"></div>
    <div class="center small mt">Gracias por su preferencia</div>
    <div class="center small mt">${fmtDateTime(new Date().toISOString())}</div>
  `;
}

export default function FacturasPage() {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selected, setSelected] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, statsRes] = await Promise.all([
        invoicesAPI.list({ limit: 100 }),
        invoicesAPI.stats(),
      ]);
      const allInvoices = invRes.data.data || [];
      setStats(statsRes.data.data);

      // Client-side filtering
      let filtered = allInvoices;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(inv =>
          (inv.invoice_number || '').toLowerCase().includes(q) ||
          (inv.ncf || '').toLowerCase().includes(q) ||
          (inv.customer_name || '').toLowerCase().includes(q)
        );
      }
      if (startDate) {
        filtered = filtered.filter(inv => inv.created_at >= startDate);
      }
      if (endDate) {
        const end = endDate + 'T23:59:59';
        filtered = filtered.filter(inv => inv.created_at <= end);
      }
      setInvoices(filtered);
    } catch {
      toast.error('Error cargando facturas');
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = stats ? [
    { label: 'Facturas emitidas', value: stats.total_invoices, fmt: v => v, color: 'blue' },
    { label: 'Ingresos facturados', value: stats.total_revenue, fmt: fmtMoney, color: 'green' },
    { label: 'ITBIS recaudado', value: stats.total_tax, fmt: fmtMoney, color: 'indigo' },
    { label: 'Notas de crédito', value: stats.total_refunds, fmt: fmtMoney, color: 'orange' },
  ] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileText size={24} />Facturación</h1>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">
          <RefreshCw size={16} />Actualizar
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(({ label, value, fmt, color }) => {
            const c = colorMap[color] || colorMap.blue;
            return (
              <div key={label} className="rounded-lg p-4 border"
                style={{ backgroundColor: c.bg, borderColor: c.border }}>
                <p className="text-xs font-medium uppercase" style={{ color: c.text }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: c.value }}>{fmt(value)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Buscar por N° o cliente..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['N° Factura', 'NCF', 'Cliente', 'Subtotal', 'ITBIS', 'Total', 'Fecha', 'Acciones'].map(h => (
                  <th key={h} className="py-3 px-4 text-left text-sm text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0
                ? <tr><td colSpan={8} className="text-center text-gray-400 py-8">No hay facturas</td></tr>
                : invoices.map(inv => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(inv)}
                        className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                        #{inv.invoice_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{inv.ncf || '-'}</td>
                    <td className="px-4 py-3">{inv.customer_name || 'N/A'}</td>
                    <td className="px-4 py-3">{fmtMoney(inv.subtotal)}</td>
                    <td className="px-4 py-3">{fmtMoney(inv.tax_amount)}</td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(inv.total)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(inv.created_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPrintInvoice(inv)}
                        className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 text-xs">
                        <Printer size={12} /> Imprimir
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Eye size={18} className="text-indigo-600" />
                Factura #{selected.invoice_number}
              </h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-xs text-indigo-500 font-medium">NCF</p>
                <p className="font-mono font-bold text-indigo-700">{selected.ncf || '-'}</p>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Cliente:</span><span className="font-medium">{selected.customer_name || 'N/A'}</span></div>
                {selected.rnc && <div className="flex justify-between"><span className="text-gray-500">RNC:</span><span>{selected.rnc}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Fecha:</span><span>{fmtDateTime(selected.created_at)}</span></div>
              </div>

              <hr />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Detalle</p>
                {getItems(selected).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                    <div>
                      <p>{item.description}</p>
                      <p className="text-xs text-gray-400">{item.quantity || 1} x {fmtMoney(item.unit_price || item.amount)}</p>
                    </div>
                    <span className="font-medium">{fmtMoney(item.amount || item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <hr />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>{fmtMoney(selected.subtotal)}</span></div>
                <div className="flex justify-between"><span>ITBIS (18%):</span><span>{fmtMoney(selected.tax_amount)}</span></div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>TOTAL:</span><span className="text-green-600">{fmtMoney(selected.total)}</span></div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setSelected(null)} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-gray-700 hover:bg-gray-50 font-medium text-sm">Cerrar</button>
              <button onClick={() => { setPrintInvoice(selected); }}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 flex items-center justify-center gap-2 hover:bg-indigo-700 font-medium text-sm">
                <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview */}
      <PrintPreviewModal
        open={!!printInvoice}
        onClose={() => setPrintInvoice(null)}
        html={printInvoice ? buildInvoiceHtml(printInvoice) : ''}
        title={printInvoice ? `Factura #${printInvoice.invoice_number}` : 'Factura'}
      />
    </div>
  );
}

const colorMap = {
  blue:   { text: '#2563eb', value: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  green:  { text: '#16a34a', value: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  indigo: { text: '#4f46e5', value: '#3730a3', bg: '#eef2ff', border: '#c7d2fe' },
  orange: { text: '#ea580c', value: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
};
