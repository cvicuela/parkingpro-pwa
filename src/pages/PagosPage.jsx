import { useState, useEffect, useCallback } from 'react';
import { paymentsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Search, RotateCcw, DollarSign, CheckCircle, XCircle, Clock, FileText, RefreshCw, X } from 'lucide-react';

const fmtMoney = (v) => { const p = Number(v || 0).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `RD$ ${p.join('.')}`; };

const statusConfig = {
  paid: { icon: CheckCircle, label: 'Pagado', class: 'bg-green-100 text-green-700' },
  pending: { icon: Clock, label: 'Pendiente', class: 'bg-yellow-100 text-yellow-700' },
  failed: { icon: XCircle, label: 'Fallido', class: 'bg-red-100 text-red-700' },
  refunded: { icon: RotateCcw, label: 'Reembolsado', class: 'bg-gray-100 text-gray-700' },
};

export default function PagosPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refundModal, setRefundModal] = useState(null); // { id } of payment being refunded
  const [refundReason, setRefundReason] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await paymentsAPI.list(params);
      setPayments(data.data || data || []);
    } catch {} finally { setLoading(false); }
  }, [search, statusFilter, startDate, endDate]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const openRefundModal = (id) => {
    setRefundReason('');
    setRefundModal({ id });
  };

  const handleRefund = async () => {
    if (!refundModal) return;
    if (!refundReason.trim()) {
      toast.warning('Debe ingresar un motivo para el reembolso');
      return;
    }
    try {
      await paymentsAPI.refund(refundModal.id, refundReason.trim());
      toast.success('Pago reembolsado y nota de crédito generada');
      setRefundModal(null);
      setRefundReason('');
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al reembolsar');
    }
  };

  const totalRevenue = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  const totalRefunded = payments
    .filter(p => p.status === 'refunded')
    .reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Pagos</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
            <DollarSign size={18} className="text-green-600" />
            <span className="text-sm text-green-600">Cobrado:</span>
            <span className="font-bold text-green-700">{fmtMoney(totalRevenue)}</span>
          </div>
          {totalRefunded > 0 && (
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
              <RotateCcw size={14} className="text-gray-500" />
              <span className="text-sm text-gray-500">Reembolsado: {fmtMoney(totalRefunded)}</span>
            </div>
          )}
          <button onClick={fetchPayments} className="p-2 border rounded-lg text-gray-500 hover:bg-gray-50">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente o método..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">Todos los estados</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
          <option value="refunded">Reembolsado</option>
          <option value="failed">Fallido</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : payments.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No se encontraron pagos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">NCF</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const config = statusConfig[p.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(p.created_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Santo_Domingo' })}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-800">{p.customer_name || 'Sin cliente'}</td>
                      <td className="py-3 px-4 font-semibold">{fmtMoney(p.total_amount)}</td>
                      <td className="py-3 px-4 text-sm capitalize">{p.payment_method || '-'}</td>
                      <td className="py-3 px-4 text-xs font-mono text-gray-500">
                        {p.ncf ? (
                          <span className="flex items-center gap-1"><FileText size={12} />{p.ncf}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${config.class}`}>
                          <StatusIcon size={12} /> {config.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.status === 'paid' && (
                          <button onClick={() => openRefundModal(p.id)}
                            className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                            Reembolsar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Refund Reason Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRefundModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Motivo del Reembolso</h3>
              <button onClick={() => setRefundModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-500">Ingrese el motivo del reembolso. Este campo es obligatorio.</p>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ej: Cliente solicita reembolso por error en cobro..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                autoFocus
              />
              <div className="flex gap-3 pt-1">
                <button onClick={() => setRefundModal(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleRefund} disabled={!refundReason.trim()}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <RotateCcw size={16} /> Reembolsar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
