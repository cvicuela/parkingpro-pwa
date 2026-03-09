import { useState, useEffect, useCallback, useRef } from 'react';
import { accessAPI, plansAPI, rfidAPI, cashAPI } from '../services/api';
import { printEntryTicket, printPaymentReceipt, generateEntryTicketHTML, generatePaymentReceiptHTML } from '../services/printService';
import PrintPreviewModal from '../components/PrintPreviewModal';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import timeService from '../services/timeService';
import {
  LogIn, LogOut, Car, DollarSign, CheckCircle,
  RefreshCw, QrCode, Printer, X, Eye, Clock,
  CreditCard, Banknote, ArrowRight, ArrowLeft, Shield,
  Hash, Timer, Copy, AlertTriangle, Wifi, Radio,
  Wallet, ChevronDown, Send, FileText
} from 'lucide-react';

/* ─── Dominican Peso denominations ─── */
const DENOMINATIONS = [
  { value: 2000, label: 'RD$2,000' },
  { value: 1000, label: 'RD$1,000' },
  { value: 500, label: 'RD$500' },
  { value: 200, label: 'RD$200' },
  { value: 100, label: 'RD$100' },
  { value: 50, label: 'RD$50' },
  { value: 25, label: 'RD$25' },
  { value: 10, label: 'RD$10' },
  { value: 5, label: 'RD$5' },
  { value: 1, label: 'RD$1' },
];

/* ─── Occupancy sidebar ─── */
function OccupancyPanel({ plans }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="font-semibold text-gray-700 mb-3">Ocupacion en Tiempo Real</h3>
      <div className="space-y-3">
        {plans.map((p) => {
          const occ = p.current_occupancy || 0;
          const pct = p.max_capacity > 0 ? Math.round((occ / p.max_capacity) * 100) : 0;
          const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
          return (
            <div key={p.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{p.name}</span>
                <span className="font-medium">{occ}/{p.max_capacity}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all duration-300 ${color}`}
                  style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Countdown bar component ─── */
function CountdownBar({ seconds, total }) {
  const pct = Math.max(0, (seconds / total) * 100);
  const color = seconds <= 5 ? 'bg-red-500' : seconds <= 15 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
      <div className={`h-1.5 rounded-full transition-all duration-1000 ${color}`}
        style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─── Helpers ─── */
const fmtTime = (iso) => timeService.fmtTime(iso);
const fmtDateTime = (iso) => timeService.fmtDateTime(iso);
const fmtMoney = (n) => `RD$ ${parseFloat(n || 0).toFixed(2)}`;
const elapsed = (iso) => {
  const mins = Math.round((timeService.timestamp() - new Date(iso).getTime()) / 60000);
  return { mins, text: `${Math.floor(mins / 60)}h ${mins % 60}m` };
};

const POPUP_TIMEOUT = 30; // seconds

const sessionStatusLabel = (s) => {
  const map = { active: 'Activa', paid: 'Pagada', closed: 'Cerrada', abandoned: 'Abandonada' };
  return map[s] || s || 'Activa';
};
const sessionStatusColor = (s) => {
  const map = { active: 'bg-green-100 text-green-700', paid: 'bg-blue-100 text-blue-700', closed: 'bg-gray-100 text-gray-700', abandoned: 'bg-amber-100 text-amber-700' };
  return map[s] || 'bg-green-100 text-green-700';
};

export default function ControlAccesoPage() {
  // ── Core state ──
  const [plate, setPlate] = useState('');
  const [accessType, setAccessType] = useState('entry');
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Exit popup state (unified for click, QR scan, manual ID) ──
  const [exitPopup, setExitPopup] = useState(null);       // { session, feeData, payMethod, step: 'loading'|'fee'|'paying'|'receipt', receiptData }
  const [exitCountdown, setExitCountdown] = useState(POPUP_TIMEOUT);
  const exitTimerRef = useRef(null);
  const exitCountdownRef = useRef(null);

  // ── Entry popup state ──
  const [entryTicket, setEntryTicket] = useState(null);
  const [quickQr, setQuickQr] = useState(null);
  const quickQrTimer = useRef(null);

  // ── RFID state ──
  const [accessMethod, setAccessMethod] = useState('plate'); // 'plate' | 'rfid' | 'qr'
  const [rfidUid, setRfidUid] = useState('');

  // ── Print preview ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // ── Cash register state ──
  const [activeRegister, setActiveRegister] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(true);
  const [showOpenRegister, setShowOpenRegister] = useState(false);
  const [openingBalance, setOpeningBalance] = useState({});
  const [openingRegister, setOpeningRegister] = useState(false);

  // ── Cash payment popup state ──
  const [cashPopup, setCashPopup] = useState(null); // { total, denominations: {}, received: 0, change: 0 }

  // ── Card type state ──
  const [cardType, setCardType] = useState('visa');

  // ── Transfer reference state ──
  const [transferRef, setTransferRef] = useState('');

  const fetchActiveRegister = useCallback(async () => {
    try {
      const { data } = await cashAPI.active();
      const reg = data.data || data;
      setActiveRegister(reg && reg.id ? reg : null);
    } catch {
      setActiveRegister(null);
    } finally {
      setRegisterLoading(false);
    }
  }, []);

  useEffect(() => { fetchActiveRegister(); }, [fetchActiveRegister]);

  const handleOpenRegister = async () => {
    setOpeningRegister(true);
    try {
      const total = Object.entries(openingBalance).reduce((sum, [denom, qty]) => sum + (Number(denom) * Number(qty || 0)), 0);
      await cashAPI.open({ opening_balance: total, denominations: openingBalance });
      toast.success('Caja abierta exitosamente');
      setShowOpenRegister(false);
      setOpeningBalance({});
      await fetchActiveRegister();
    } catch (err) {
      toast.error(err.message || 'Error al abrir caja');
    } finally {
      setOpeningRegister(false);
    }
  };

  // ── Fetch sessions & plans ──
  const fetchOccupancy = useCallback(async () => {
    try {
      const [plansRes, sessionsRes] = await Promise.allSettled([plansAPI.list(), accessAPI.activeSessions()]);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data.data || plansRes.value.data || []);
      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value.data.data || sessionsRes.value.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchOccupancy();
    const interval = setInterval(fetchOccupancy, 5000);
    return () => clearInterval(interval);
  }, [fetchOccupancy]);

  // ── Cleanup all timers ──
  useEffect(() => {
    return () => {
      if (quickQrTimer.current) clearTimeout(quickQrTimer.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (exitCountdownRef.current) clearInterval(exitCountdownRef.current);
    };
  }, []);

  // ── Exit popup auto-close countdown ──
  const startExitCountdown = useCallback(() => {
    // Clear any existing
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (exitCountdownRef.current) clearInterval(exitCountdownRef.current);
    setExitCountdown(POPUP_TIMEOUT);

    exitCountdownRef.current = setInterval(() => {
      setExitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(exitCountdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    exitTimerRef.current = setTimeout(() => {
      setExitPopup(null);
      clearInterval(exitCountdownRef.current);
    }, POPUP_TIMEOUT * 1000);
  }, []);

  const stopExitCountdown = useCallback(() => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (exitCountdownRef.current) clearInterval(exitCountdownRef.current);
  }, []);

  const closeExitPopup = useCallback(() => {
    setExitPopup(null);
    stopExitCountdown();
  }, [stopExitCountdown]);

  // ── Reset on interaction (restart countdown) ──
  const resetCountdown = useCallback(() => {
    startExitCountdown();
  }, [startExitCountdown]);

  // ─────────────────────────────────────────────────
  // ENTRY FLOW
  // ─────────────────────────────────────────────────
  const handleEntry = async () => {
    // If exit popup is open, close it silently (like QR scan replacing)
    if (exitPopup) closeExitPopup();

    setLoading(true);
    try {
      // If RFID mode, resolve card first
      if (accessMethod === 'rfid' && rfidUid) {
        try {
          const { data: rfidResult } = await rfidAPI.resolve(rfidUid);
          const resolution = rfidResult.data || rfidResult;
          if (!resolution.allowed && resolution.reason) {
            toast.error(resolution.message || 'Tarjeta RFID no autorizada');
            setLoading(false);
            return;
          }
          // Use the resolved plate for the rest of the flow
          const resolvedPlate = resolution.subscription?.vehicle_plate || resolution.card?.metadata?.vehicle_plate || plate;
          if (resolvedPlate) setPlate(resolvedPlate);
          // Continue with normal flow using resolved plate
        } catch (err) {
          toast.error('Error al resolver tarjeta RFID');
          setLoading(false);
          return;
        }
      }

      const entryPlate = plate.trim() ? plate.toUpperCase().trim() : `SIN-${timeService.timestamp().toString(36).toUpperCase()}`;
      const { data } = await accessAPI.entry({ plateNumber: entryPlate });
      const session = data.data;
      toast.success('Entrada registrada');

      const ticketData = {
        plate: entryPlate,
        entryTime: session?.entry_time || timeService.nowISO(),
        type: session?.subscription_id ? 'subscriber' : 'hourly',
        planName: session?.subscription_id ? 'Suscriptor' : 'Por Hora',
        sessionId: session?.id,
        verificationCode: session?.verification_code || null,
        qrData: session?.verification_code || session?.id || entryPlate,
      };

      // Quick QR flash (2s) then full ticket
      setQuickQr(ticketData);
      if (quickQrTimer.current) clearTimeout(quickQrTimer.current);
      quickQrTimer.current = setTimeout(() => {
        setQuickQr(null);
        setEntryTicket(ticketData);
      }, 2000);

      setPlate('');
      setRfidUid('');
      fetchOccupancy();
    } catch (err) {
      toast.error(err.message || 'Error al registrar entrada');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────
  // EXIT FLOW — Opens popup, auto-calculates fee
  // ─────────────────────────────────────────────────
  const openExitPopup = useCallback(async (session) => {
    // If another popup is open, close it silently (QR scan behavior)
    if (exitPopup) {
      stopExitCountdown();
    }

    // Build session data
    const sessionData = {
      id: session.id,
      vehicle_plate: session.vehicle_plate || session.plate_number || '---',
      entry_time: session.entry_time,
      subscription_id: session.subscription_id || session.metadata?.subscription_id || null,
    };

    // Open popup in loading state
    setExitPopup({
      session: sessionData,
      feeData: null,
      payMethod: 'cash',
      step: 'loading',
      receiptData: null,
    });
    startExitCountdown();

    // Auto-calculate fee
    try {
      const { data } = await accessAPI.calculateFee({ sessionId: session.id });
      const fee = data.data;

      // Handle alert responses (e.g., no_session from gate verify)
      if (fee.action === 'alert' && fee.type === 'no_session') {
        setExitPopup(prev => prev ? {
          ...prev,
          step: 'no_session_alert',
          feeData: fee,
        } : null);
        toast.warning(fee.message || 'Vehiculo sin sesion activa');
        return;
      }

      // Subscriber or grace period = auto-exit
      if (fee.type === 'subscriber' || fee.type === 'grace_period') {
        try {
          await accessAPI.exit({ sessionId: session.id });
        } catch {}
        setExitPopup(prev => prev ? {
          ...prev,
          step: 'auto_exit',
          feeData: fee,
        } : null);
        toast.success(fee.message || 'Salida libre');
        fetchOccupancy();
        // Close after 3 seconds
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => closeExitPopup(), 3000);
        return;
      }

      setExitPopup(prev => prev ? {
        ...prev,
        step: 'fee',
        feeData: fee,
      } : null);
    } catch (err) {
      toast.error(err.message || 'Error al calcular tarifa');
      setExitPopup(prev => prev ? { ...prev, step: 'error', errorMsg: err.message } : null);
    }
  }, [exitPopup, startExitCountdown, stopExitCountdown, closeExitPopup, fetchOccupancy]);

  // Process payment inside popup
  const handlePopupPayment = async () => {
    if (!exitPopup?.feeData) return;

    // Check active register for cash payments
    if (!activeRegister) {
      toast.error('Debe abrir una sesion de caja antes de cobrar');
      setShowOpenRegister(true);
      return;
    }

    // For cash: open cash breakdown popup first
    if (exitPopup.payMethod === 'cash' && !cashPopup) {
      setCashPopup({ total: parseFloat(exitPopup.feeData.total), denominations: {}, received: 0 });
      return;
    }

    resetCountdown(); // keep alive
    const fee = exitPopup.feeData;
    setExitPopup(prev => prev ? { ...prev, step: 'paying' } : null);
    try {
      const paymentData = {
        sessionId: fee.sessionId,
        paymentMethod: exitPopup.payMethod,
      };
      // Add method-specific metadata
      if (exitPopup.payMethod === 'cash' && cashPopup) {
        paymentData.cashReceived = cashPopup.received;
        paymentData.cashChange = cashPopup.received - cashPopup.total;
        paymentData.cashDenominations = cashPopup.denominations;
      }
      if (exitPopup.payMethod === 'card') {
        paymentData.cardType = cardType;
      }
      if (exitPopup.payMethod === 'transfer') {
        paymentData.transferReference = transferRef;
      }

      const { data } = await accessAPI.processPayment(paymentData);
      const receipt = data.data.receipt;
      // Enrich receipt with payment details
      if (exitPopup.payMethod === 'cash' && cashPopup) {
        receipt.cashReceived = cashPopup.received;
        receipt.cashChange = cashPopup.received - cashPopup.total;
      }
      if (exitPopup.payMethod === 'card') receipt.cardType = cardType;
      if (exitPopup.payMethod === 'transfer') receipt.transferReference = transferRef;

      setExitPopup(prev => prev ? { ...prev, step: 'receipt', receiptData: receipt } : null);
      setCashPopup(null);
      setCardType('visa');
      setTransferRef('');
      toast.success('Pago procesado');
      fetchOccupancy();
      fetchActiveRegister(); // refresh register balance
      // Stop auto-close on receipt (user may want to print)
      stopExitCountdown();
    } catch (err) {
      toast.error(err.message || 'Error al procesar pago');
      setExitPopup(prev => prev ? { ...prev, step: 'fee' } : null);
    }
  };

  // Manual exit (no payment)
  const handlePopupManualExit = async () => {
    if (!exitPopup?.session) return;
    resetCountdown();
    try {
      await accessAPI.endSession(exitPopup.session.id);
      toast.success('Salida manual registrada');
      setExitPopup(prev => prev ? { ...prev, step: 'manual_done' } : null);
      fetchOccupancy();
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => closeExitPopup(), 4000);
    } catch (err) {
      toast.error(err.message || 'Error al registrar salida');
    }
  };

  // ── Open exit popup from plate/ID input ──
  const handleExitSearch = async () => {
    // If RFID mode, resolve card first
    if (accessMethod === 'rfid' && rfidUid) {
      setLoading(true);
      try {
        const { data: rfidResult } = await rfidAPI.resolve(rfidUid);
        const resolution = rfidResult.data || rfidResult;
        if (!resolution.allowed && resolution.reason) {
          toast.error(resolution.message || 'Tarjeta RFID no autorizada');
          setLoading(false);
          return;
        }
        const resolvedPlate = resolution.subscription?.vehicle_plate || resolution.card?.metadata?.vehicle_plate || plate;
        if (resolvedPlate) setPlate(resolvedPlate);
      } catch (err) {
        toast.error('Error al resolver tarjeta RFID');
        setLoading(false);
        return;
      }
    }

    const p = plate.toUpperCase().trim();
    if (!p) { toast.warning('Ingresa una placa o ID'); return; }
    setLoading(true);
    try {
      // Check if it's a UUID
      if (p.match(/^[0-9a-f-]{36}$/i)) {
        // Find session in current list or try direct
        const found = sessions.find(s => s.id === p);
        if (found) {
          openExitPopup(found);
        } else {
          // Try to calculate fee directly
          openExitPopup({ id: p, vehicle_plate: '---', entry_time: timeService.nowISO() });
        }
      } else {
        // Search by plate
        const found = sessions.find(s => (s.vehicle_plate || '').toUpperCase() === p);
        if (found) {
          openExitPopup(found);
        } else {
          // Try API
          try {
            const { data } = await accessAPI.sessionByPlate(p);
            const sess = data.data;
            if (sess) openExitPopup(sess);
            else toast.warning('No hay sesion activa para esta placa');
          } catch {
            toast.warning('No se encontro sesion activa');
          }
        }
      }
      setPlate('');
      setRfidUid('');
    } finally { setLoading(false); }
  };

  // ── Row click → open exit popup ──
  const handleRowClick = (session) => {
    openExitPopup(session);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Control de Acceso</h2>
        {!registerLoading && (
          activeRegister ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <Wallet size={14} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">Caja Activa</span>
            </div>
          ) : (
            <button onClick={() => setShowOpenRegister(true)}
              className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <Wallet size={14} className="text-red-500" />
              <span className="text-sm font-medium text-red-700">Abrir Caja</span>
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* ── Input bar ── */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex gap-3 mb-3">
              <button onClick={() => setAccessType('entry')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${accessType === 'entry' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <LogIn size={18} /> Entrada
              </button>
              <button onClick={() => setAccessType('exit')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${accessType === 'exit' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <LogOut size={18} /> Salida / Cobro
              </button>
            </div>
            {/* Access Method Selector */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setAccessMethod('plate')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${accessMethod === 'plate' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <Car size={14} /> Placa
              </button>
              <button onClick={() => setAccessMethod('rfid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${accessMethod === 'rfid' ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <Wifi size={14} /> RFID
              </button>
              <button onClick={() => setAccessMethod('qr')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${accessMethod === 'qr' ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <QrCode size={14} /> QR
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                {accessMethod === 'rfid' ? (
                  <>
                    <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      value={rfidUid}
                      onChange={(e) => setRfidUid(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && (accessType === 'entry' ? handleEntry() : handleExitSearch())}
                      placeholder="Escanee o ingrese UID de tarjeta RFID..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && (accessType === 'entry' ? handleEntry() : handleExitSearch())}
                      placeholder={accessType === 'entry' ? 'Placa del vehiculo (opcional)...' : 'Placa, ID de sesion o escanear QR...'}
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-mono uppercase" />
                  </>
                )}
              </div>
              {accessType === 'entry' ? (
                <button onClick={handleEntry} disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2">
                  {loading ? <RefreshCw size={20} className="animate-spin" /> : <><LogIn size={20} /> Entrada</>}
                </button>
              ) : (
                <button onClick={handleExitSearch} disabled={loading}
                  className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium flex items-center gap-2">
                  {loading ? <RefreshCw size={20} className="animate-spin" /> : <><DollarSign size={20} /> Buscar</>}
                </button>
              )}
            </div>
            {accessType === 'exit' && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <QrCode size={12} /> Tambien puedes hacer click en un vehiculo de la tabla para abrir el cobro
              </p>
            )}
          </div>

          {/* ── Sessions table ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-700">Vehiculos en Parqueo ({sessions.length})</h3>
              <button onClick={fetchOccupancy} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
            </div>
            {sessions.length === 0 ? (
              <p className="p-6 text-center text-gray-400">No hay vehiculos en el parqueo</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="py-2 px-4">Placa</th>
                      <th className="py-2 px-4">Entrada</th>
                      <th className="py-2 px-4">Tiempo</th>
                      <th className="py-2 px-4">Estado</th>
                      <th className="py-2 px-4">Tipo</th>
                      <th className="py-2 px-4">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const { mins, text: timeText } = elapsed(s.entry_time);
                      const isSub = !!(s.subscription_id || s.metadata?.subscription_id);
                      const displayPlate = s.vehicle_plate || s.plate_number || '---';
                      const shortId = s.id ? s.id.substring(0, 8) : '';
                      const isSelected = exitPopup?.session?.id === s.id;
                      return (
                        <tr key={s.id}
                          onClick={() => handleRowClick(s)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? 'bg-amber-50 border-l-4 border-l-amber-500' : 'hover:bg-indigo-50'}`}>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700 text-lg flex items-center gap-1.5">
                            {displayPlate}
                            {s.access_method === 'rfid' && <Wifi size={12} className="text-indigo-500" title="RFID" />}
                            {s.access_method === 'qr' && <QrCode size={12} className="text-purple-500" title="QR" />}
                          </td>
                          <td className="py-3 px-4 text-sm">{fmtTime(s.entry_time)}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded font-medium ${mins > 180 ? 'bg-red-100 text-red-700' : mins > 60 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              <Clock size={10} className="inline mr-1" />{timeText}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sessionStatusColor(s.status)}`}>
                              {sessionStatusLabel(s.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSub ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isSub ? 'Suscriptor' : 'Por hora'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-mono text-gray-400 hover:text-indigo-600 cursor-pointer"
                              title={`Click para copiar: ${s.id}`}
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(s.id); toast.info('ID copiado'); }}>
                              {shortId}...
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
        <div><OccupancyPanel plans={plans} /></div>
      </div>

      {/* ════════════════════════════════════════════════════════
          EXIT POPUP — Full-screen overlay for exit/payment
          Opens on: row click, plate search, QR scan
          Auto-closes after 30s if no interaction
          Dismissed silently if another QR is scanned
         ════════════════════════════════════════════════════════ */}
      {exitPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closeExitPopup}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => { e.stopPropagation(); resetCountdown(); }}>

            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <LogOut size={24} />
                <div>
                  <h3 className="font-bold text-lg">Salida de Vehiculo</h3>
                  <p className="text-amber-100 text-sm font-mono">{exitPopup.session.vehicle_plate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {exitPopup.step !== 'receipt' && (
                  <span className="text-amber-100 text-xs flex items-center gap-1">
                    <Timer size={12} /> {exitCountdown}s
                  </span>
                )}
                <button onClick={closeExitPopup} className="text-white/80 hover:text-white"><X size={20} /></button>
              </div>
            </div>

            {/* Countdown bar */}
            {exitPopup.step !== 'receipt' && exitPopup.step !== 'manual_done' && exitPopup.step !== 'auto_exit' && exitPopup.step !== 'no_session_alert' && (
              <CountdownBar seconds={exitCountdown} total={POPUP_TIMEOUT} />
            )}

            <div className="p-5">
              {/* ── LOADING state ── */}
              {exitPopup.step === 'loading' && (
                <div className="text-center py-8">
                  <RefreshCw size={40} className="animate-spin text-amber-500 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Calculando tarifa...</p>
                  <p className="text-sm text-gray-400">Entrada: {fmtDateTime(exitPopup.session.entry_time)}</p>
                </div>
              )}

              {/* ── ERROR state ── */}
              {exitPopup.step === 'error' && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <X className="text-red-600" size={32} />
                  </div>
                  <p className="text-red-700 font-medium">{exitPopup.errorMsg || 'Error al calcular'}</p>
                  <div className="flex gap-2">
                    <button onClick={closeExitPopup}
                      className="flex-1 border border-gray-300 rounded-lg py-2 text-gray-600 hover:bg-gray-50">
                      Cerrar
                    </button>
                    <button onClick={handlePopupManualExit}
                      className="flex-1 bg-red-600 text-white rounded-lg py-2 hover:bg-red-700 flex items-center justify-center gap-1">
                      <LogOut size={16} /> Salida Manual
                    </button>
                  </div>
                </div>
              )}

              {/* ── NO SESSION ALERT ── */}
              {exitPopup.step === 'no_session_alert' && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="text-amber-600" size={40} />
                  </div>
                  <p className="text-xl font-bold text-amber-700">Sin Sesion Activa</p>
                  <p className="text-gray-500">{exitPopup.feeData?.message || 'Este vehiculo no tiene una sesion de estacionamiento activa. No se puede abrir la barrera.'}</p>
                  <p className="text-3xl font-mono font-bold text-indigo-700">{exitPopup.session.vehicle_plate}</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <p className="font-medium">Accion requerida:</p>
                    <p>Verifique el vehiculo y registre una entrada antes de permitir la salida, o contacte al administrador.</p>
                  </div>
                  <button onClick={closeExitPopup}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-gray-700 hover:bg-gray-50 font-medium">
                    Cerrar
                  </button>
                </div>
              )}

              {/* ── AUTO EXIT (subscriber/grace) ── */}
              {exitPopup.step === 'auto_exit' && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="text-green-600" size={40} />
                  </div>
                  <p className="text-xl font-bold text-green-700">Salida Libre</p>
                  <p className="text-gray-500">{exitPopup.feeData?.message || 'Suscriptor activo o periodo de gracia'}</p>
                  <p className="text-3xl font-mono font-bold text-indigo-700">{exitPopup.session.vehicle_plate}</p>
                  <p className="text-sm text-gray-400">Abrir barrera</p>
                </div>
              )}

              {/* ── MANUAL EXIT DONE ── */}
              {exitPopup.step === 'manual_done' && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <LogOut className="text-blue-600" size={40} />
                  </div>
                  <p className="text-xl font-bold text-blue-700">Salida Manual</p>
                  <p className="text-gray-500">Sesion cerrada sin cobro</p>
                  <p className="text-3xl font-mono font-bold text-indigo-700">{exitPopup.session.vehicle_plate}</p>
                </div>
              )}

              {/* ── FEE DISPLAY + PAYMENT ── */}
              {(exitPopup.step === 'fee' || exitPopup.step === 'paying') && exitPopup.feeData && (() => {
                const fee = exitPopup.feeData;
                return (
                  <div className="space-y-4">
                    {/* Session info */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Placa</span>
                        <span className="text-2xl font-mono font-bold text-indigo-700">{fee.plateNumber || exitPopup.session.vehicle_plate}</span>
                      </div>
                      {fee.brand && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Vehiculo</span>
                          <span>{fee.brand} {fee.model} {fee.color}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Entrada</span>
                        <span className="font-medium">{fmtDateTime(fee.entryTime || exitPopup.session.entry_time)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Ahora</span>
                        <span className="font-medium">{fmtTime(fee.exitTime || timeService.nowISO())}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tiempo</span>
                        <span className="font-medium flex items-center gap-1">
                          <Clock size={12} />
                          {Math.floor((fee.minutes || 0) / 60)}h {(fee.minutes || 0) % 60}m ({fee.hours}h facturadas)
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tarifa</span>
                        <span>{fmtMoney(fee.ratePerHour)}/hora</span>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm"><span>Subtotal</span><span>{fmtMoney(fee.subtotal)}</span></div>
                      <div className="flex justify-between text-xs text-gray-500"><span>ITBIS (18%)</span><span>{fmtMoney(fee.tax)}</span></div>
                      <div className="border-t pt-2 flex justify-between text-xl font-bold text-green-700">
                        <span>TOTAL</span><span>{fmtMoney(fee.total)}</span>
                      </div>
                    </div>

                    {/* Cash register status banner */}
                    {!activeRegister && !registerLoading && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-700">Caja no abierta</p>
                          <p className="text-xs text-red-500">Debe abrir una sesion de caja para procesar pagos</p>
                        </div>
                        <button onClick={() => setShowOpenRegister(true)}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 font-medium whitespace-nowrap">
                          Abrir Caja
                        </button>
                      </div>
                    )}
                    {activeRegister && (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Wallet size={14} className="text-green-600" />
                        <span className="text-xs text-green-700 font-medium">Caja activa</span>
                        <span className="text-xs text-green-600">{activeRegister.register_name || 'Principal'}</span>
                      </div>
                    )}

                    {/* Payment method */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Metodo de Pago</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'cash', label: 'Efectivo', icon: Banknote },
                          { id: 'card', label: 'Tarjeta', icon: CreditCard },
                          { id: 'transfer', label: 'Transfer.', icon: Send },
                        ].map(({ id, label, icon: Icon }) => (
                          <button key={id}
                            onClick={() => setExitPopup(prev => prev ? { ...prev, payMethod: id } : null)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-colors ${exitPopup.payMethod === id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            <Icon size={20} /><span className="text-xs font-medium">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Card type selector */}
                    {exitPopup.payMethod === 'card' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-blue-800">Tipo de Tarjeta</p>
                        <select value={cardType} onChange={(e) => setCardType(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="visa">Visa</option>
                          <option value="mastercard">Mastercard</option>
                          <option value="amex">American Express</option>
                          <option value="otra">Otra</option>
                        </select>
                      </div>
                    )}

                    {/* Transfer reference */}
                    {exitPopup.payMethod === 'transfer' && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-purple-800">Referencia de Transferencia</p>
                        <textarea value={transferRef} onChange={(e) => setTransferRef(e.target.value)}
                          placeholder="Numero de referencia, banco emisor, notas..."
                          rows={2}
                          className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none resize-none" />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handlePopupManualExit}
                        className="px-3 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium flex items-center gap-1">
                        <LogOut size={14} /> Sin cobro
                      </button>
                      <button onClick={handlePopupPayment} disabled={exitPopup.step === 'paying'}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-2.5 hover:bg-green-700 disabled:opacity-50 font-bold text-lg">
                        {exitPopup.step === 'paying'
                          ? <RefreshCw size={20} className="animate-spin" />
                          : <><CheckCircle size={20} /> Cobrar {fmtMoney(fee.total)}</>
                        }
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── RECEIPT ── */}
              {exitPopup.step === 'receipt' && exitPopup.receiptData && (() => {
                const r = exitPopup.receiptData;
                return (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <CheckCircle className="text-green-600" size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-green-700">Pago Completado</h3>
                      <p className="text-gray-500 text-sm">El vehiculo puede salir</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Placa</span><span className="font-bold text-lg text-indigo-700">{r.plateNumber}</span></div>
                      {r.invoiceNumber && <div className="flex justify-between"><span className="text-gray-500">Factura</span><span>{r.invoiceNumber}</span></div>}
                      {r.ncf && <div className="flex justify-between"><span className="text-gray-500">NCF</span><span>{r.ncf}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-green-700 text-lg">{fmtMoney(r.total)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Metodo</span><span>{{ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }[r.paymentMethod]}</span></div>
                      {r.cardType && <div className="flex justify-between"><span className="text-gray-500">Tarjeta</span><span className="capitalize">{r.cardType}</span></div>}
                      {r.transferReference && <div className="flex justify-between"><span className="text-gray-500">Referencia</span><span className="text-xs">{r.transferReference}</span></div>}
                      {r.cashReceived > 0 && (
                        <>
                          <div className="flex justify-between"><span className="text-gray-500">Recibido</span><span className="font-medium">{fmtMoney(r.cashReceived)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Devuelta</span><span className="font-bold text-blue-700">{fmtMoney(r.cashChange)}</span></div>
                        </>
                      )}
                      {r.code && <div className="flex justify-between"><span className="text-gray-500">Codigo</span><span className="font-mono">{r.code}</span></div>}
                      {r.verification_code && <div className="flex justify-between"><span className="text-gray-500">Verificacion</span><span className="font-mono font-bold text-indigo-700">{r.verification_code}</span></div>}
                    </div>
                    <div className="text-center">
                      <div className="mx-auto w-36 h-36 flex items-center justify-center">
                        <QRCodeSVG value={r.code || r.invoiceNumber || 'N/A'} size={140} level="M" />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Presente este QR para salir</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        setPreviewHtml(await generatePaymentReceiptHTML({ receipt: r }));
                        setPreviewTitle('Recibo de Pago');
                        setPreviewOpen(true);
                      }} className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-lg py-2.5 hover:bg-gray-200 font-medium text-sm">
                        <Eye size={16} /> Vista Previa
                      </button>
                      <button onClick={() => printPaymentReceipt({ receipt: r })}
                        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-2.5 hover:bg-indigo-700 font-medium text-sm">
                        <Printer size={16} /> Imprimir
                      </button>
                    </div>
                    <button onClick={closeExitPopup}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-2.5 hover:bg-green-700 font-medium">
                      <ArrowRight size={18} /> Siguiente Vehiculo
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick QR Flash (2s on entry) ── */}
      {quickQr && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => { setQuickQr(null); setEntryTicket(quickQr); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-56 h-56 flex items-center justify-center mb-4">
              <QRCodeSVG value={quickQr.qrData} size={220} level="M" />
            </div>
            <p className="text-3xl font-mono font-bold text-indigo-700 mb-2">{quickQr.plate}</p>
            <p className="text-green-600 font-semibold text-lg">Entrada Registrada</p>
            <p className="text-xs text-gray-400 mt-2">Desaparece en 2 segundos...</p>
          </div>
        </div>
      )}

      {/* ── Entry Ticket Modal (after quick flash) ── */}
      {entryTicket && !quickQr && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setEntryTicket(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="text-indigo-600" size={24} />
                <h3 className="text-lg font-bold text-gray-800">Ticket de Entrada</h3>
              </div>
              <button onClick={() => setEntryTicket(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="text-center space-y-3">
              <div className="mx-auto w-48 h-48 flex items-center justify-center">
                <QRCodeSVG value={entryTicket.qrData} size={180} level="M" />
              </div>
              <p className="text-2xl font-mono font-bold text-indigo-700">{entryTicket.plate}</p>
              <p className="text-sm text-gray-500">Entrada: {fmtTime(entryTicket.entryTime)}</p>
              <p className="text-sm text-gray-500">{entryTicket.type === 'subscriber' ? 'Suscriptor' : 'Por Hora'}</p>
              {entryTicket.verificationCode && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
                  <p className="text-xs text-indigo-500 mb-0.5">Codigo de Verificacion</p>
                  <p className="text-lg font-mono font-bold text-indigo-700 tracking-wider cursor-pointer"
                    onClick={() => { navigator.clipboard.writeText(entryTicket.verificationCode); toast.info('Codigo copiado'); }}>
                    {entryTicket.verificationCode}
                  </p>
                </div>
              )}
              {entryTicket.sessionId && (
                <p className="text-xs text-gray-400 font-mono cursor-pointer flex items-center justify-center gap-1"
                  title={entryTicket.sessionId}
                  onClick={() => { navigator.clipboard.writeText(entryTicket.sessionId); toast.info('ID copiado'); }}>
                  <Copy size={10} /> {entryTicket.sessionId.substring(0, 12)}...
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={async () => {
                  setPreviewHtml(await generateEntryTicketHTML(entryTicket));
                  setPreviewTitle('Ticket de Entrada');
                  setPreviewOpen(true);
                }} className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 rounded-lg py-2 hover:bg-gray-200">
                  <Eye size={16} /> Vista Previa
                </button>
                <button onClick={() => printEntryTicket(entryTicket)}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700">
                  <Printer size={16} /> Imprimir
                </button>
              </div>
              <button onClick={() => setEntryTicket(null)}
                className="w-full mt-2 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          CASH BREAKDOWN POPUP — Shows when paying with cash
         ════════════════════════════════════════════════════════ */}
      {cashPopup && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={() => setCashPopup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Banknote size={22} />
                <div>
                  <h3 className="font-bold">Pago en Efectivo</h3>
                  <p className="text-green-100 text-sm">Total: {fmtMoney(cashPopup.total)}</p>
                </div>
              </div>
              <button onClick={() => setCashPopup(null)} className="text-white/80 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500 font-medium uppercase">Desglose del dinero recibido</p>
              <div className="grid grid-cols-2 gap-2">
                {DENOMINATIONS.map(({ value, label }) => (
                  <div key={value} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-600 w-20">{label}</span>
                    <input type="number" min="0"
                      value={cashPopup.denominations[value] || ''}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        setCashPopup(prev => {
                          const newDenoms = { ...prev.denominations, [value]: qty };
                          const received = Object.entries(newDenoms).reduce((sum, [d, q]) => sum + (Number(d) * Number(q || 0)), 0);
                          return { ...prev, denominations: newDenoms, received };
                        });
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {/* Quick amount buttons */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Monto rapido</p>
                <div className="flex gap-1 flex-wrap">
                  {[50, 100, 200, 500, 1000, 2000].map(amt => (
                    <button key={amt} onClick={() => {
                      setCashPopup(prev => ({ ...prev, received: amt, denominations: { [amt]: 1 } }));
                    }} className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                      cashPopup.received === amt ? 'bg-green-100 border-green-400 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 border">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total a cobrar</span>
                  <span className="font-bold text-gray-800">{fmtMoney(cashPopup.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Recibido</span>
                  <span className={`font-bold ${cashPopup.received >= cashPopup.total ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtMoney(cashPopup.received)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold text-gray-700">Devuelta</span>
                  <span className={`text-xl font-bold ${cashPopup.received >= cashPopup.total ? 'text-blue-700' : 'text-red-600'}`}>
                    {cashPopup.received >= cashPopup.total
                      ? fmtMoney(cashPopup.received - cashPopup.total)
                      : `Faltan ${fmtMoney(cashPopup.total - cashPopup.received)}`
                    }
                  </span>
                </div>
              </div>

              <button onClick={() => {
                if (cashPopup.received < cashPopup.total) {
                  toast.warning('El monto recibido es menor al total');
                  return;
                }
                handlePopupPayment();
              }} disabled={cashPopup.received < cashPopup.total}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-3 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg">
                <CheckCircle size={20} /> Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          OPEN CASH REGISTER MODAL
         ════════════════════════════════════════════════════════ */}
      {showOpenRegister && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={() => setShowOpenRegister(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Wallet size={22} />
                <div>
                  <h3 className="font-bold">Abrir Sesion de Caja</h3>
                  <p className="text-blue-100 text-sm">Registre el efectivo inicial</p>
                </div>
              </div>
              <button onClick={() => setShowOpenRegister(false)} className="text-white/80 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 font-medium">Conteo de efectivo inicial</p>
                <p className="text-xs text-blue-600">Ingrese la cantidad de cada denominacion con la que inicia la caja</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {DENOMINATIONS.map(({ value, label }) => (
                  <div key={value} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-600 w-20">{label}</span>
                    <input type="number" min="0"
                      value={openingBalance[value] || ''}
                      onChange={(e) => setOpeningBalance(prev => ({ ...prev, [value]: parseInt(e.target.value) || 0 }))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Balance Inicial</span>
                  <span className="text-xl font-bold text-blue-700">
                    {fmtMoney(Object.entries(openingBalance).reduce((sum, [d, q]) => sum + (Number(d) * Number(q || 0)), 0))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowOpenRegister(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2.5 text-gray-600 hover:bg-gray-50 font-medium">
                  Cancelar
                </button>
                <button onClick={handleOpenRegister} disabled={openingRegister}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 hover:bg-blue-700 disabled:opacity-50 font-bold">
                  {openingRegister ? <RefreshCw size={16} className="animate-spin" /> : <Wallet size={16} />}
                  Abrir Caja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PrintPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} html={previewHtml} title={previewTitle} />
    </div>
  );
}
