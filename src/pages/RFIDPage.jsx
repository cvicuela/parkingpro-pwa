import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  CreditCard, CheckCircle, Radio, AlertTriangle, Search, RefreshCw, Plus, X,
  Wifi, WifiOff, Scan, Loader, Link2, Unlink, Ban, ShieldCheck,
  Users, Zap, ChevronRight
} from 'lucide-react';
import { rfidAPI, subscriptionsAPI, devicesAPI, customersAPI } from '../services/api';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  const [showLinkFlow, setShowLinkFlow] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Register form
  const [regForm, setRegForm] = useState({ cardUid: '', cardType: 'temporary', label: '' });
  const [regSaving, setRegSaving] = useState(false);

  // Readers
  const [readers, setReaders] = useState([]);
  const [selectedReader, setSelectedReader] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedUid, setScannedUid] = useState('');
  const socketRef = useRef(null);

  // Assign permanent form
  const [subscriptions, setSubscriptions] = useState([]);
  const [assignSubId, setAssignSubId] = useState('');
  const [existingSubCards, setExistingSubCards] = useState([]);
  const [loadingSubCards, setLoadingSubCards] = useState(false);

  // Assign temporary form
  const [assignPlate, setAssignPlate] = useState('');

  // Link flow: card -> customer -> plan
  const [linkStep, setLinkStep] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSubs, setCustomerSubs] = useState([]);
  const [selectedSubForLink, setSelectedSubForLink] = useState('');

  // Socket.IO for card scanning
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => { socket.emit('join_dashboard'); });

    socket.on('card_scanned', (data) => {
      setScannedUid(data.card_uid);
      setScanning(false);
      toast.success(`Tarjeta detectada: ${data.card_uid}`);
      setRegForm(f => ({ ...f, cardUid: data.card_uid }));
    });

    socket.on('reader_listening', (data) => {
      toast.info(`Lector ${data.device_name} esperando tarjeta...`, { autoClose: 2000 });
    });

    socket.on('reader_stopped', () => { setScanning(false); });

    return () => { socket.disconnect(); };
  }, []);

  // Fetch Data
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
    } finally { setLoading(false); }
  }, [search, cardType, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch readers
  useEffect(() => {
    devicesAPI.readers()
      .then(r => { const d = r.data?.data || r.data || []; setReaders(Array.isArray(d) ? d : []); })
      .catch(() => setReaders([]));
  }, []);

  // Card counts for multi-card display
  const customerCardCounts = {};
  cards.forEach(c => { if (c.customer_id) customerCardCounts[c.customer_id] = (customerCardCounts[c.customer_id] || 0) + 1; });
  const customerCardSeq = {};
  const cardPositionMap = {};
  cards.forEach(c => {
    if (c.customer_id) {
      customerCardSeq[c.customer_id] = (customerCardSeq[c.customer_id] || 0) + 1;
      cardPositionMap[c.id] = customerCardSeq[c.customer_id];
    }
  });

  // Reader scanning
  const startScan = async () => {
    if (!selectedReader) { toast.warning('Seleccione un lector RFID primero'); return; }
    setScanning(true);
    setScannedUid('');
    try { await devicesAPI.requestCardRead(selectedReader); }
    catch (err) { toast.error(err.message || 'Error al iniciar lectura'); setScanning(false); }
  };

  const stopScan = async () => {
    if (selectedReader) { try { await devicesAPI.stopReading(selectedReader); } catch {} }
    setScanning(false);
  };

  // Existing cards for subscription
  useEffect(() => {
    if (!assignSubId) { setExistingSubCards([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingSubCards(true);
      try {
        const res = await rfidAPI.listBySubscription(assignSubId);
        if (!cancelled) { const d = res.data.data || res.data || []; setExistingSubCards(Array.isArray(d) ? d : []); }
      } catch { if (!cancelled) setExistingSubCards([]); }
      finally { if (!cancelled) setLoadingSubCards(false); }
    })();
    return () => { cancelled = true; };
  }, [assignSubId]);

  // Register
  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (!regForm.cardUid.trim()) { toast.error('UID de tarjeta requerido'); return; }
    setRegSaving(true);
    try {
      await rfidAPI.register(regForm);
      toast.success('Tarjeta registrada exitosamente');
      setShowRegister(false);
      setRegForm({ cardUid: '', cardType: 'temporary', label: '' });
      setScannedUid('');
      fetchData();
    } catch (err) { toast.error(err.message || 'Error registrando tarjeta'); }
    finally { setRegSaving(false); }
  };

  // Assign Permanent
  const openAssignPermanent = async (card) => {
    setSelectedCard(card);
    try { const res = await subscriptionsAPI.list({ status: 'active', limit: 200 }); setSubscriptions(res.data.data || res.data || []); }
    catch { toast.error('Error cargando suscripciones'); }
    setAssignSubId('');
    setShowAssignPermanent(true);
  };

  const handleAssignPermanent = async () => {
    if (!assignSubId) { toast.error('Seleccione una suscripcion'); return; }
    try { await rfidAPI.assignPermanent(selectedCard.id, assignSubId); toast.success('Tarjeta asignada'); setShowAssignPermanent(false); fetchData(); }
    catch (err) { toast.error(err.message || 'Error asignando'); }
  };

  // Assign Temporary
  const openAssignTemporary = (card) => { setSelectedCard(card); setAssignPlate(''); setShowAssignTemporary(true); };

  const handleAssignTemporary = async () => {
    if (!assignPlate.trim()) { toast.error('Placa requerida'); return; }
    try { await rfidAPI.assignTemporary(selectedCard.id, assignPlate.trim().toUpperCase()); toast.success('Tarjeta asignada'); setShowAssignTemporary(false); fetchData(); }
    catch (err) { toast.error(err.message || 'Error asignando'); }
  };

  // Link Flow: Card -> Customer -> Plan
  const openLinkFlow = (card) => {
    setSelectedCard(card);
    setLinkStep(1);
    setCustomerSearch('');
    setCustomers([]);
    setSelectedCustomer(null);
    setCustomerSubs([]);
    setSelectedSubForLink('');
    setShowLinkFlow(true);
  };

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    try {
      const res = await customersAPI.list({ search: customerSearch, limit: 20 });
      const d = res.data?.data || res.data || [];
      setCustomers(Array.isArray(d) ? d : []);
    } catch { toast.error('Error buscando clientes'); }
  };

  const selectCustomerForLink = async (customer) => {
    setSelectedCustomer(customer);
    setLinkStep(2);
    try {
      const res = await subscriptionsAPI.list({ status: 'active', limit: 100 });
      const allSubs = res.data?.data || res.data || [];
      const custSubs = Array.isArray(allSubs) ? allSubs.filter(s =>
        s.customer_id === customer.id || s.customer_name === `${customer.first_name} ${customer.last_name}`
      ) : [];
      setCustomerSubs(custSubs);
    } catch { toast.error('Error cargando suscripciones'); }
  };

  const handleLinkComplete = async () => {
    if (!selectedSubForLink) { toast.error('Seleccione un plan/suscripcion'); return; }
    try {
      await rfidAPI.assignPermanent(selectedCard.id, selectedSubForLink);
      toast.success('Tarjeta vinculada: Tarjeta -> Cliente -> Plan');
      setShowLinkFlow(false);
      fetchData();
    } catch (err) { toast.error(err.message || 'Error vinculando'); }
  };

  // Card Actions
  const handleReturn = async (card) => {
    try { await rfidAPI.returnCard(card.id); toast.success('Tarjeta devuelta'); fetchData(); }
    catch (err) { toast.error(err.message || 'Error'); }
  };
  const handleReportLost = async (card) => {
    try { await rfidAPI.reportLost(card.id); toast.success('Tarjeta reportada como perdida'); fetchData(); }
    catch (err) { toast.error(err.message || 'Error'); }
  };
  const handleDisable = async (card) => {
    try { await rfidAPI.disable(card.id); toast.success('Tarjeta deshabilitada'); fetchData(); }
    catch (err) { toast.error(err.message || 'Error'); }
  };
  const handleEnable = async (card) => {
    try { await rfidAPI.enable(card.id); toast.success('Tarjeta habilitada'); fetchData(); }
    catch (err) { toast.error(err.message || 'Error'); }
  };

  const statusBadge = (s) => {
    const b = STATUS_BADGES[s] || { label: s, bg: 'bg-gray-100', text: 'text-gray-500' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };
  const typeBadge = (t) => {
    const b = TYPE_BADGES[t] || { label: t, bg: 'bg-gray-100', text: 'text-gray-500' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  const onlineReaders = readers.filter(r => r.status === 'online');

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
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><CreditCard size={20} className="text-gray-600" /></div>
          <div><p className="text-2xl font-bold text-gray-800">{stats.total}</p><p className="text-xs text-gray-500">Total tarjetas</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle size={20} className="text-green-600" /></div>
          <div><p className="text-2xl font-bold text-green-600">{stats.available}</p><p className="text-xs text-gray-500">Disponibles</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Radio size={20} className="text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-blue-600">{stats.in_use}</p><p className="text-xs text-gray-500">En Uso</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle size={20} className="text-red-600" /></div>
          <div><p className="text-2xl font-bold text-red-600">{stats.lost}</p><p className="text-xs text-gray-500">Perdidas</p></div>
        </div>
      </div>

      {/* Connected Readers Banner */}
      {readers.length > 0 && (
        <div className={`rounded-xl border p-3 flex items-center gap-3 ${onlineReaders.length > 0 ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${onlineReaders.length > 0 ? 'bg-teal-100' : 'bg-gray-200'}`}>
            {onlineReaders.length > 0 ? <Wifi size={16} className="text-teal-600" /> : <WifiOff size={16} className="text-gray-400" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">
              {onlineReaders.length > 0 ? `${onlineReaders.length} lector(es) RFID conectado(s)` : 'No hay lectores RFID conectados'}
            </p>
            <p className="text-xs text-gray-500">
              {onlineReaders.map(r => r.name).join(', ') || 'Configure lectores en Dispositivos ZKTeco'}
            </p>
          </div>
          {onlineReaders.length > 0 && (
            <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full font-medium flex items-center gap-1">
              <Zap size={12} /> Listo para escanear
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Buscar UID, etiqueta, cliente..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={cardType} onChange={e => setCardType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los tipos</option>
          <option value="permanent">Permanente</option>
          <option value="temporary">Temporal</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="assigned">Asignada</option>
          <option value="in_use">En uso</option>
          <option value="lost">Perdida</option>
          <option value="disabled">Deshabilitada</option>
        </select>
        <button onClick={() => { setShowRegister(true); setRegForm({ cardUid: '', cardType: 'temporary', label: '' }); setScannedUid(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Plus size={16} /> Registrar Tarjeta
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['UID', 'Etiqueta', 'Tipo', 'Estado', 'Cliente / Placa', 'Plan', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-8">No hay tarjetas RFID registradas</td></tr>
                ) : cards.map(card => (
                  <tr key={card.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 font-medium">{card.card_uid}</td>
                    <td className="px-4 py-3 text-gray-600">{card.label || '\u2014'}</td>
                    <td className="px-4 py-3">{typeBadge(card.card_type)}</td>
                    <td className="px-4 py-3">{statusBadge(card.status)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{card.customer_name || card.vehicle_plate || card.metadata?.vehicle_plate || '\u2014'}</span>
                        {card.customer_id && customerCardCounts[card.customer_id] > 1 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                            {cardPositionMap[card.id]} de {customerCardCounts[card.customer_id]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{card.plan_name || '\u2014'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {card.status === 'available' && card.card_type === 'permanent' && (
                          <>
                            <button onClick={() => openLinkFlow(card)}
                              className="px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200 flex items-center gap-1">
                              <Link2 size={12} /> Vincular
                            </button>
                            <button onClick={() => openAssignPermanent(card)}
                              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                              Asignar
                            </button>
                          </>
                        )}
                        {card.status === 'available' && card.card_type === 'temporary' && (
                          <button onClick={() => openAssignTemporary(card)}
                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">Asignar</button>
                        )}
                        {card.status === 'assigned' && card.card_type === 'temporary' && (
                          <button onClick={() => handleReturn(card)}
                            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Devolver</button>
                        )}
                        {card.status === 'assigned' && card.card_type === 'permanent' && (
                          <button onClick={() => handleReturn(card)}
                            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 flex items-center gap-1">
                            <Unlink size={12} /> Desvincular
                          </button>
                        )}
                        {card.status === 'in_use' && (
                          <button onClick={() => handleReportLost(card)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Perdida</button>
                        )}
                        {['available', 'assigned', 'in_use'].includes(card.status) && (
                          <button onClick={() => handleDisable(card)}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"><Ban size={12} /></button>
                        )}
                        {card.status === 'disabled' && (
                          <button onClick={() => handleEnable(card)}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                            <ShieldCheck size={12} /> Habilitar
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

      {/* ═══ REGISTER MODAL ═══ */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowRegister(false); stopScan(); }}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Registrar Tarjeta RFID</h2>
              <button onClick={() => { setShowRegister(false); stopScan(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* Reader scan section */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-teal-800 mb-2 flex items-center gap-2">
                <Scan size={16} /> Escanear desde Lector RFID
              </p>
              {onlineReaders.length === 0 ? (
                <p className="text-xs text-teal-600">No hay lectores RFID conectados. Puede ingresar el UID manualmente abajo.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={selectedReader} onChange={e => setSelectedReader(e.target.value)}
                      className="flex-1 text-sm border border-teal-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-teal-400 outline-none bg-white">
                      <option value="">Seleccionar lector...</option>
                      {onlineReaders.map(r => (
                        <option key={r.serial_number} value={r.serial_number}>
                          {r.name} ({r.model}) - {r.location}
                        </option>
                      ))}
                    </select>
                    {!scanning ? (
                      <button onClick={startScan} disabled={!selectedReader}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm">
                        <Scan size={14} /> Escanear
                      </button>
                    ) : (
                      <button onClick={stopScan}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm">
                        <X size={14} /> Detener
                      </button>
                    )}
                  </div>
                  {scanning && (
                    <div className="flex items-center gap-2 text-teal-700 text-sm animate-pulse">
                      <Loader size={14} className="animate-spin" /> Esperando tarjeta... Acerque la tarjeta al lector
                    </div>
                  )}
                  {scannedUid && (
                    <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-lg px-3 py-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm text-green-800">Tarjeta detectada: <strong className="font-mono">{scannedUid}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="text-xs text-gray-400 uppercase">o ingrese manualmente</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UID de Tarjeta *</label>
                <input value={regForm.cardUid}
                  onChange={e => setRegForm(f => ({ ...f, cardUid: e.target.value.toUpperCase() }))}
                  placeholder="Escanee o ingrese el UID (hex)"
                  required
                  className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${scannedUid ? 'border-green-400 bg-green-50' : ''}`} />
                <p className="text-[11px] text-gray-400 mt-1">Formato: 4, 7 o 10 bytes hexadecimal (ej: A1B2C3D4)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Tarjeta</label>
                <select value={regForm.cardType} onChange={e => setRegForm(f => ({ ...f, cardType: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="permanent">Permanente (para suscripciones)</option>
                  <option value="temporary">Temporal (parqueo por hora)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta (opcional)</label>
                <input value={regForm.label} onChange={e => setRegForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Tarjeta #042"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowRegister(false); stopScan(); }}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={regSaving}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 font-medium disabled:opacity-50">
                  {regSaving ? 'Registrando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ LINK FLOW MODAL: Card -> Customer -> Plan ═══ */}
      {showLinkFlow && selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLinkFlow(false)}>
          <div className="bg-white rounded-xl w-full max-w-xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Vincular Tarjeta RFID</h2>
              <button onClick={() => setShowLinkFlow(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* Card info */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center gap-3">
              <CreditCard size={20} className="text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-indigo-800">Tarjeta: <span className="font-mono">{selectedCard.card_uid}</span></p>
                {selectedCard.label && <p className="text-xs text-indigo-600">{selectedCard.label}</p>}
              </div>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-2 mb-5">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${linkStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <Users size={12} /> 1. Cliente
              </div>
              <ChevronRight size={14} className="text-gray-300" />
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${linkStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <CreditCard size={12} /> 2. Plan
              </div>
              <ChevronRight size={14} className="text-gray-300" />
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${linkStep >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                <CheckCircle size={12} /> 3. Confirmar
              </div>
            </div>

            {/* Step 1: Select Customer */}
            {linkStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Busque el cliente al que se asignara la tarjeta:</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchCustomers()}
                      placeholder="Nombre, cedula o telefono..."
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <button onClick={searchCustomers} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Buscar</button>
                </div>
                {customers.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                    {customers.map(c => (
                      <button key={c.id} onClick={() => selectCustomerForLink(c)}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {(c.first_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{c.first_name} {c.last_name}</p>
                          <p className="text-xs text-gray-500">{c.id_document || c.email || ''}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select Plan */}
            {linkStep === 2 && selectedCustomer && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {(selectedCustomer.first_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                    <p className="text-xs text-gray-500">{selectedCustomer.id_document || ''}</p>
                  </div>
                  <button onClick={() => { setLinkStep(1); setSelectedCustomer(null); }}
                    className="ml-auto text-xs text-indigo-600 hover:underline">Cambiar</button>
                </div>
                <p className="text-sm text-gray-600">Seleccione el plan/suscripcion:</p>
                {customerSubs.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <AlertTriangle size={20} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-amber-700">Este cliente no tiene suscripciones activas.</p>
                    <p className="text-xs text-amber-600 mt-1">Cree una suscripcion primero.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerSubs.map(sub => (
                      <button key={sub.id} onClick={() => { setSelectedSubForLink(sub.id); setLinkStep(3); }}
                        className={`w-full text-left px-4 py-3 border rounded-lg hover:border-indigo-400 transition-colors ${selectedSubForLink === sub.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{sub.plan_name || sub.plan?.name || 'Plan'}</p>
                            <p className="text-xs text-gray-500">
                              {sub.vehicle_plate || sub.vehicle?.plate || 'Sin vehiculo'} &middot; {sub.billing_frequency === 'monthly' ? 'Mensual' : sub.billing_frequency === 'weekly' ? 'Semanal' : sub.billing_frequency}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-indigo-600">RD$ {parseFloat(sub.price_per_period || 0).toLocaleString()}</p>
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Activa</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setLinkStep(1); setSelectedCustomer(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700">&larr; Volver a buscar cliente</button>
              </div>
            )}

            {/* Step 3: Confirm */}
            {linkStep === 3 && selectedCustomer && selectedSubForLink && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-green-800">Confirmar vinculacion:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-green-600" />
                      <span className="text-gray-600">Tarjeta:</span>
                      <span className="font-mono font-bold text-gray-800">{selectedCard.card_uid}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className="text-green-400" />
                      <Users size={14} className="text-green-600" />
                      <span className="text-gray-600">Cliente:</span>
                      <span className="font-medium text-gray-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className="text-green-400" />
                      <Zap size={14} className="text-green-600" />
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-medium text-gray-800">
                        {customerSubs.find(s => s.id === selectedSubForLink)?.plan_name || 'Plan seleccionado'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setLinkStep(2)} className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50">
                    &larr; Atras
                  </button>
                  <button onClick={handleLinkComplete}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2 hover:bg-green-700 font-medium flex items-center justify-center gap-2">
                    <Link2 size={16} /> Vincular Tarjeta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ASSIGN PERMANENT MODAL (Quick) ═══ */}
      {showAssignPermanent && selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignPermanent(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Asignar Tarjeta Permanente</h2>
              <button onClick={() => setShowAssignPermanent(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-500">Tarjeta: <span className="font-mono font-medium text-gray-800">{selectedCard.card_uid}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suscripcion Activa *</label>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-amber-600">No hay suscripciones activas.</p>
              ) : (
                <select value={assignSubId} onChange={e => setAssignSubId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Seleccione...</option>
                  {subscriptions.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.customer_name || `${sub.customer?.first_name || ''} ${sub.customer?.last_name || ''}`} \u2014 {sub.vehicle_plate || sub.vehicle?.plate || ''} \u2014 {sub.plan_name || sub.plan?.name || 'Plan'}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {assignSubId && (
              <div className="mt-4">
                {loadingSubCards ? <p className="text-xs text-gray-400">Cargando...</p>
                : existingSubCards.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-amber-800 font-medium">Ya tiene {existingSubCards.length} tarjeta(s).</p>
                    <div className="flex flex-wrap gap-1.5">
                      {existingSubCards.map(ec => (
                        <span key={ec.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-100 text-amber-800 border border-amber-300">
                          <CreditCard size={12} /> {ec.card_uid}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssignPermanent(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAssignPermanent} disabled={!assignSubId}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 font-medium disabled:opacity-50">
                {existingSubCards.length > 0 ? 'Asignar Adicional' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ASSIGN TEMPORARY MODAL ═══ */}
      {showAssignTemporary && selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignTemporary(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Asignar Tarjeta Temporal</h2>
              <button onClick={() => setShowAssignTemporary(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-500">Tarjeta: <span className="font-mono font-medium text-gray-800">{selectedCard.card_uid}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placa del Vehiculo *</label>
              <input value={assignPlate} onChange={e => setAssignPlate(e.target.value.toUpperCase())}
                placeholder="Ej: A123456"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAssignTemporary(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAssignTemporary} disabled={!assignPlate.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700 font-medium disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
