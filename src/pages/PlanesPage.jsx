import { useState, useEffect } from 'react';
import { plansAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, X, Clock, Sun, Moon, Timer, DollarSign, Save, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import EmptyState from '../components/EmptyState';

const planIcons = { diurno: Sun, nocturno: Moon, '24h': Clock, hourly: Timer };
const planColors = {
  diurno: 'bg-amber-100 text-amber-700',
  nocturno: 'bg-indigo-100 text-indigo-700',
  '24h': 'bg-green-100 text-green-700',
  hourly: 'bg-cyan-100 text-cyan-700',
};

/* ─── Hourly Rates Editor (embedded in modal) ─── */
function HourlyRatesEditor({ planId }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [additionalFlat, setAdditionalFlat] = useState(false);
  const [additionalFlatRate, setAdditionalFlatRate] = useState(100);

  useEffect(() => {
    if (!planId) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await plansAPI.getHourlyRates(planId);
        const r = data.data || data || [];
        if (r.length > 0) {
          const mapped = r.map(x => ({
            hour_number: x.hour_number,
            rate: parseFloat(x.rate),
            description: x.description || '',
            is_additional_flat: x.is_additional_flat || false,
          }));
          // Detect if last rate has is_additional_flat flag
          const lastRate = mapped[mapped.length - 1];
          if (lastRate.is_additional_flat) {
            setAdditionalFlat(true);
            setAdditionalFlatRate(lastRate.rate);
          }
          setRates(mapped);
        } else {
          setRates([{ hour_number: 1, rate: 50, description: 'Primera hora', is_additional_flat: false }]);
        }
      } catch {
        setRates([{ hour_number: 1, rate: 50, description: 'Primera hora', is_additional_flat: false }]);
      } finally { setLoading(false); }
    })();
  }, [planId]);

  const updateRate = (idx, field, value) => {
    setRates(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const addRate = () => {
    const nextHour = rates.length > 0 ? Math.max(...rates.map(r => r.hour_number)) + 1 : 1;
    const lastRate = rates.length > 0 ? rates[rates.length - 1].rate : 50;
    setRates(prev => [...prev, { hour_number: nextHour, rate: lastRate, description: '', is_additional_flat: false }]);
    setDirty(true);
  };

  const removeRate = (idx) => {
    if (rates.length <= 1) { toast.warning('Debe haber al menos una tarifa'); return; }
    setRates(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!planId) { toast.error('Guarde el plan primero antes de configurar tarifas'); return; }

    // Validate no duplicate hour numbers
    const hours = rates.map(r => r.hour_number);
    if (new Set(hours).size !== hours.length) {
      toast.error('No puede haber horas duplicadas');
      return;
    }

    setSaving(true);
    try {
      // Build final rates to send
      let finalRates = rates.map(r => ({
        hour_number: r.hour_number,
        rate: r.rate,
        description: r.description,
        is_additional_flat: false,
      }));

      // If "additional flat" is enabled, mark the highest hour
      if (additionalFlat) {
        const maxHour = Math.max(...finalRates.map(r => r.hour_number));
        finalRates = finalRates.map(r =>
          r.hour_number === maxHour
            ? { ...r, rate: additionalFlatRate, is_additional_flat: true, description: r.description || `Hora ${maxHour} en adelante` }
            : r
        );
      }

      await plansAPI.updateHourlyRates(planId, finalRates);
      toast.success('Tarifas por hora guardadas correctamente');
      setDirty(false);
    } catch (err) {
      toast.error(err.message || 'Error al guardar tarifas');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-6">
      <RefreshCw size={20} className="animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Tarifas por Hora</p>
        {dirty && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle size={12} /> Sin guardar
          </span>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg border">
        <div className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b">
          <span>Hora</span>
          <span>Tarifa (RD$) <span className="text-green-600 normal-case">ITBIS incl.</span></span>
          <span>Descripción</span>
          <span></span>
        </div>
        {rates.map((rate, idx) => (
          <div key={idx} className="grid grid-cols-[60px_1fr_1fr_40px] gap-2 px-3 py-2 items-center border-b last:border-b-0">
            <input type="number" min="1"
              value={rate.hour_number}
              onChange={(e) => updateRate(idx, 'hour_number', parseInt(e.target.value) || 1)}
              className="w-full px-2 py-1.5 border rounded text-center text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="number" min="0" step="0.01"
              value={rate.rate}
              onChange={(e) => updateRate(idx, 'rate', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1.5 border rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="text"
              value={rate.description}
              onChange={(e) => updateRate(idx, 'description', e.target.value)}
              placeholder={idx === 0 ? 'Primera hora' : `Hora ${rate.hour_number}`}
              className="w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button onClick={() => removeRate(idx)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={addRate}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
          <Plus size={14} /> Agregar Tarifa
        </button>
        <div className="flex-1" />
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar Tarifas
        </button>
      </div>

      {/* Additional flat rate option */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={additionalFlat}
            onChange={(e) => { setAdditionalFlat(e.target.checked); setDirty(true); }}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-sm font-medium text-amber-800">
            Cobrar tarifa fija para horas adicionales
          </span>
        </label>
        {additionalFlat && (
          <div className="flex items-center gap-2 ml-6">
            <span className="text-sm text-amber-700">A partir de la ultima hora configurada, cobrar:</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-amber-800">RD$</span>
              <input type="number" min="0" step="0.01" value={additionalFlatRate}
                onChange={(e) => { setAdditionalFlatRate(parseFloat(e.target.value) || 0); setDirty(true); }}
                className="w-24 px-2 py-1 border border-amber-300 rounded text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none" />
              <span className="text-sm text-amber-700">por cada hora adicional</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
        <p className="text-xs text-blue-700">
          <strong>Nota:</strong> La hora con el numero mas alto aplica para esa hora y todas las siguientes.
          Ej: Si hora 3 = RD$100, las horas 3, 4, 5... se cobran a RD$100.
          {additionalFlat && ' Con la opcion de tarifa fija activada, las horas adicionales se cobran al monto indicado.'}
        </p>
      </div>
    </div>
  );
}

/* ─── Plan Modal with tabs ─── */
function PlanModal({ plan, onClose, onSave }) {
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(plan || {
    name: '', type: 'diurno', description: '', base_price: '',
    max_capacity: '', start_hour: '', end_hour: '', tolerance_minutes: 15,
    daily_entry_limit: 5, overage_hourly_rate: 100
  });
  const [saving, setSaving] = useState(false);

  const isHourly = form.type === 'hourly';
  const isEditing = !!plan?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        base_price: parseFloat(form.base_price),
        max_capacity: parseInt(form.max_capacity),
        start_hour: form.start_hour !== '' ? parseInt(form.start_hour) : null,
        end_hour: form.end_hour !== '' ? parseInt(form.end_hour) : null,
        tolerance_minutes: parseInt(form.tolerance_minutes),
        daily_entry_limit: parseInt(form.daily_entry_limit),
        overage_hourly_rate: parseFloat(form.overage_hourly_rate),
      };
      if (plan?.id) {
        await plansAPI.update(plan.id, payload);
        toast.success('Plan actualizado');
      } else {
        await plansAPI.create(payload);
        toast.success('Plan creado');
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{plan ? 'Editar Plan' : 'Nuevo Plan'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Tabs — only show if editing an hourly plan */}
        {isEditing && isHourly && (
          <div className="flex border-b px-4">
            <button onClick={() => setTab('details')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Edit2 size={14} /> Detalles
            </button>
            <button onClick={() => setTab('rates')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'rates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <DollarSign size={14} /> Tarifas por Hora
            </button>
          </div>
        )}

        {/* Details tab */}
        {tab === 'details' && (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input value={form.name} onChange={set('name')} required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.type} onChange={set('type')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="diurno">Diurno</option>
                  <option value="nocturno">Nocturno</option>
                  <option value="24h">24 Horas</option>
                  <option value="hourly">Por Hora</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea value={form.description || ''} onChange={set('description')} rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (RD$) <span className="text-xs text-green-600 font-normal">ITBIS incluido</span></label>
                <input type="number" value={form.base_price} onChange={set('base_price')} required step="0.01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                {form.base_price > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Subtotal: RD$ {(parseFloat(form.base_price) / 1.18).toFixed(2)} + ITBIS: RD$ {(parseFloat(form.base_price) - parseFloat(form.base_price) / 1.18).toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad Max</label>
                <input type="number" value={form.max_capacity} onChange={set('max_capacity')} required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>

            {(form.type === 'diurno' || form.type === 'nocturno') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Inicio</label>
                  <input type="number" min="0" max="23" value={form.start_hour || ''} onChange={set('start_hour')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fin</label>
                  <input type="number" min="0" max="23" value={form.end_hour || ''} onChange={set('end_hour')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tolerancia (min)</label>
                <input type="number" value={form.tolerance_minutes} onChange={set('tolerance_minutes')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entradas/dia</label>
                <input type="number" value={form.daily_entry_limit} onChange={set('daily_entry_limit')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exceso/h (RD$) <span className="text-xs text-green-600 font-normal">ITBIS incl.</span></label>
                <input type="number" value={form.overage_hourly_rate} onChange={set('overage_hourly_rate')} step="0.01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>

            {/* Hint to go to rates tab for hourly plans */}
            {isHourly && isEditing && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 flex items-center gap-2 cursor-pointer hover:bg-cyan-100 transition-colors"
                onClick={() => setTab('rates')}>
                <DollarSign size={16} className="text-cyan-600" />
                <div>
                  <p className="text-sm font-medium text-cyan-800">Configurar Tarifas por Hora</p>
                  <p className="text-xs text-cyan-600">Haga clic aqui o en la pestaña "Tarifas por Hora" para editar las tarifas escalonadas</p>
                </div>
              </div>
            )}
            {isHourly && !isEditing && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <p className="text-xs text-amber-700">Guarde el plan primero, luego podra configurar las tarifas por hora desde la pestaña de tarifas.</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Rates tab */}
        {tab === 'rates' && isEditing && isHourly && (
          <div className="p-4">
            <HourlyRatesEditor planId={plan.id} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanesPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchPlans = async () => {
    try {
      const { data } = await plansAPI.list();
      setPlans(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Desactivar este plan?')) return;
    try {
      await plansAPI.delete(id);
      toast.success('Plan desactivado');
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al desactivar');
    }
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Planes</h2>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Nuevo Plan
        </button>
      </div>

      {plans.length === 0 && !loading ? (
        <EmptyState icon={Layers} title="No hay planes configurados" description="Cree su primer plan de parqueo para definir tarifas y espacios." actionLabel="Crear Plan" onAction={() => { setEditing(null); setShowModal(true); }} />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const Icon = planIcons[plan.type] || Clock;
          const colorClass = planColors[plan.type] || 'bg-gray-100 text-gray-700';
          const pct = plan.max_capacity > 0 ? Math.round((plan.current_occupancy / plan.max_capacity) * 100) : 0;

          return (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm p-5 card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                  <Icon size={20} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(plan); setShowModal(true); }}
                    className="p-1 text-gray-400 hover:text-indigo-600"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(plan.id)}
                    className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800">{plan.name}</h3>
              <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
              <div className="mb-3">
                <div className="text-xl font-bold text-indigo-600">
                  RD$ {parseFloat(plan.base_price).toLocaleString()}
                  <span className="text-xs font-normal text-gray-400">
                    {plan.type === 'hourly' ? '/hora' : '/mes'}
                  </span>
                </div>
                {plan.tax_breakdown && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Subtotal: RD$ {plan.tax_breakdown.subtotal?.toLocaleString()} + ITBIS: RD$ {plan.tax_breakdown.tax_amount?.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400">
                {plan.current_occupancy}/{plan.max_capacity} ocupados ({pct}%)
              </p>
              {plan.start_hour != null && (
                <p className="text-xs text-gray-400 mt-1">
                  Horario: {plan.start_hour}:00 - {plan.end_hour}:00
                </p>
              )}
            </div>
          );
        })}
      </div>
      )}

      {showModal && (
        <PlanModal
          plan={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); fetchPlans(); }}
        />
      )}
    </div>
  );
}
