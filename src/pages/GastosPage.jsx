import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Plus, Search, Edit2, Trash2, X, Save, DollarSign,
  Calendar, FileText, Building2, ChevronDown, Filter,
  TrendingDown, Receipt, AlertCircle
} from 'lucide-react';
import { expensesAPI } from '../services/api';

const EXPENSE_TYPES = [
  { code: '01', label: 'Gastos de Personal' },
  { code: '02', label: 'Gastos por Trabajos/Suministros' },
  { code: '03', label: 'Arrendamientos' },
  { code: '04', label: 'Gastos de Activos Fijos' },
  { code: '05', label: 'Gastos de Representación' },
  { code: '06', label: 'Otras Deducciones' },
  { code: '07', label: 'Gastos Financieros' },
  { code: '08', label: 'Gastos Extraordinarios' },
  { code: '09', label: 'Costo de Venta' },
  { code: '10', label: 'Adquisición de Activos' },
  { code: '11', label: 'Gastos de Seguros' },
];

const PAYMENT_METHODS = [
  { code: '01', label: 'Efectivo' },
  { code: '02', label: 'Cheque/Transferencia' },
  { code: '03', label: 'Tarjeta Débito/Crédito' },
  { code: '04', label: 'Compra a Crédito' },
  { code: '05', label: 'Permuta' },
  { code: '06', label: 'Nota de Crédito' },
  { code: '07', label: 'Mixto' },
];

const SUPPLIER_ID_TYPES = [
  { code: '1', label: 'RNC' },
  { code: '2', label: 'Cédula' },
  { code: '3', label: 'Pasaporte' },
];

const CATEGORIES = [
  'Servicios', 'Suministros', 'Alquiler', 'Mantenimiento',
  'Electricidad', 'Agua', 'Internet/Telecom', 'Seguros',
  'Nómina', 'Impuestos', 'Combustible', 'Limpieza',
  'Seguridad', 'Reparaciones', 'Publicidad', 'Otros'
];

const emptyExpense = {
  supplier_name: '',
  supplier_rnc: '',
  supplier_id_type: '1',
  expense_type: '02',
  ncf: '',
  ncf_modified: '',
  expense_date: new Date().toISOString().split('T')[0],
  payment_date: '',
  subtotal: '',
  itbis_amount: '',
  itbis_retenido: '0',
  isr_retenido: '0',
  total: '',
  payment_method: '04',
  category: '',
  description: '',
};

function formatCurrency(v) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function GastosPage() {
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyExpense });
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (filterCategory) params.category = filterCategory;
      if (filterFrom) params.fromDate = filterFrom;
      if (filterTo) params.toDate = filterTo;
      const res = await expensesAPI.list(params);
      setExpenses(res.data?.data || []);
    } catch (err) {
      toast.error('Error cargando gastos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterFrom, filterTo]);

  const fetchStats = useCallback(async () => {
    try {
      const params = {};
      if (filterFrom) params.fromDate = filterFrom;
      if (filterTo) params.toDate = filterTo;
      const res = await expensesAPI.stats(params);
      setStats(res.data?.data || null);
    } catch {
      // stats are non-critical
    }
  }, [filterFrom, filterTo]);

  useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, [fetchExpenses, fetchStats]);

  const handleOpen = (expense = null) => {
    if (expense) {
      setEditingId(expense.id);
      setForm({
        supplier_name: expense.supplier_name || '',
        supplier_rnc: expense.supplier_rnc || '',
        supplier_id_type: expense.supplier_id_type || '1',
        expense_type: expense.expense_type || '02',
        ncf: expense.ncf || '',
        ncf_modified: expense.ncf_modified || '',
        expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : '',
        payment_date: expense.payment_date ? expense.payment_date.split('T')[0] : '',
        subtotal: expense.subtotal?.toString() || '',
        itbis_amount: expense.itbis_amount?.toString() || '',
        itbis_retenido: expense.itbis_retenido?.toString() || '0',
        isr_retenido: expense.isr_retenido?.toString() || '0',
        total: expense.total?.toString() || '',
        payment_method: expense.payment_method || '04',
        category: expense.category || '',
        description: expense.description || '',
      });
    } else {
      setEditingId(null);
      setForm({ ...emptyExpense, expense_date: new Date().toISOString().split('T')[0] });
    }
    setShowModal(true);
  };

  const handleSubtotalChange = (val) => {
    const subtotal = parseFloat(val) || 0;
    const itbis = Math.round(subtotal * 0.18 * 100) / 100;
    setForm(f => ({
      ...f,
      subtotal: val,
      itbis_amount: itbis.toString(),
      total: (subtotal + itbis).toFixed(2),
    }));
  };

  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      toast.error('El nombre del suplidor es requerido');
      return;
    }
    if (!form.subtotal || parseFloat(form.subtotal) <= 0) {
      toast.error('El subtotal debe ser mayor a 0');
      return;
    }
    try {
      setSaving(true);
      const data = {
        ...form,
        subtotal: parseFloat(form.subtotal) || 0,
        itbis_amount: parseFloat(form.itbis_amount) || 0,
        itbis_retenido: parseFloat(form.itbis_retenido) || 0,
        isr_retenido: parseFloat(form.isr_retenido) || 0,
        total: parseFloat(form.total) || 0,
      };
      if (editingId) {
        await expensesAPI.update(editingId, data);
        toast.success('Gasto actualizado');
      } else {
        await expensesAPI.create(data);
        toast.success('Gasto registrado');
      }
      setShowModal(false);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await expensesAPI.delete(id);
      toast.success('Gasto eliminado');
      setDeleteConfirm(null);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const filtered = expenses.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.supplier_name?.toLowerCase().includes(s) ||
      e.supplier_rnc?.includes(s) ||
      e.ncf?.toLowerCase().includes(s) ||
      e.category?.toLowerCase().includes(s) ||
      e.description?.toLowerCase().includes(s)
    );
  });

  const getExpenseTypeLabel = (code) => EXPENSE_TYPES.find(t => t.code === code)?.label || code;
  const getPaymentMethodLabel = (code) => PAYMENT_METHODS.find(m => m.code === code)?.label || code;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Registro de Gastos</h1>
          <p className="text-sm text-gray-500 mt-1">Gastos y compras operativas - Alimenta reporte DGII 606</p>
        </div>
        <button
          onClick={() => handleOpen()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Nuevo Gasto
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Gastos</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.total_amount)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Receipt className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">ITBIS Pagado</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.total_itbis)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Registros</p>
                <p className="text-xl font-bold text-gray-900">{stats.total_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por suplidor, RNC, NCF..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'hover:bg-gray-50'}`}
          >
            <Filter size={18} />
            Filtros
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Desde</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">Todas</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {(filterFrom || filterTo || filterCategory) && (
              <button
                onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterCategory(''); }}
                className="self-end text-sm text-red-600 hover:text-red-700 px-3 py-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No hay gastos registrados</p>
            <p className="text-sm mt-1">Registra tu primer gasto para alimentar el reporte 606</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Suplidor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">RNC</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">NCF</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Subtotal</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">ITBIS</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{exp.supplier_name}</div>
                      {exp.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{exp.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{exp.supplier_rnc || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{exp.ncf || '-'}</td>
                    <td className="px-4 py-3">
                      {exp.category && (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{exp.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{getExpenseTypeLabel(exp.expense_type)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(exp.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(exp.itbis_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(exp.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleOpen(exp)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Editar">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setDeleteConfirm(exp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 font-semibold">
                  <td colSpan={6} className="px-4 py-3 text-right text-gray-600">Totales:</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(filtered.reduce((s, e) => s + (parseFloat(e.subtotal) || 0), 0))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(filtered.reduce((s, e) => s + (parseFloat(e.itbis_amount) || 0), 0))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(filtered.reduce((s, e) => s + (parseFloat(e.total) || 0), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-600" size={20} />
              </div>
              <h3 className="text-lg font-semibold">Confirmar eliminación</h3>
            </div>
            <p className="text-gray-600 mb-6">¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Editar Gasto' : 'Registrar Gasto'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Supplier Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 size={16} /> Información del Suplidor
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nombre del Suplidor *</label>
                    <input type="text" value={form.supplier_name}
                      onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Nombre o razón social" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipo ID</label>
                    <select value={form.supplier_id_type}
                      onChange={e => setForm(f => ({ ...f, supplier_id_type: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                      {SUPPLIER_ID_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">RNC / Cédula</label>
                    <input type="text" value={form.supplier_rnc}
                      onChange={e => setForm(f => ({ ...f, supplier_rnc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      placeholder="Sin guiones" maxLength={11} />
                  </div>
                </div>
              </div>

              {/* Fiscal Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText size={16} /> Información Fiscal
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">NCF</label>
                    <input type="text" value={form.ncf}
                      onChange={e => setForm(f => ({ ...f, ncf: e.target.value.toUpperCase().slice(0, 19) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      placeholder="B0100000001" maxLength={19} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">NCF Modificado</label>
                    <input type="text" value={form.ncf_modified}
                      onChange={e => setForm(f => ({ ...f, ncf_modified: e.target.value.toUpperCase().slice(0, 19) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                      placeholder="Solo para notas de crédito" maxLength={19} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipo de Gasto (DGII)</label>
                    <select value={form.expense_type}
                      onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                      {EXPENSE_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} - {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Categoría Interna</label>
                    <select value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="">Seleccionar...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha del Gasto *</label>
                  <input type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fecha de Pago</label>
                  <input type="date" value={form.payment_date}
                    onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Amounts */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <DollarSign size={16} /> Montos (DOP)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Subtotal *</label>
                    <input type="number" value={form.subtotal} step="0.01" min="0"
                      onChange={e => handleSubtotalChange(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ITBIS (18%)</label>
                    <input type="number" value={form.itbis_amount} step="0.01" min="0"
                      onChange={e => setForm(f => ({
                        ...f,
                        itbis_amount: e.target.value,
                        total: ((parseFloat(f.subtotal) || 0) + (parseFloat(e.target.value) || 0)).toFixed(2)
                      }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Total</label>
                    <input type="number" value={form.total} step="0.01" min="0"
                      onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ITBIS Retenido</label>
                    <input type="number" value={form.itbis_retenido} step="0.01" min="0"
                      onChange={e => setForm(f => ({ ...f, itbis_retenido: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ISR Retenido</label>
                    <input type="number" value={form.isr_retenido} step="0.01" min="0"
                      onChange={e => setForm(f => ({ ...f, isr_retenido: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              {/* Payment + Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Forma de Pago</label>
                  <select value={form.payment_method}
                    onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    {PAYMENT_METHODS.map(m => <option key={m.code} value={m.code}>{m.code} - {m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notas</label>
                  <input type="text" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Descripción breve" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border rounded-lg hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Save size={16} />
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
