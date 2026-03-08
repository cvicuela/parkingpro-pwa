import { useState, useEffect } from 'react';
import { rfidAPI, subscriptionsAPI } from '../services/api';
import { toast } from 'react-toastify';
import {
  CreditCard, CheckCircle, Radio, AlertTriangle, Search,
  Plus, X, ArrowLeftRight, Trash2, Power, PowerOff, Wifi, Tag
} from 'lucide-react';

const STATUS_CONFIG = {
  available: { label: 'Disponible', color: 'bg-green-100 text-green-700' },
  assigned: { label: 'Asignada', color: 'bg-yellow-100 text-yellow-700' },
  in_use: { label: 'En uso', color: 'bg-blue-100 text-blue-700' },
  lost: { label: 'Perdida', color: 'bg-red-100 text-red-700' },
  disabled: { label: 'Deshabilitada', color: 'bg-gray-100 text-gray-500' },
};

const TYPE_CONFIG = {
  permanent: { label: 'Permanente', color: 'bg-indigo-100 text-indigo-700' },
  temporary: { label: 'Temporal', color: 'bg-amber-100 text-amber-700' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function RFIDPage() {
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [assignPermanentModal, setAssignPermanentModal] = useState(null);
  const [assignTemporaryModal, setAssignTemporaryModal] = useState(null);

  // Register form
  const [regForm, setRegForm] = useState({ cardUid: '', cardType: 'temporary', label: '' });
  const [regSaving, setRegSaving] = useState(false);

  // Assign permanent form
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub] = useState('');

  // Assign temporary form
  const [tempPlate, setTempPlate] = useState('');

  const fetchData = async () => {
    try {
      const [cardsRes, statsRes] = await Promise.all([
        rfidAPI.list({ cardType: filterType || null, status: filterStatus || null, search: search || null }),
        rfidAPI.poolStats()
      ]);
      setCards(cardsRes.data.data || cardsRes.data || []);
      setStats(statsRes.data.data || statsRes.data || null);
    } catch (err) {
      toast.error('Error cargando tarjetas RFID');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search, filterType, filterStatus]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regForm.cardUid) return;
    setRegSaving(true);
    try {
      await rfidAPI.register(regForm);
      toast.success('Tarjeta registrada exitosamente');
      setShowRegister(false);
      setRegForm({ cardUid: '', cardType: 'temporary', label: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error al registrar tarjeta');
    } finally {
      setRegSaving(false);
    }
  };

  const openAssignPermanent = async (card) => {
    try {
      const { data } = await subscriptionsAPI.list({ status: 'active' });
      setSubscriptions(data.data || data || []);
      setAssignPermanentModal(card);
      setSelectedSub('');
    } catch {
      toast.error('Error cargando suscripciones');
    }
  };

  const handleAssignPermanent = async () => {
    if (!selectedSub) return;
    try {
      await rfidAPI.assignPermanent(assignPermanentModal.id, selectedSub);
      toast.success('Tarjeta asignada a suscripcion');
      setAssignPermanentModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error al asignar');
    }
  };

  const handleAssignTemporary = async () => {
    if (!tempPlate) return;
    try {
      await rfidAPI.assignTemporary(assignTemporaryModal.id, tempPlate);
      toast.success('Tarjeta temporal asignada');
      setAssignTemporaryModal(null);
      setTempPlate('');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error al asignar');
    }
  };

  const handleReturn = async (card) => {
    try {
      await rfidAPI.returnCard(card.id);
      toast.success('Tarjeta devuelta al pool');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const handleReportLost = async (card) => {
    if (!confirm(`Reportar tarjeta ${card.label || card.card_uid} como perdida? Se aplicara penalizacion.`)) return;
    try {
      await rfidAPI.reportLost(card.id);
      toast.warning('Tarjeta reportada como perdida');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const handleDisable = async (card) => {
    try {
      await rfidAPI.disable(card.id);
      toast.info('Tarjeta deshabilitada');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  const handleEnable = async (card) => {
    try {
      await rfidAPI.enable(card.id);
      toast.success('Tarjeta habilitada');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Tarjetas RFID</h2>
        <button onClick={() => setShowRegister(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Registrar Tarjeta
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={CreditCard} label="Total" value={stats.total || 0} color="bg-gray-100 text-gray-600" />
          <StatCard icon={CheckCircle} label="Disponibles" value={stats.available || 0} color="bg-green-100 text-green-600" />
          <StatCard icon={Radio} label="En Uso" value={stats.in_use || 0} color="bg-blue-100 text-blue-600" />
          <StatCard icon={AlertTriangle} label="Perdidas" value={stats.lost || 0} color="bg-red-100 text-red-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por UID, etiqueta o cliente..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">Todos los tipos</option>
          <option value="permanent">Permanente</option>
          <option value="temporary">Temporal</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="assigned">Asignada</option>
          <option value="in_use">En uso</option>
          <option value="lost">Perdida</option>
          <option value="disabled">Deshabilitada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : cards.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No se encontraron tarjetas RFID</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="py-3 px-4">UID</th>
                  <th className="py-3 px-4">Etiqueta</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Cliente / Placa</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm font-medium">{c.card_uid}</td>
                    <td className="py-3 px-4 text-sm">{c.label || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_CONFIG[c.card_type]?.color || 'bg-gray-100'}`}>
                        {TYPE_CONFIG[c.card_type]?.label || c.card_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[c.status]?.color || 'bg-gray-100'}`}>
                        {STATUS_CONFIG[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {c.customer_name || c.metadata?.vehicle_plate || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status === 'available' && c.card_type === 'permanent' && (
                          <button onClick={() => openAssignPermanent(c)} title="Asignar a suscripcion"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                            <ArrowLeftRight size={14} />
                          </button>
                        )}
                        {c.status === 'available' && c.card_type === 'temporary' && (
                          <button onClick={() => { setAssignTemporaryModal(c); setTempPlate(''); }} title="Asignar temporal"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                            <ArrowLeftRight size={14} />
                          </button>
                        )}
                        {c.status === 'assigned' && c.card_type === 'temporary' && (
                          <button onClick={() => handleReturn(c)} title="Devolver"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {(c.status === 'assigned' || c.status === 'in_use') && (
                          <button onClick={() => handleReportLost(c)} title="Reportar perdida"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <AlertTriangle size={14} />
                          </button>
                        )}
                        {['available', 'assigned', 'in_use'].includes(c.status) && (
                          <button onClick={() => handleDisable(c)} title="Deshabilitar"
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                            <PowerOff size={14} />
                          </button>
                        )}
                        {c.status === 'disabled' && (
                          <button onClick={() => handleEnable(c)} title="Habilitar"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded">
                            <Power size={14} />
                          </button>
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

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Wifi size={20} /> Registrar Tarjeta</h3>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleRegister} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UID de Tarjeta</label>
                <input value={regForm.cardUid} onChange={(e) => setRegForm({ ...regForm, cardUid: e.target.value.toUpperCase() })}
                  placeholder="Escanee o ingrese el UID" required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={regForm.cardType} onChange={(e) => setRegForm({ ...regForm, cardType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="temporary">Temporal</option>
                  <option value="permanent">Permanente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta (opcional)</label>
                <input value={regForm.label} onChange={(e) => setRegForm({ ...regForm, label: e.target.value })}
                  placeholder="Ej: Tarjeta #042"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRegister(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={regSaving}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {regSaving ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Permanent Modal */}
      {assignPermanentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAssignPermanentModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Asignar a Suscripcion</h3>
              <button onClick={() => setAssignPermanentModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">Tarjeta: <strong className="font-mono">{assignPermanentModal.card_uid}</strong> {assignPermanentModal.label && `(${assignPermanentModal.label})`}</p>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-amber-600">No hay suscripciones activas disponibles.</p>
              ) : (
                <select value={selectedSub} onChange={(e) => setSelectedSub(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Seleccionar suscripcion...</option>
                  {subscriptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.customer_name || `${s.customer?.first_name || ''} ${s.customer?.last_name || ''}`} — {s.vehicle_plate || s.vehicle?.plate || ''} — {s.plan_name || s.plan?.name || ''}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAssignPermanentModal(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAssignPermanent} disabled={!selectedSub}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Asignar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Temporary Modal */}
      {assignTemporaryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAssignTemporaryModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Asignar Tarjeta Temporal</h3>
              <button onClick={() => setAssignTemporaryModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">Tarjeta: <strong className="font-mono">{assignTemporaryModal.card_uid}</strong> {assignTemporaryModal.label && `(${assignTemporaryModal.label})`}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehiculo</label>
                <input value={tempPlate} onChange={(e) => setTempPlate(e.target.value.toUpperCase())}
                  placeholder="Ej: A123456" required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAssignTemporaryModal(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAssignTemporary} disabled={!tempPlate}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Asignar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
