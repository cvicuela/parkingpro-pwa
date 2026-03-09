import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Hash, AlertTriangle, CheckCircle, XCircle, Edit3,
  Save, X, RefreshCw, Shield, Calendar, BarChart3
} from 'lucide-react';
import { ncfAPI } from '../services/api';

const NCF_TYPE_LABELS = {
  '01': { name: 'Crédito Fiscal', desc: 'B2B con ITBIS deducible', color: 'blue' },
  '02': { name: 'Consumo', desc: 'Ventas a consumidores finales', color: 'green' },
  '03': { name: 'Nota de Débito', desc: 'Modificar factura al alza', color: 'orange' },
  '04': { name: 'Nota de Crédito', desc: 'Devoluciones/descuentos', color: 'red' },
  '11': { name: 'Compras', desc: 'Proveedores informales', color: 'purple' },
  '13': { name: 'Gastos Menores', desc: 'Parking, peajes, consumibles', color: 'gray' },
  '14': { name: 'Régimen Especial', desc: 'Zonas francas, etc.', color: 'teal' },
  '15': { name: 'Gubernamental', desc: 'Ventas al gobierno', color: 'indigo' },
};

function getStatusColor(seq) {
  if (!seq.is_active) return 'gray';
  if (seq.needs_alert) return 'red';
  if (seq.usage_pct > 80) return 'yellow';
  return 'green';
}

function ProgressBar({ pct, color }) {
  const bg = {
    green: 'bg-green-500', yellow: 'bg-yellow-500',
    red: 'bg-red-500', gray: 'bg-gray-400'
  }[color] || 'bg-blue-500';

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className={`${bg} h-2.5 rounded-full transition-all`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function NCFPage() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadSequences = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ncfAPI.listSequences();
      setSequences(res.data?.data || []);
    } catch (err) {
      toast.error('Error cargando secuencias: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const startEdit = (seq) => {
    setEditingId(seq.id);
    setEditForm({
      rangeTo: seq.range_to,
      alertThreshold: seq.alert_threshold,
      expirationDate: seq.expiration_date || '',
      authorizedDate: seq.authorized_date || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    try {
      await ncfAPI.updateSequence(id, editForm);
      toast.success('Secuencia actualizada');
      setEditingId(null);
      loadSequences();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const toggleActive = async (seq) => {
    try {
      await ncfAPI.updateSequence(seq.id, { isActive: !seq.is_active });
      toast.success(seq.is_active ? 'Secuencia desactivada' : 'Secuencia activada');
      loadSequences();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  // Summary stats
  const activeSeqs = sequences.filter(s => s.is_active);
  const alertSeqs = sequences.filter(s => s.needs_alert && s.is_active);
  const totalUsed = sequences.reduce((sum, s) => sum + (s.current_number || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comprobantes Fiscales (NCF)</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de secuencias de comprobantes autorizados por la DGII</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Hash size={14} /> Secuencias Activas
          </div>
          <p className="text-2xl font-bold">{activeSeqs.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <BarChart3 size={14} /> NCFs Emitidos
          </div>
          <p className="text-2xl font-bold">{totalUsed.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 ${alertSeqs.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="flex items-center gap-2 text-xs mb-1 text-gray-500">
            <AlertTriangle size={14} className={alertSeqs.length > 0 ? 'text-red-500' : ''} /> Alertas
          </div>
          <p className={`text-2xl font-bold ${alertSeqs.length > 0 ? 'text-red-600' : ''}`}>
            {alertSeqs.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-center">
          <button onClick={loadSequences} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertSeqs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-800">Secuencias por agotarse</p>
              <p className="text-sm text-red-700 mt-1">
                {alertSeqs.map(s => `${s.prefix} (${s.remaining} restantes)`).join(', ')}
                {' '}&mdash; Solicite nuevas secuencias a la DGII.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sequences Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Prefijo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Progreso</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Usado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Rango</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Restante</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimiento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sequences.map(seq => {
                const typeInfo = NCF_TYPE_LABELS[seq.ncf_type] || { name: seq.ncf_type, desc: '', color: 'gray' };
                const statusColor = getStatusColor(seq);
                const isEditing = editingId === seq.id;

                return (
                  <tr key={seq.id} className={`hover:bg-gray-50 ${!seq.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{typeInfo.name}</p>
                        <p className="text-xs text-gray-400">{typeInfo.desc}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-lg">{seq.prefix}</td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <ProgressBar pct={seq.usage_pct} color={statusColor} />
                      <p className="text-xs text-gray-400 mt-1">{seq.usage_pct}%</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {seq.current_number.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {isEditing ? (
                        <input type="number" value={editForm.rangeTo}
                          onChange={e => setEditForm({ ...editForm, rangeTo: parseInt(e.target.value) })}
                          className="w-24 border rounded px-2 py-1 text-right text-sm" />
                      ) : (
                        `${seq.range_from.toLocaleString()} - ${seq.range_to.toLocaleString()}`
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      seq.needs_alert ? 'text-red-600' : seq.remaining < 500 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {seq.remaining.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(seq)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          seq.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        } transition-colors`}>
                        {seq.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {seq.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <input type="date" value={editForm.expirationDate}
                          onChange={e => setEditForm({ ...editForm, expirationDate: e.target.value })}
                          className="border rounded px-2 py-1 text-sm" />
                      ) : (
                        seq.expiration_date
                          ? new Date(seq.expiration_date).toLocaleDateString('es-DO')
                          : <span className="text-gray-400">Sin vencimiento</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => saveEdit(seq.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <Save size={16} />
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-gray-50 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(seq)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                          <Edit3 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="text-blue-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-medium">Sobre los comprobantes fiscales</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-700">
              <li><strong>B02</strong> (Consumo): Se usa para la mayoría de ventas a clientes del parqueo</li>
              <li><strong>B01</strong> (Crédito Fiscal): Para empresas que necesitan deducir ITBIS</li>
              <li><strong>B11</strong> (Compras): Para compras a proveedores informales sin NCF</li>
              <li><strong>B13</strong> (Gastos Menores): Para gastos pequeños del negocio</li>
              <li>Las secuencias son autorizadas por la DGII y tienen un rango limitado</li>
              <li>Configure la alerta para ser notificado cuando queden pocos comprobantes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
