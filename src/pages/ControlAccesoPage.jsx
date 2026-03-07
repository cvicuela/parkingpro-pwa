import { useState, useEffect, useCallback } from 'react';
import { accessAPI, plansAPI } from '../services/api';
import { printEntryTicket, printPaymentReceipt } from '../services/printService';
import { toast } from 'react-toastify';
import {
  LogIn, LogOut, Car, DollarSign, CheckCircle,
  RefreshCw, QrCode, Printer, X,
  CreditCard, Banknote, ArrowRight, ArrowLeft, Shield
} from 'lucide-react';

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

const STEPS = { IDLE: 0, CONFIRM: 1, RECEIPT: 2 };

export default function ControlAccesoPage() {
  const [plate, setPlate] = useState('');
  const [accessType, setAccessType] = useState('entry');
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(STEPS.IDLE);
  const [feeData, setFeeData] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [receiptData, setReceiptData] = useState(null);
  const [entryTicket, setEntryTicket] = useState(null);

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

  const resetWizard = () => { setStep(STEPS.IDLE); setFeeData(null); setPayMethod('cash'); setReceiptData(null); setEntryTicket(null); setPlate(''); };

  // ── ENTRY ──
  const handleEntry = async () => {
    setLoading(true);
    try {
      const entryPlate = plate.trim() ? plate.toUpperCase().trim() : `SIN-${Date.now().toString(36).toUpperCase()}`;
      const { data } = await accessAPI.entry({ plateNumber: entryPlate });
      const session = data.data;
      toast.success('Entrada registrada');
      setEntryTicket({
        plate: entryPlate,
        entryTime: session?.entry_time || new Date().toISOString(),
        type: session?.subscription_id ? 'subscriber' : 'hourly',
        planName: session?.subscription_id ? 'Suscriptor' : 'Por Hora',
        sessionId: session?.id,
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(session?.id || entryPlate)}&size=300x300`
      });
      fetchOccupancy();
    } catch (err) { toast.error(err.message || 'Error al registrar entrada'); } finally { setLoading(false); }
  };

  // ── CALCULATE FEE ──
  const handleCalculateFee = async (plateOrId) => {
    const p = (typeof plateOrId === 'string' ? plateOrId : plate).toUpperCase().trim();
    if (!p) { toast.warning('Ingresa una placa'); return; }
    setLoading(true);
    try {
      const params = p.match(/^[0-9a-f-]{36}$/i) ? { sessionId: p } : { plateNumber: p };
      const { data } = await accessAPI.calculateFee(params);
      const fee = data.data;
      if (fee.type === 'subscriber' || fee.type === 'grace_period') {
        await accessAPI.exit({ plateNumber: fee.plateNumber || p });
        toast.success(fee.message);
        resetWizard(); fetchOccupancy(); return;
      }
      setPlate(fee.plateNumber || p);
      setFeeData(fee);
      setStep(STEPS.CONFIRM);
    } catch (err) { toast.error(err.message || 'Error al calcular tarifa'); } finally { setLoading(false); }
  };

  // ── PROCESS PAYMENT ──
  const handleProcessPayment = async () => {
    if (!feeData) return;
    setLoading(true);
    try {
      const { data } = await accessAPI.processPayment({
        sessionId: feeData.sessionId, amount: feeData.subtotal,
        tax: feeData.tax, total: feeData.total, hours: feeData.hours, paymentMethod: payMethod
      });
      setReceiptData(data.data.receipt);
      setStep(STEPS.RECEIPT);
      toast.success('Pago procesado');
      fetchOccupancy();
    } catch (err) { toast.error(err.message || 'Error al procesar pago'); } finally { setLoading(false); }
  };

  const handleQuickPay = (s) => handleCalculateFee(s.id);
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  const fmtMoney = (n) => `RD$ ${parseFloat(n || 0).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Control de Acceso</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* ── STEP 0: Input ── */}
          {step === STEPS.IDLE && (<>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex gap-3 mb-3">
                <button onClick={() => setAccessType('entry')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${accessType === 'entry' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <LogIn size={18} /> Entrada
                </button>
                <button onClick={() => setAccessType('exit')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${accessType === 'exit' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <LogOut size={18} /> Salida / Cobro
                </button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (accessType === 'entry' ? handleEntry() : handleCalculateFee())}
                    placeholder="Placa del vehiculo (opcional)..." autoFocus
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-mono uppercase" />
                </div>
                {accessType === 'entry' ? (
                  <button onClick={handleEntry} disabled={loading}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2">
                    {loading ? <RefreshCw size={20} className="animate-spin" /> : <><LogIn size={20} /> Entrada</>}
                  </button>
                ) : (
                  <button onClick={() => handleCalculateFee()} disabled={loading}
                    className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium flex items-center gap-2">
                    {loading ? <RefreshCw size={20} className="animate-spin" /> : <><DollarSign size={20} /> Calcular</>}
                  </button>
                )}
              </div>
            </div>

            {/* Sessions Table */}
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
                      <tr><th className="py-2 px-4">Placa</th><th className="py-2 px-4">Entrada</th><th className="py-2 px-4">Tiempo</th><th className="py-2 px-4">Tipo</th><th className="py-2 px-4">Accion</th></tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => {
                        const mins = Math.round((Date.now() - new Date(s.entry_time).getTime()) / 60000);
                        const isSub = !!s.subscription_id;
                        return (
                          <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 font-mono font-bold text-indigo-700">{s.plate_number || '---'}</td>
                            <td className="py-2 px-4 text-sm">{fmtTime(s.entry_time)}</td>
                            <td className="py-2 px-4"><span className={`text-xs px-2 py-0.5 rounded font-medium ${mins > 180 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{Math.floor(mins/60)}h {mins%60}m</span></td>
                            <td className="py-2 px-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSub ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{isSub ? 'Suscriptor' : 'Por hora'}</span></td>
                            <td className="py-2 px-4">
                              <button onClick={() => handleQuickPay(s)} className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium flex items-center gap-1">
                                <DollarSign size={12} /> Cobrar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>)}

          {/* ── STEP 1: Confirm Payment ── */}
          {step === STEPS.CONFIRM && feeData && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><DollarSign className="text-green-600" size={24} /> Confirmar Pago</h3>
                <button onClick={resetWizard} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center"><span className="text-gray-500">Placa</span><span className="text-2xl font-mono font-bold text-indigo-700">{feeData.plateNumber}</span></div>
                {feeData.brand && <div className="flex justify-between text-sm"><span className="text-gray-500">Vehiculo</span><span>{feeData.brand} {feeData.model} {feeData.color}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-gray-500">Entrada</span><span className="font-medium">{fmtTime(feeData.entryTime)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Salida</span><span className="font-medium">{fmtTime(feeData.exitTime)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Tiempo</span><span className="font-medium">{Math.floor(feeData.minutes/60)}h {feeData.minutes%60}m ({feeData.hours}h facturadas)</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Tarifa</span><span>{fmtMoney(feeData.ratePerHour)}/hora</span></div>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(feeData.subtotal)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>ITBIS (18%)</span><span>{fmtMoney(feeData.tax)}</span></div>
                <div className="border-t pt-2 flex justify-between text-xl font-bold text-green-700"><span>TOTAL</span><span>{fmtMoney(feeData.total)}</span></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Metodo de Pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ id:'cash', label:'Efectivo', icon:Banknote }, { id:'card', label:'Tarjeta', icon:CreditCard }, { id:'transfer', label:'Transferencia', icon:Shield }].map(({id, label, icon:Icon}) => (
                    <button key={id} onClick={() => setPayMethod(id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${payMethod === id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      <Icon size={24} /><span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={resetWizard} className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-3 text-gray-700 hover:bg-gray-50 font-medium"><ArrowLeft size={18} /> Cancelar</button>
                <button onClick={handleProcessPayment} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-3 hover:bg-green-700 disabled:opacity-50 font-bold text-lg">
                  {loading ? <RefreshCw size={20} className="animate-spin" /> : <><CheckCircle size={20} /> Cobrar {fmtMoney(feeData.total)}</>}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Receipt ── */}
          {step === STEPS.RECEIPT && receiptData && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle className="text-green-600" size={32} /></div>
                <h3 className="text-xl font-bold text-green-700">Pago Completado</h3>
                <p className="text-gray-500">El vehiculo puede salir del parqueo</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Placa</span><span className="font-bold text-lg">{receiptData.plateNumber}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Factura</span><span>{receiptData.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">NCF</span><span>{receiptData.ncf}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-green-700 text-lg">{fmtMoney(receiptData.total)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Metodo</span><span>{{cash:'Efectivo',card:'Tarjeta',transfer:'Transferencia'}[receiptData.paymentMethod]}</span></div>
                {receiptData.code && <div className="flex justify-between"><span className="text-gray-500">Codigo</span><span className="font-mono">{receiptData.code}</span></div>}
              </div>
              <div className="text-center">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(receiptData.code || receiptData.invoiceNumber)}&size=200x200`} alt="QR" className="mx-auto w-40 h-40" />
                <p className="text-xs text-gray-400 mt-1">Presente este QR para salir</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => printPaymentReceipt({ receipt: receiptData })}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-3 hover:bg-indigo-700 font-medium"><Printer size={18} /> Imprimir Recibo</button>
                <button onClick={resetWizard}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg py-3 hover:bg-green-700 font-medium"><ArrowRight size={18} /> Siguiente</button>
              </div>
            </div>
          )}
        </div>
        <div><OccupancyPanel plans={plans} /></div>
      </div>

      {/* Entry Ticket Modal */}
      {entryTicket && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEntryTicket(null); resetWizard(); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><QrCode className="text-indigo-600" size={24} /><h3 className="text-lg font-bold text-gray-800">Ticket de Entrada</h3></div>
              <button onClick={() => { setEntryTicket(null); resetWizard(); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="text-center space-y-3">
              <img src={entryTicket.qrUrl} alt="QR" className="mx-auto w-48 h-48" />
              <p className="text-2xl font-mono font-bold text-indigo-700">{entryTicket.plate}</p>
              <p className="text-sm text-gray-500">Entrada: {new Date(entryTicket.entryTime).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-sm text-gray-500">{entryTicket.type === 'subscriber' ? 'Suscriptor' : 'Por Hora'}</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => printEntryTicket(entryTicket)}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700"><Printer size={16} /> Imprimir Ticket</button>
                <button onClick={() => { setEntryTicket(null); resetWizard(); }}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 text-gray-700 hover:bg-gray-50">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
