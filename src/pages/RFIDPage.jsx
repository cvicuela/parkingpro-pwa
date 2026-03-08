import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { CreditCard, CheckCircle, Radio, AlertTriangle, Search, RefreshCw, Plus, X } from 'lucide-react';
import { rfidAPI, subscriptionsAPI } from '../services/api';

const STATUS_BADGES = {
  available: { label: 'Disponible', bg: 'bg-green-100', text: 'text-green-700' },
  assigned: { label: 'Asignada', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  in_use: { label: 'En uso', bg: 'bg-blue-100', text: 'text-blue-700' },
  lost: { label: 'Perdida', bg: 'bg-red-100', text: 'text-red-700' },
  disabled: { label: 'Deshabilitada', bg: 'bg-gray-100', text: 'text-gray-500' },
};

const TYPE_BADGES = {
  permanent: { label: 'Permanente', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  temporary: { label: 'Temporal', bg: 'bg-amber-100', text: 'text-amber-700' },
};

export default function RFIDPage() {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, available: 0, in_use: 0, lost: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cardType, setCardType] = useState('');
  const [status, setStatus] = useState('');

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showAssignPermanent, setShowAssignPermanent] = useState(false);
  const [showAssignTemporary, setShowAssignTemporary] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Register form
  const [regForm, setRegForm] = useState({ cardUid: '', cardType: 'temporary', label: '' });
  const [regSaving, setRegSaving] = useState(false);

  // Assign permanent form
  const [subscriptions, setSubscriptions] = useState([]);
  const [assignSubId, setAssignSubId] = useState('');
  const [existingSubCards, setExistingSubCards] = useState([]);
  const [loadingSubCards, setLoadingSubCards] = useState(false);

  // Assign temporary form
  const [assignPlate, setAssignPlate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50, offset: 0 };
      if (search) params.search = search;
      if (cardType) params.cardType = cardType;
      if (status) params.status = status;

      const [cardsRes, statsRes] = await Promise.all([
        rfidAPI.list(params),
        rfidAPI.poolStats(),
      ]);
      const cardsData = cardsRes.data.data || cardsRes.data || [];
      setCards(Array.isArray(cardsData) ? cardsData : []);
      setTotal(cardsRes.data.total || cardsData.length || 0);
      setStats(statsRes.data.data || statsRes.data || { total: 0, available: 0, in_use: 0, lost: 0 });
    } catch {
      toast.error('Error cargando tarjetas RFID');
    } finally {
      setLoading(false);
    }
  }, [search, cardType, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute per-customer card counts for multi-card badge
  const customerCardCounts = {};
  cards.forEach(c => {
    if (c.customer_id) {
      customerCardCounts[c.customer_id] = (customerCardCounts[c.customer_id] || 0) + 1;
    }
  });
  // Assign sequential index per customer
  const customerCardSeq = {};
  const cardPositionMap = {};
  cards.forEach(c => {
    if (c.customer_id) {
      customerCardSeq[c.customer_id] = (customerCardSeq[c.customer_id] || 0) + 1;
      cardPositionMap[c.id] = customerCardSeq[c.customer_id];
    }
  });

  // Fetch existing cards when subscription selection changes
  useEffect(() => {
    if (!assignSubId) {
      setExistingSubCards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSubCards(true);
      try {
        const res = await rfidAPI.listBySubscription(assignSubId);
        if (!cancelled) {
          const data = res.data.data || res.data || [];
          setExistingSubCards(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setExistingSubCards([]);
      } finally {
        if (!cancelled) setLoadingSubCards(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignSubId]);

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (!regForm.cardUid.trim()) { toast.error('UID de tarjeta requerido'); return; }
    setRegSaving(true);
    try {
      await rfidAPI.register(regForm);
      toast.success('Tarjeta registrada exitosamente');
      setShowRegister(false);
      setRegForm({ cardUid: '', cardType: 'temporary', label: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error registrando tarjeta');
    } finally {
      setRegSaving(false);
    }
  };

  const openAssignPermanent = async (card) => {
    setSelectedCard(card);
    try {
      const res = await subscriptionsAPI.list({ status: 'active', limit: 200 });
      setSubscriptions(res.data.data || res.data || []);
    } catch {
      toast.error('Error cargando suscripciones');
    }
    setAssignSubId('');
    setShowAssignPermanent(true);
  };

  const openAssignTemporary = (card) => {
    setSelectedCard(card);
    setAssignPlate('');
    setShowAssignTemporary(true);
  };

  const handleAssignPermanent = async () => {
    if (!assignSubId) { toast.error('Seleccione una suscripcion'); return; }
    try {
      await rfidAPI.assignPermanent(selectedCard.id, assignSubId);
      toast.success('Tarjeta asignada exitosamente');
      setShowAssignPermanent(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error asignando tarjeta');
    }
  };

  const handleAssignTemporary = async () => {
    if (!assignPlate.trim()) { toast.error('Placa requerida'); return; }
    try {
      await rfidAPI.assignTemporary(selectedCard.id, assignPlate.trim().toUpperCase());
      toast.success('Tarjeta asignada exitosamente');
      setShowAssignTemporary(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error asignando tarjeta');
    }
  };

  const handleReturn = async (card) => {
    try {
      await rfidAPI.returnCard(card.id);
      toast.success('Tarjeta devuelta al pool');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error devolviendo tarjeta');
    }
  };

  const handleReportLost = async (card) => {
    try {
      await rfidAPI.reportLost(card.id);
      toast.success('Tarjeta reportada como perdida');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error reportando tarjeta');
    }
  };

  const handleDisable = async (card) => {
    try {
      await rfidAPI.disable(card.id);
      toast.success('Tarjeta deshabilitada');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error deshabilitando tarjeta');
    }
  };

  const handleEnable = async (card) => {
    try {
      await rfidAPI.enable(card.id);
      toast.success('Tarjeta habilitada');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Error habilitando tarjeta');
    }
  };

  const statusBadge = (s) => {
    const b = STATUS_BADGES[s] || { label: s, bg: 'bg-gray-100', text: 'text-gray-500' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  const typeBadge = (t) => {
    const b = TYPE_BADGES[t] || { label: t, bg: 'bg-gray-100', text: 'text-gray-500' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Radio size={24} /> Tarjetas RFID
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500"><strong>{total}</strong> tarjetas</span>
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <CreditCard size={20} className="text-gray-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-500">Total tarjetas</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
            <p className="text-xs text-gray-500">Disponibles</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Radio size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{stats.in_use}</p>
            <p className="text-xs text-gray-500">En Uso</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{stats.lost}</p>
            <p className="text-xs text-gray-500">Perdidas</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar UID, etiqueta, cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={cardType}
          onChange={e => setCardType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los tipos</option>
          <option value="permanent">Permanente</option>
          <option value="temporary">Temporal</option>
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="assigned">Asignada</option>
          <option value="in_use">En uso</option>
          <option value="lost">Perdida</option>
          <option value="disabled">Deshabilitada</option>
        </select>
        <button
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus size={16} /> Registrar Tarjeta
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['UID', 'Etiqueta', 'Tipo', 'Estado', 'Cliente / Placa', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">No hay tarjetas RFID registradas</td>
                  </tr>
                ) : (
                  cards.map(card => (
                    <tr key={card.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-800 font-medium">{card.card_uid}</td>
                      <td className="px-4 py-3 text-gray-600">{card.label || '—'}</td>
                      <td className="px-4 py-3">{typeBadge(card.card_type)}</td>
                      <td className="px-4 py-3">{statusBadge(card.status)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{card.customer_name || card.vehicle_plate || card.metadata?.vehicle_plate || '—'}</span>
                          {card.customer_id && customerCardCounts[card.customer_id] > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                              {cardPositionMap[card.id]} de {customerCardCounts[card.customer_id]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {card.status === 'available' && (
                            <button
                              onClick={() => card.card_type === 'permanent' ? openAssignPermanent(card) : openAssignTemporary(card)}
                              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                            >
                              Asignar
                            </button>
                          )}
                          {card.status === 'assigned' && card.card_type === 'temporary' && (
                            <button
                              onClick={() => handleReturn(card)}
                              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            >
                              Devolver
                            </button>
                          )}
                          {card.status === 'assigned' && card.card_type === 'permanent' && (
                            <button
                              onClick={() => handleReturn(card)}
                              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            >
                              Desvincular
                            </button>
                          )}
                          {card.status === 'in_use' && (
                            <button
                              onClick={() => handleReportLost(card)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Reportar Perdida
                            </button>
                          )}
                          {['available', 'assigned', 'in_use'].includes(card.status) && (
                            <button
                              onClick={() => handleDisable(card)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              Deshabilitar
                            </button>
                          )}
                          {card.status === 'disabled' && (
                            <button
                              onClick={() => handleEnable(card)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Habilitar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Card Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Registrar Tarjeta RFID</h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UID de Tarjeta *</label>
                <input
                  value={regForm.cardUid}
                  onChange={e => setRegForm(f => ({ ...f, cardUid: e.target.value.toUpperCase() }))}
                  placeholder="Escanee o ingrese el UID"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Tarjeta</label>
                <select
                  value={regForm.cardType}
                  onChange={e => setRegForm(f => ({ ...f, cardType: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="permanent">Permanente</option>
                  <option value="temporary">Temporal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta (opcional)</label>
                <input
                  value={regForm.label}
                  onChange={e => setRegForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Tarjeta #042"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={regSaving}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 font-medium disabled:opacity-50"
                >
                  {regSaving ? 'Registrando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Permanent Modal */}
      {showAssignPermanent && selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignPermanent(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Asignar Tarjeta Permanente</h2>
              <button onClick={() => setShowAssignPermanent(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-500">Tarjeta: <span className="font-mono font-medium text-gray-800">{selectedCard.card_uid}</span></p>
              {selectedCard.label && <p className="text-gray-500">Etiqueta: <span className="text-gray-800">{selectedCard.label}</span></p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suscripcion Activa *</label>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-amber-600">No hay suscripciones activas disponibles.</p>
              ) : (
                <select
                  value={assignSubId}
                  onChange={e => setAssignSubId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccione una suscripcion...</option>
                  {subscriptions.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.customer_name || `${sub.customer?.first_name || ''} ${sub.customer?.last_name || ''}`} — {sub.vehicle_plate || sub.vehicle?.plate || ''} — {sub.plan_name || sub.plan?.name || 'Plan'}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {/* Existing cards for selected subscription */}
            {assignSubId && (
              <div className="mt-4">
                {loadingSubCards ? (
                  <p className="text-xs text-gray-400">Cargando tarjetas existentes...</p>
                ) : existingSubCards.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-amber-800 font-medium">
                      Esta suscripcion ya tiene {existingSubCards.length} tarjeta(s) asignada(s). Se agregara una tarjeta adicional.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {existingSubCards.map(ec => (
                        <span
                          key={ec.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          <CreditCard size={12} />
                          {ec.card_uid}
                          {ec.label ? ` (${ec.label})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAssignPermanent(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignPermanent}
                disabled={!assignSubId}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 font-medium disabled:opacity-50"
              >
                {existingSubCards.length > 0 ? 'Asignar Tarjeta Adicional' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Temporary Modal */}
      {showAssignTemporary && selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignTemporary(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Asignar Tarjeta Temporal</h2>
              <button onClick={() => setShowAssignTemporary(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-500">Tarjeta: <span className="font-mono font-medium text-gray-800">{selectedCard.card_uid}</span></p>
              {selectedCard.label && <p className="text-gray-500">Etiqueta: <span className="text-gray-800">{selectedCard.label}</span></p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehiculo *</label>
              <input
                value={assignPlate}
                onChange={e => setAssignPlate(e.target.value.toUpperCase())}
                placeholder="Ej: A123456"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAssignTemporary(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignTemporary}
                disabled={!assignPlate.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 font-medium disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
