import { useState, useEffect, useMemo } from 'react';
import { discountsAPI, plansAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tag, Plus, Search, X, Edit2, Trash2, Percent, DollarSign, Calendar } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { fmtMoney } from '../utils/formatters';

const PAGE_SIZE = 15;

const typeLabels = { percentage: 'Porcentaje', fixed_amount: 'Monto fijo' };
const appliesToLabels = { global: 'Global', plan: 'Plan', subscription: 'Suscripción' };

/* ─── Create / Edit Modal ─── */
function DiscountModal({ discount, plans, onClose, onSave }) {
  const [form, setForm] = useState(discount || {
    name: '', description: '', type: 'percentage', value: '',
    applies_to: 'global', plan_id: '', min_months: 1, max_uses: '',
    valid_from: '', valid_until: '', is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [field]: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    if (!form.value || Number(form.value) <= 0) { toast.error('El valor debe ser mayor a 0'); return; }
    if (form.type === 'percentage' && Number(form.value) > 100) { toast.error('El porcentaje no puede ser mayor a 100'); return; }
    if (form.applies_to === 'plan' && !form.plan_id) { toast.error('Debe seleccionar un plan'); return; }
    if (!form.valid_from) { toast.error('La fecha de inicio es requerida'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        type: form.type,
        value: parseFloat(form.value),
        applies_to: form.applies_to,
        plan_id: form.applies_to === 'plan' ? form.plan_id : null,
        min_months: parseInt(form.min_months) || 1,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        valid_from: form.valid_from,
        valid_until: form.valid_until || null,
        is_active: form.is_active,
      };

      if (discount?.id) {
        await discountsAPI.update(discount.id, payload);
        toast.success('Descuento actualizado');
      } else {
        await discountsAPI.create(payload);
        toast.success('Descuento creado');
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Error al guardar descuento');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{discount ? 'Editar Descuento' : 'Nuevo Descuento'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={form.name} onChange={set('name')} required placeholder="Ej: Descuento Fidelidad"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.description || ''} onChange={set('description')} rows={2}
              placeholder="Descripción opcional del descuento"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.type} onChange={set('type')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed_amount">Monto fijo (RD$)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <div className="relative">
                {form.type === 'fixed_amount' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">RD$</span>
                )}
                <input type="number" min="0" step={form.type === 'percentage' ? '1' : '0.01'}
                  max={form.type === 'percentage' ? '100' : undefined}
                  value={form.value} onChange={set('value')} required
                  className={`w-full py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${form.type === 'fixed_amount' ? 'pl-10 pr-3' : 'px-3 pr-8'}`} />
                {form.type === 'percentage' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aplica a</label>
              <select value={form.applies_to} onChange={set('applies_to')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="global">Global</option>
                <option value="plan">Plan específico</option>
                <option value="subscription">Suscripción</option>
              </select>
            </div>
            {form.applies_to === 'plan' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select value={form.plan_id || ''} onChange={set('plan_id')} required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Seleccionar plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meses mínimos</label>
              <input type="number" min="1" value={form.min_months} onChange={set('min_months')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usos máximos <span className="text-xs text-gray-400 font-normal">(vacío = ilimitado)</span></label>
              <input type="number" min="1" value={form.max_uses || ''} onChange={set('max_uses')}
                placeholder="Ilimitado"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Válido desde</label>
              <input type="date" value={form.valid_from || ''} onChange={set('valid_from')} required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Válido hasta <span className="text-xs text-gray-400 font-normal">(opcional)</span></label>
              <input type="date" value={form.valid_until || ''} onChange={set('valid_until')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={form.is_active} onChange={set('is_active')}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm font-medium text-gray-700">Descuento activo</span>
          </label>

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
export default function DescuentosPage() {
  const [discounts, setDiscounts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchDiscounts = async () => {
    try {
      const { data } = await discountsAPI.list();
      setDiscounts(data.data || data || []);
    } catch { toast.error('Error cargando descuentos'); } finally { setLoading(false); }
  };

  const fetchPlans = async () => {
    try {
      const { data } = await plansAPI.list();
      setPlans(data.data || data || []);
    } catch {}
  };

  useEffect(() => { fetchDiscounts(); fetchPlans(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este descuento?')) return;
    try {
      await discountsAPI.delete(id);
      toast.success('Descuento eliminado');
      fetchDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const handleSave = () => {
    setShowModal(false);
    setEditing(null);
    fetchDiscounts();
  };

  /* ─── Computed ─── */
  const today = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    if (!search.trim()) return discounts;
    const q = search.toLowerCase();
    return discounts.filter((d) =>
      d.name?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q)
    );
  }, [discounts, search]);

  const totalFiltered = filtered.length;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = discounts.filter((d) => d.is_active).length;
  const totalUses = discounts.reduce((sum, d) => sum + (d.current_uses || d.uses_count || 0), 0);
  const expiringCount = discounts.filter((d) => {
    if (!d.valid_until || !d.is_active) return false;
    const diff = (new Date(d.valid_until) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  const getPlanName = (planId) => {
    const p = plans.find((pl) => pl.id === planId);
    return p ? p.name : '—';
  };

  const formatValue = (d) => {
    if (d.type === 'percentage') return `${d.value}%`;
    return fmtMoney(d.value);
  };

  const formatVigencia = (d) => {
    const from = d.valid_from ? new Date(d.valid_from).toLocaleDateString('es-DO') : '—';
    const until = d.valid_until ? new Date(d.valid_until).toLocaleDateString('es-DO') : 'Sin límite';
    return `${from} - ${until}`;
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Descuentos</h2>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Nuevo Descuento
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Tag size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Descuentos activos</p>
              <p className="text-2xl font-bold text-gray-800">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
              <Percent size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total usos</p>
              <p className="text-2xl font-bold text-gray-800">{totalUses.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Por vencer (30 días)</p>
              <p className="text-2xl font-bold text-gray-800">{expiringCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar descuentos..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No hay descuentos"
          description="Cree su primer descuento para ofrecer precios especiales a sus clientes."
          actionLabel="Crear Descuento"
          onAction={() => { setEditing(null); setShowModal(true); }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Aplica a</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Meses mín.</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Usos</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Vigencia</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((d) => {
                  const isExpired = d.valid_until && d.valid_until < today;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{d.name}</p>
                          {d.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{d.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          {d.type === 'percentage'
                            ? <><Percent size={12} className="text-indigo-500" /> {typeLabels[d.type]}</>
                            : <><DollarSign size={12} className="text-green-500" /> {typeLabels[d.type]}</>
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{formatValue(d)}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">
                          {appliesToLabels[d.applies_to] || d.applies_to}
                          {d.applies_to === 'plan' && d.plan_id && (
                            <span className="block text-xs text-gray-400">{getPlanName(d.plan_id)}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">{d.min_months || 1}</td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {(d.current_uses || d.uses_count || 0)}
                        {d.max_uses ? ` / ${d.max_uses}` : ' / ∞'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{formatVigencia(d)}</td>
                      <td className="px-4 py-3">
                        {isExpired ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Expirado</span>
                        ) : d.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditing(d); setShowModal(true); }}
                            className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Editar" aria-label="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(d.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Eliminar" aria-label="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalItems={totalFiltered}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DiscountModal
          discount={editing}
          plans={plans}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
