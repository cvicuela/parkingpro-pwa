import { useState, useEffect } from 'react';
import { customersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import EmptyState from '../components/EmptyState';
import { Plus, Search, Edit2, Trash2, X, Building2, User, History, Printer, Car, CreditCard, FileText, Clock } from 'lucide-react';
import PrintPreviewModal from '../components/PrintPreviewModal';
import Pagination from '../components/Pagination';

const GENERIC_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState(customer || {
    first_name: '', last_name: '', id_document: '', phone: '', email: '',
    is_company: false, company_name: '', rnc: '', address: '', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (customer?.id) {
        await customersAPI.update(customer.id, form);
        toast.success('Cliente actualizado');
      } else {
        await customersAPI.create({ ...form, password: password || undefined });
        toast.success('Cliente creado');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={form.first_name} onChange={set('first_name')} required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input value={form.last_name} onChange={set('last_name')} required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Documento de Identidad</label>
            <input value={form.id_document || ''} onChange={set('id_document')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input value={form.address || ''} onChange={set('address')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_company} onChange={set('is_company')}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-gray-700">Es empresa</span>
          </label>

          {form.is_company && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                <input value={form.company_name || ''} onChange={set('company_name')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RNC</label>
                <input value={form.rnc || ''} onChange={set('rnc')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={form.notes || ''} onChange={set('notes')} rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fmtDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateTime = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtMoney = (n) => { if (n == null) return '-'; const p = Number(n).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `RD$ ${p.join('.')}`; };

const statusLabel = (s) => {
  const map = { active: 'Activa', paid: 'Pagado', closed: 'Cerrada', abandoned: 'Abandonada', pending: 'Pendiente', cancelled: 'Cancelada', suspended: 'Suspendida', past_due: 'Vencida', refunded: 'Reembolsado' };
  return map[s] || s || '-';
};
const statusColor = (s) => {
  const map = { active: 'bg-green-100 text-green-700', paid: 'bg-blue-100 text-blue-700', closed: 'bg-gray-100 text-gray-700', abandoned: 'bg-amber-100 text-amber-700', pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700', suspended: 'bg-orange-100 text-orange-700', past_due: 'bg-red-100 text-red-700' };
  return map[s] || 'bg-gray-100 text-gray-700';
};

function CustomerHistoryModal({ customer, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('sessions');
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await customersAPI.history(customer.id);
        setData(res.data.data || res.data);
      } catch (err) {
        toast.error('Error al cargar historial');
      } finally {
        setLoading(false);
      }
    })();
  }, [customer.id]);

  const isGeneric = customer.id === GENERIC_CUSTOMER_ID;

  const buildPrintHtml = () => {
    if (!data) return '';
    const name = isGeneric ? 'Cliente Genérico (Visitantes)' : `${data.customer.first_name} ${data.customer.last_name}`;
    let html = `
      <div class="center bold big mb">Historial de Cliente</div>
      <div class="line"></div>
      <div class="bold">${name}</div>
      ${data.customer.id_document ? `<div>Doc: ${data.customer.id_document}</div>` : ''}
      ${data.customer.company_name ? `<div>Empresa: ${data.customer.company_name}</div>` : ''}
      <div class="line"></div>
      <div class="row"><span>Total Sesiones:</span><span class="bold">${data.totals.total_sessions}</span></div>
      <div class="row"><span>Total Pagado:</span><span class="bold">${fmtMoney(data.totals.total_paid)}</span></div>
      <div class="line"></div>
    `;

    if (data.sessions.length > 0) {
      html += `<div class="bold mt mb">Sesiones de Parqueo</div>`;
      data.sessions.slice(0, 20).forEach(s => {
        html += `
          <div class="small" style="margin-bottom:4px; border-bottom:1px dotted #ccc; padding-bottom:3px;">
            <div class="row"><span>${s.vehicle_plate}</span><span>${statusLabel(s.status || 'active')}</span></div>
            <div>Entrada: ${fmtDateTime(s.entry_time)}</div>
            ${s.exit_time ? `<div>Salida: ${fmtDateTime(s.exit_time)}</div>` : ''}
            ${s.paid_amount ? `<div>Monto: ${fmtMoney(s.paid_amount)}</div>` : ''}
          </div>
        `;
      });
    }

    if (data.payments.length > 0) {
      html += `<div class="line"></div><div class="bold mt mb">Pagos</div>`;
      data.payments.slice(0, 20).forEach(p => {
        html += `
          <div class="small" style="margin-bottom:4px; border-bottom:1px dotted #ccc; padding-bottom:3px;">
            <div class="row"><span>${fmtMoney(p.total_amount)}</span><span>${statusLabel(p.status)}</span></div>
            <div>${fmtDateTime(p.paid_at || p.created_at)}</div>
          </div>
        `;
      });
    }

    html += `<div class="line"></div><div class="center small mt">Impreso: ${fmtDateTime(new Date().toISOString())}</div>`;
    return html;
  };

  const tabs = [
    { id: 'sessions', label: 'Sesiones', icon: Car, count: data?.sessions?.length },
    { id: 'payments', label: 'Pagos', icon: CreditCard, count: data?.payments?.length },
    { id: 'subscriptions', label: 'Suscripciones', icon: FileText, count: data?.subscriptions?.length },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History size={20} className="text-indigo-600" />
                Historial de {isGeneric ? 'Visitantes' : `${customer.first_name} ${customer.last_name}`}
              </h3>
              {isGeneric && <p className="text-xs text-gray-500 mt-0.5">Todos los vehículos sin suscripción registrada</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPrintOpen(true)} disabled={!data}
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-30"
                title="Imprimir historial">
                <Printer size={18} />
              </button>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : !data ? (
            <p className="p-8 text-center text-gray-400">No se pudo cargar el historial</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50">
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-gray-500">Total Sesiones</p>
                  <p className="text-xl font-bold text-gray-800">{data.totals.total_sessions}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-gray-500">Total Pagado</p>
                  <p className="text-xl font-bold text-green-600">{fmtMoney(data.totals.total_paid)}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b px-4">
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    <t.icon size={14} />
                    {t.label}
                    {t.count > 0 && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: '400px' }}>
                {tab === 'sessions' && (
                  data.sessions.length === 0 ? <p className="text-center text-gray-400 py-6">Sin sesiones registradas</p> :
                  data.sessions.map(s => (
                    <div key={s.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car size={14} className="text-gray-400" />
                          <span className="font-mono font-bold text-sm">{s.vehicle_plate}</span>
                          {s.plan_name && <span className="text-xs text-gray-400">({s.plan_name})</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(s.status || 'active')}`}>
                          {statusLabel(s.status || 'active')}
                        </span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1"><Clock size={10} /> Entrada: {fmtDateTime(s.entry_time)}</div>
                        {s.exit_time && <div>Salida: {fmtDateTime(s.exit_time)}</div>}
                        {s.duration_minutes && <div>Duración: {s.duration_minutes} min</div>}
                        {s.paid_amount != null && <div>Pagado: {fmtMoney(s.paid_amount)}</div>}
                      </div>
                    </div>
                  ))
                )}

                {tab === 'payments' && (
                  data.payments.length === 0 ? <p className="text-center text-gray-400 py-6">Sin pagos registrados</p> :
                  data.payments.map(p => (
                    <div key={p.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{fmtMoney(p.total_amount)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
                        <span>{fmtDateTime(p.paid_at || p.created_at)}</span>
                        {p.payment_method && <span className="capitalize">{p.payment_method}</span>}
                      </div>
                    </div>
                  ))
                )}

                {tab === 'subscriptions' && (
                  data.subscriptions.length === 0 ? <p className="text-center text-gray-400 py-6">Sin suscripciones</p> :
                  data.subscriptions.map(s => (
                    <div key={s.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm">{s.plan_name || 'Plan'}</span>
                          {s.vehicle_plate && <span className="ml-2 text-xs font-mono text-gray-500">{s.vehicle_plate}</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(s.status)}`}>
                          {statusLabel(s.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
                        <span>{fmtMoney(s.price_per_period)}/{s.billing_frequency === 'monthly' ? 'mes' : s.billing_frequency === 'quarterly' ? 'trim' : s.billing_frequency === 'semiannual' ? 'sem' : s.billing_frequency === 'annual' ? 'anual' : 'mes'}</span>
                        {s.current_period_end && <span>Vence: {fmtDate(s.current_period_end)}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        html={buildPrintHtml()}
        title="Historial de Cliente"
      />
    </>
  );
}

export default function ClientesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchCustomers = async () => {
    try {
      const { data } = await customersAPI.list({ search });
      setCustomers(data.data || data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); fetchCustomers(); }, [search]);

  const handleDelete = async (id) => {
    if (id === GENERIC_CUSTOMER_ID) {
      toast.warning('No se puede eliminar el cliente genérico');
      return;
    }
    if (!confirm('Eliminar este cliente?')) return;
    try {
      await customersAPI.delete(id);
      toast.success('Cliente eliminado');
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const isGeneric = (c) => c.id === GENERIC_CUSTOMER_ID;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Clientes</h2>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, documento o empresa..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="No se encontraron clientes" description="Agregue su primer cliente para comenzar a gestionar suscripciones." actionLabel="Nuevo Cliente" onAction={() => { setEditing(null); setShowModal(true); }} />
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => (
                  <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isGeneric(c) ? 'bg-amber-50/50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isGeneric(c) ? <User size={16} className="text-amber-500" /> :
                          c.is_company ? <Building2 size={16} className="text-blue-500" /> : <User size={16} className="text-gray-400" />}
                        <div>
                          <p className="font-medium">
                            {c.first_name} {c.last_name}
                            {isGeneric(c) && <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Visitantes</span>}
                          </p>
                          {c.company_name && <p className="text-xs text-gray-400">{c.company_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{c.id_document || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isGeneric(c) ? 'bg-amber-100 text-amber-700' :
                        c.is_company ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {isGeneric(c) ? 'Genérico' : c.is_company ? 'Empresa' : 'Personal'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {fmtDate(c.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setHistoryCustomer(c)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Ver historial">
                          <History size={16} />
                        </button>
                        {!isGeneric(c) && (
                          <>
                            <button onClick={() => { setEditing(c); setShowModal(true); }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                              <Edit2 size={16} />
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDelete(c.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalItems={customers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {showModal && (
        <CustomerModal
          customer={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); fetchCustomers(); }}
        />
      )}

      {historyCustomer && (
        <CustomerHistoryModal
          customer={historyCustomer}
          onClose={() => setHistoryCustomer(null)}
        />
      )}
    </div>
  );
}
