import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscriptionsAPI, customersAPI, vehiclesAPI, plansAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Plus, Search, X, Pause, Play, Trash2, AlertTriangle, Eye, FileText, User, Phone, Mail, Car, CreditCard, Calendar, Building2, ExternalLink } from 'lucide-react';

const statusBadge = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  past_due: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabel = {
  active: 'Activa',
  pending: 'Pendiente',
  past_due: 'Vencida',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

const billingLabel = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const fmtMoney = (v) => v != null ? `RD$ ${parseFloat(v).toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : '-';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo' }) : '-';

/* ─── Customer Detail Popup ─── */
function CustomerDetailPopup({ subscription, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cid = subscription.customer_id;
    if (!cid) { setLoading(false); return; }
    customersAPI.history(cid)
      .then(({ data }) => {
        const d = data.data || data;
        setCustomer(d.customer || null);
        setHistory(d);
      })
      .catch(() => toast.error('Error al cargar datos del cliente'))
      .finally(() => setLoading(false));
  }, [subscription.customer_id]);

  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User size={20} className="text-indigo-600" />
            Detalle del Cliente
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : !customer ? (
          <p className="p-8 text-center text-gray-400">No se pudo cargar la informacion</p>
        ) : (
          <div className="overflow-y-auto flex-1">
            {/* Customer Info Card */}
            <div className="p-4 bg-gray-50 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User size={24} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">{customer.first_name} {customer.last_name}</p>
                  {customer.company_name && (
                    <p className="text-sm text-gray-500 flex items-center gap-1"><Building2 size={12} /> {customer.company_name}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {customer.id_document && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <FileText size={13} className="text-gray-400" /> {customer.id_document}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Phone size={13} className="text-gray-400" /> {customer.phone}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 col-span-2">
                    <Mail size={13} className="text-gray-400" /> {customer.email}
                  </div>
                )}
                {customer.rnc && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Building2 size={13} className="text-gray-400" /> RNC: {customer.rnc}
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Info */}
            <div className="p-4 border-b space-y-2">
              <p className="text-sm font-semibold text-gray-700">Suscripcion Actual</p>
              <div className="bg-indigo-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{subscription.plan_name || '-'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[subscription.status] || 'bg-gray-100'}`}>
                    {statusLabel[subscription.status] || subscription.status}
                  </span>
                </div>
                {subscription.vehicle_plate && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Car size={13} /> Placa: <span className="font-mono font-bold">{subscription.vehicle_plate}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <CreditCard size={13} /> Precio: {fmtMoney(subscription.price_per_period)}
                  <span className="text-gray-400">/ {billingLabel[subscription.billing_frequency] || subscription.billing_frequency || 'mes'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Calendar size={13} /> Proxima factura: {fmtDate(subscription.next_billing_date)}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            {history?.totals && (
              <div className="grid grid-cols-3 gap-3 p-4 border-b">
                <div className="bg-white border rounded-lg p-2.5 text-center">
                  <p className="text-xs text-gray-500">Sesiones</p>
                  <p className="text-lg font-bold text-gray-800">{history.totals.total_sessions || 0}</p>
                </div>
                <div className="bg-white border rounded-lg p-2.5 text-center">
                  <p className="text-xs text-gray-500">Pagado</p>
                  <p className="text-lg font-bold text-green-600">{fmtMoney(history.totals.total_paid || 0)}</p>
                </div>
                <div className="bg-white border rounded-lg p-2.5 text-center">
                  <p className="text-xs text-gray-500">Suscripciones</p>
                  <p className="text-lg font-bold text-indigo-600">{history.subscriptions?.length || 0}</p>
                </div>
              </div>
            )}

            {/* Recent Payments */}
            {history?.payments?.length > 0 && (
              <div className="p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Ultimos Pagos</p>
                {history.payments.slice(0, 5).map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">{fmtMoney(p.total_amount)}</span>
                      <span className="text-xs text-gray-500 ml-2">{fmtDate(p.paid_at || p.created_at)}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[p.status] || 'bg-gray-100'}`}>
                      {p.status === 'completed' ? 'Pagado' : p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t flex gap-2">
          <button onClick={() => { onClose(); navigate('/facturas'); }}
            className="flex-1 py-2 text-sm border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-1.5">
            <FileText size={14} /> Ver Facturas
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── New/Edit Subscription Modal ─── */
function SubscriptionModal({ subscription, onClose, onSave }) {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(subscription || {
    customer_id: '', vehicle_id: '', plan_id: '', billing_frequency: 'monthly'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      customersAPI.list().then(({ data }) => setCustomers(data.data || data || [])),
      vehiclesAPI.list().then(({ data }) => setVehicles(data.data || data || [])),
      plansAPI.list().then(({ data }) => setPlans(data.data || data || []))
    ]).catch(() => {});
  }, []);

  // When a customer is selected, auto-filter vehicles
  const filteredVehicles = useMemo(
    () => form.customer_id ? vehicles.filter(v => v.customer_id === form.customer_id) : vehicles,
    [form.customer_id, vehicles]
  );

  // Selected plan info for dynamic pricing display
  const selectedPlan = useMemo(
    () => plans.find(p => p.id === form.plan_id),
    [form.plan_id, plans]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, vehicle_id: (form.vehicle_id && form.vehicle_id !== 'na') ? form.vehicle_id : null };
      if (subscription?.id) {
        await subscriptionsAPI.update(subscription.id, payload);
        toast.success('Suscripcion actualizada');
      } else {
        await subscriptionsAPI.create(payload);
        toast.success('Suscripcion creada');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{subscription ? 'Editar Suscripcion' : 'Nueva Suscripcion'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select value={form.customer_id} onChange={set('customer_id')} required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Seleccionar...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehiculo</label>
            <select value={form.vehicle_id || ''} onChange={set('vehicle_id')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              size={Math.min(filteredVehicles.length + 2, 6)}>
              <option value="">Seleccionar...</option>
              <option value="na">No aplica</option>
              {filteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</option>
              ))}
            </select>
            {form.customer_id && filteredVehicles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Este cliente no tiene vehiculos registrados</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select value={form.plan_id} onChange={set('plan_id')} required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Seleccionar...</option>
              {plans.filter(p => p.type !== 'hourly').map((p) => (
                <option key={p.id} value={p.id}>{p.name} - RD$ {parseFloat(p.base_price).toLocaleString()}/mes</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia de Pago</label>
            <select value={form.billing_frequency} onChange={set('billing_frequency')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="semiannual">Semestral</option>
              <option value="annual">Anual</option>
            </select>
            {selectedPlan && (
              <p className="text-xs text-gray-500 mt-1">
                {form.billing_frequency === 'monthly' && `Cobro: ${fmtMoney(selectedPlan.base_price)} cada mes`}
                {form.billing_frequency === 'quarterly' && `Cobro: ${fmtMoney(selectedPlan.base_price * 3)} cada 3 meses`}
                {form.billing_frequency === 'semiannual' && `Cobro: ${fmtMoney(selectedPlan.base_price * 6)} cada 6 meses`}
                {form.billing_frequency === 'annual' && `Cobro: ${fmtMoney(selectedPlan.base_price * 12)} cada 12 meses`}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
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

/* ─── Main Page ─── */
export default function SuscripcionesPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [detailSub, setDetailSub] = useState(null);

  const navigate = useNavigate();

  const fetchSubs = async () => {
    try {
      const { data } = await subscriptionsAPI.list({ search });
      setSubs(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchSubs(); }, [search]);

  const handleSuspend = async (id) => {
    try {
      await subscriptionsAPI.suspend(id);
      toast.success('Suscripcion suspendida');
      fetchSubs();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleReactivate = async (id) => {
    try {
      await subscriptionsAPI.reactivate(id);
      toast.success('Suscripcion reactivada');
      fetchSubs();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const openCancelModal = (id) => {
    setCancelReason('');
    setCancelModal({ id });
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    if (!cancelReason.trim()) {
      toast.warning('Debe ingresar un motivo para la cancelacion');
      return;
    }
    try {
      await subscriptionsAPI.cancel(cancelModal.id, cancelReason.trim());
      toast.success('Suscripcion cancelada');
      setCancelModal(null);
      setCancelReason('');
      fetchSubs();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Suscripciones</h2>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Nueva Suscripcion
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o placa..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : subs.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No se encontraron suscripciones</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Placa</th>
                  <th className="py-3 px-4">Freq. Pago</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Proxima Factura</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setDetailSub(s)}
                        className="text-left font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                        title="Ver detalle del cliente"
                      >
                        {s.customer_name || `${s.customer?.first_name || ''} ${s.customer?.last_name || ''}`}
                        <Eye size={13} className="text-gray-400" />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm">{s.plan_name || s.plan?.name || '-'}</td>
                    <td className="py-3 px-4 font-mono text-sm">{s.vehicle_plate || s.vehicle?.plate || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {billingLabel[s.billing_frequency] || s.billing_frequency || 'Mensual'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[s.status] || 'bg-gray-100'}`}>
                        {statusLabel[s.status] || s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {s.next_billing_date ? (
                        <button
                          onClick={() => navigate('/facturas')}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                          title="Ir a Facturas"
                        >
                          {fmtDate(s.next_billing_date)}
                          <ExternalLink size={11} />
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setDetailSub(s)} title="Ver detalle"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Eye size={14} /></button>
                        {s.status === 'active' && (
                          <button onClick={() => handleSuspend(s.id)} title="Suspender"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"><Pause size={14} /></button>
                        )}
                        {(s.status === 'suspended' || s.status === 'past_due') && (
                          <button onClick={() => handleReactivate(s.id)} title="Reactivar"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"><Play size={14} /></button>
                        )}
                        {s.status !== 'cancelled' && (
                          <button onClick={() => openCancelModal(s.id)} title="Cancelar"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <SubscriptionModal
          subscription={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); fetchSubs(); }}
        />
      )}

      {/* Customer Detail Popup */}
      {detailSub && (
        <CustomerDetailPopup
          subscription={detailSub}
          onClose={() => setDetailSub(null)}
        />
      )}

      {/* Cancel Reason Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCancelModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" /> Cancelar Suscripcion
              </h3>
              <button onClick={() => setCancelModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-500">Ingrese el motivo de la cancelacion. Este campo es obligatorio.</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: Cliente solicita cancelacion por cambio de plan..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                autoFocus
              />
              <div className="flex gap-3 pt-1">
                <button onClick={() => setCancelModal(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Volver
                </button>
                <button onClick={handleCancel} disabled={!cancelReason.trim()}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Confirmar Cancelacion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
