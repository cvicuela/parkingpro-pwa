import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Wallet, Lock, Unlock, CheckCircle, AlertTriangle, Plus, Minus,
  List, Eye, X, DollarSign, Clock, TrendingUp, TrendingDown, ArrowUpDown,
  CreditCard, Banknote, ArrowRightLeft
} from 'lucide-react';
import { cashAPI, operatorsAPI } from '../services/api';
import { generateCashReportHTML } from '../services/printService';
import PrintPreviewModal from '../components/PrintPreviewModal';
import { useAuth } from '../context/AuthContext';
import timeService from '../services/timeService';

const DENOMINATIONS = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1];

export default function CajaPage() {
  const { user } = useAuth();
  const [register, setRegister] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [limits, setLimits] = useState({ differenceThreshold: 200, refundLimitOperator: 500 });
  const [loading, setLoading] = useState(true);

  // Modals
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Open form
  const [openForm, setOpenForm] = useState({ openingBalance: '', name: 'Caja Principal', operatorId: '' });
  const [opening, setOpening] = useState(false);

  // Close form
  const [denomCounts, setDenomCounts] = useState({});
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing] = useState(false);

  /* ─── FETCH ─── */
  const fetchActive = useCallback(async () => {
    try {
      const [regRes, limRes] = await Promise.all([
        cashAPI.active(),
        cashAPI.limits().catch(() => ({ data: { data: limits } }))
      ]);

      const regData = regRes.data.data;
      if (regData && regData.register) {
        // RPC returns { register: {...}, transactions: [...] }
        setRegister(regData.register);
        setTransactions(regData.transactions || []);
      } else if (regData && regData.id) {
        // Direct register object
        setRegister(regData);
        try {
          const txRes = await cashAPI.transactions(regData.id);
          setTransactions(txRes.data.data || []);
        } catch { setTransactions([]); }
      } else {
        setRegister(null);
        setTransactions([]);
      }

      if (limRes.data?.data) setLimits(limRes.data.data);
    } catch {
      setRegister(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  /* ─── CALCULATIONS ─── */
  const totalIn = transactions
    .filter(t => t.direction === 'in' && t.type !== 'opening_float')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalOut = transactions
    .filter(t => t.direction === 'out')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const openingBal = register ? parseFloat(register.opening_balance || 0) : 0;
  const currentBalance = openingBal + totalIn - totalOut;

  // Desglose por método de pago — siempre calcular de transacciones locales para consistencia
  const totalCard = transactions
    .filter(t => t.direction === 'in' && t.payment_method === 'card')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalTransfer = transactions
    .filter(t => t.direction === 'in' && t.payment_method === 'transfer')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const cashIn = transactions
    .filter(t => t.direction === 'in' && t.type !== 'opening_float' && (!t.payment_method || t.payment_method === 'cash'))
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const cashOut = transactions
    .filter(t => t.direction === 'out' && (!t.payment_method || t.payment_method === 'cash'))
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  // Solo efectivo esperado en caja física
  const expectedCash = cashIn - cashOut;

  const countedBalance = DENOMINATIONS.reduce((acc, d) =>
    acc + (d * (parseInt(denomCounts[d]) || 0)), 0);
  // La diferencia se calcula contra el efectivo esperado, no el total general
  const expectedBalance = currentBalance;
  const difference = countedBalance - expectedCash;
  const threshold = limits.differenceThreshold || 200;

  /* ─── OPEN ─── */
  const handleOpen = async (e) => {
    e.preventDefault();
    setOpening(true);
    try {
      await cashAPI.open({
        ...openForm,
        openingBalance: parseFloat(openForm.openingBalance) || 0
      });
      toast.success('Caja abierta correctamente');
      setShowOpen(false);
      setOpenForm({ openingBalance: '', name: 'Caja Principal', operatorId: '' });
      fetchActive();
    } catch (err) {
      toast.error(err.message || 'Error abriendo caja');
    } finally {
      setOpening(false);
    }
  };

  /* ─── CLOSE ─── */
  const handleClose = async (e) => {
    e.preventDefault();
    setClosing(true);
    const denominations = DENOMINATIONS
      .filter(d => parseInt(denomCounts[d]) > 0)
      .map(d => ({ denomination: d, quantity: parseInt(denomCounts[d]) }));
    try {
      const res = await cashAPI.close(register.id, {
        countedBalance,
        denominations,
        notes: closeNotes
      });
      const data = res.data.data;
      if (data?.requires_approval) {
        const diff = parseFloat(data.difference || 0);
        const diffStr = Math.abs(diff).toLocaleString('es-DO', { minimumFractionDigits: 2 });
        toast.warn(
          `Caja cerrada con ${diff < 0 ? 'faltante' : 'sobrante'} de RD$${diffStr}. Requiere aprobación del supervisor.`,
          { autoClose: 10000 }
        );
      } else {
        toast.success('Caja cerrada correctamente');
      }
      setShowClose(false);
      setDenomCounts({});
      setCloseNotes('');
      setRegister(null);
      setTransactions([]);
      fetchActive();
    } catch (err) {
      toast.error(err.message || 'Error cerrando caja');
    } finally {
      setClosing(false);
    }
  };

  const buildReportData = () => ({
    register: {
      ...register,
      closed_at: new Date().toISOString(),
      counted_balance: countedBalance,
      expected_balance: expectedBalance,
      expected_cash: expectedCash,
      total_card: totalCard,
      total_transfer: totalTransfer,
      difference
    },
    transactions,
    operatorName: user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      : 'Operador'
  });

  const fmtMoney = (v) => { const p = Number(v || 0).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `RD$ ${p.join('.')}`; };
  const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-DO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Santo_Domingo'
    });
  };

  /* ─── LOADING ─── */
  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full" />
      </div>
    );
  }

  /* ─── NO REGISTER OPEN ─── */
  if (!register) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Wallet className="text-indigo-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Caja Registradora</h1>
            <p className="text-sm text-gray-500">Gestiona el efectivo del turno</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={36} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Caja cerrada</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Debes abrir una sesión de caja antes de registrar cobros o reembolsos.
            Todos los pagos se asocian a la caja activa.
          </p>
          <button
            onClick={() => setShowOpen(true)}
            className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-lg font-medium shadow-sm transition-colors"
          >
            <Unlock size={22} /> Abrir Caja
          </button>
        </div>

        {/* Open modal */}
        {showOpen && <OpenCajaModal
          form={openForm}
          setForm={setOpenForm}
          onSubmit={handleOpen}
          onClose={() => setShowOpen(false)}
          saving={opening}
        />}
      </div>
    );
  }

  /* ─── REGISTER ACTIVE ─── */
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Wallet size={22} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Caja Registradora</h1>
            <p className="text-sm text-gray-500">
              {register.name} · Abierta {fmtTime(register.opened_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Abierta
          </span>
          <button
            onClick={() => setShowClose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-medium transition-colors"
          >
            <Lock size={16} /> Cerrar Caja
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Fondo Inicial" value={fmtMoney(openingBal)} color="blue" />
        <StatCard icon={TrendingUp} label="Total Ingresos" value={fmtMoney(totalIn)} color="green" />
        <StatCard icon={TrendingDown} label="Total Egresos" value={fmtMoney(totalOut)} color="red" />
        <StatCard icon={Wallet} label="Balance Actual" value={fmtMoney(currentBalance)} color="indigo" />
      </div>

      {/* Desglose por método de pago */}
      {(totalCard > 0 || totalTransfer > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-green-200 rounded-xl p-3 flex items-center gap-3">
            <Banknote size={18} className="text-green-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Efectivo</p>
              <p className="text-lg font-bold text-green-700">{fmtMoney(expectedCash)}</p>
            </div>
          </div>
          <div className="bg-white border border-purple-200 rounded-xl p-3 flex items-center gap-3">
            <CreditCard size={18} className="text-purple-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Tarjeta</p>
              <p className="text-lg font-bold text-purple-700">{fmtMoney(totalCard)}</p>
            </div>
          </div>
          <div className="bg-white border border-cyan-200 rounded-xl p-3 flex items-center gap-3">
            <ArrowRightLeft size={18} className="text-cyan-600" />
            <div>
              <p className="text-xs text-gray-500 uppercase">Transferencia</p>
              <p className="text-lg font-bold text-cyan-700">{fmtMoney(totalTransfer)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick info bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-500">
            <Clock size={14} className="inline mr-1" />
            Abierta: <strong className="text-gray-800">{fmtTime(register.opened_at)}</strong>
          </span>
          <span className="text-gray-500">
            <ArrowUpDown size={14} className="inline mr-1" />
            Movimientos: <strong className="text-gray-800">{transactions.filter(t => t.type !== 'opening_float').length}</strong>
          </span>
          <span className="text-gray-500">
            Umbral: <strong className="text-gray-800">{fmtMoney(threshold)}</strong>
          </span>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-700">
              Movimientos del Turno ({transactions.filter(t => t.type !== 'opening_float').length})
            </h3>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
          {transactions.filter(t => t.type !== 'opening_float').length === 0 ? (
            <div className="text-center py-12">
              <ArrowUpDown size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 font-medium">Sin movimientos registrados</p>
              <p className="text-gray-500 text-sm mt-1">Los cobros y reembolsos aparecerán aquí</p>
            </div>
          ) : (
            transactions
              .filter(t => t.type !== 'opening_float')
              .map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      t.direction === 'in' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {t.direction === 'in'
                        ? <Plus size={16} className="text-green-600" />
                        : <Minus size={16} className="text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        {t.description || (t.type === 'payment' ? 'Cobro' : t.type === 'refund' ? 'Reembolso' : t.type)}
                        {t.payment_method && t.payment_method !== 'cash' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            t.payment_method === 'card' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {t.payment_method === 'card' ? 'Tarjeta' : 'Transfer.'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{fmtTime(t.created_at)}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${t.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.direction === 'in' ? '+' : '-'}{fmtMoney(parseFloat(t.amount))}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Close modal */}
      {showClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowClose(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg my-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Cierre de Caja</h2>
                <p className="text-sm text-gray-500">Cuenta el efectivo por denominación</p>
              </div>
              <button onClick={() => setShowClose(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleClose} className="p-5 space-y-4">
              {/* Denomination table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Billete/Moneda</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {DENOMINATIONS.map(d => (
                      <tr key={d} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-700">RD${d.toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <input type="number" min="0" placeholder="0"
                            value={denomCounts[d] || ''}
                            onChange={e => setDenomCounts(p => ({ ...p, [d]: e.target.value }))}
                            className="w-20 mx-auto block text-center border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-600">
                          {fmtMoney(d * (parseInt(denomCounts[d]) || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fondo inicial:</span>
                  <span className="font-medium">{fmtMoney(openingBal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Efectivo esperado en caja:</span>
                  <span className="font-semibold">{fmtMoney(expectedCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Efectivo contado:</span>
                  <span className="font-semibold text-indigo-600">{fmtMoney(countedBalance)}</span>
                </div>
                <hr className="border-gray-200" />
                <div className={`flex justify-between font-bold text-base ${
                  Math.abs(difference) > threshold ? 'text-red-600' : 'text-green-600'
                }`}>
                  <span>Diferencia:</span>
                  <span>{difference >= 0 ? '+' : ''}{fmtMoney(difference)}</span>
                </div>
                {Math.abs(difference) > threshold && (
                  <div className="flex items-center gap-2 text-orange-700 bg-orange-50 rounded-lg p-3 mt-2">
                    <AlertTriangle size={16} />
                    <span className="text-xs">Diferencia supera {fmtMoney(threshold)} — requiere aprobación</span>
                  </div>
                )}
                {/* Otros ingresos (no se cuentan en denominaciones) */}
                {(totalCard > 0 || totalTransfer > 0) && (
                  <div className="bg-blue-50 rounded-lg p-3 mt-2 space-y-1">
                    <p className="text-xs font-medium text-blue-700">Otros ingresos (no se cuentan en efectivo):</p>
                    {totalCard > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600">Tarjeta:</span>
                        <span className="font-semibold text-blue-700">{fmtMoney(totalCard)}</span>
                      </div>
                    )}
                    {totalTransfer > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600">Transferencia:</span>
                        <span className="font-semibold text-blue-700">{fmtMoney(totalTransfer)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs pt-1 border-t border-blue-200">
                      <span className="text-blue-600 font-medium">Total general del turno:</span>
                      <span className="font-bold text-blue-700">{fmtMoney(expectedBalance)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas del cierre</label>
                <textarea rows={2} value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="Observaciones opcionales..." />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowClose(false)}
                  className="flex-1 border border-gray-300 rounded-xl py-2.5 text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  Cancelar
                </button>
                <button type="button" onClick={() => {
                  setPreviewHtml(generateCashReportHTML(buildReportData()));
                  setPreviewOpen(true);
                }}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm font-medium">
                  <Eye size={16} /> Vista Previa
                </button>
                <button type="submit" disabled={closing}
                  className="flex-1 bg-red-600 text-white rounded-xl py-2.5 hover:bg-red-700 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50">
                  <CheckCircle size={16} /> {closing ? 'Cerrando...' : 'Cerrar Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open modal (in case they want to re-open) */}
      {showOpen && <OpenCajaModal
        form={openForm}
        setForm={setOpenForm}
        onSubmit={handleOpen}
        onClose={() => setShowOpen(false)}
        saving={opening}
      />}

      <PrintPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} html={previewHtml} title="Cierre de Caja" />
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={`text-${color}-500`} />
        <p className={`text-xs text-${color}-600 font-medium uppercase`}>{label}</p>
      </div>
      <p className={`text-xl font-bold text-${color}-700`}>{value}</p>
    </div>
  );
}

/* ─── Open Caja Modal with Operator Selection ─── */
function OpenCajaModal({ form, setForm, onSubmit, onClose, saving }) {
  const [operators, setOperators] = useState([]);
  const [loadingOps, setLoadingOps] = useState(true);
  const [showNewOperator, setShowNewOperator] = useState(false);
  const [newOp, setNewOp] = useState({ first_name: '', last_name: '', email: '', phone: '', password: 'operator123' });
  const [creatingOp, setCreatingOp] = useState(false);

  useEffect(() => {
    operatorsAPI.list()
      .then(({ data }) => setOperators(data.data || []))
      .catch(() => {})
      .finally(() => setLoadingOps(false));
  }, []);

  const handleCreateOperator = async (e) => {
    e.preventDefault();
    if (!newOp.first_name.trim() || !newOp.email.trim()) {
      toast.warning('Nombre y email son requeridos');
      return;
    }
    setCreatingOp(true);
    try {
      const { data } = await operatorsAPI.create(newOp);
      const created = data.data;
      setOperators(prev => [...prev, created]);
      setForm(p => ({ ...p, operatorId: created.id }));
      setShowNewOperator(false);
      setNewOp({ first_name: '', last_name: '', email: '', phone: '', password: 'operator123' });
      toast.success('Operador registrado');
    } catch (err) {
      toast.error(err.message || 'Error creando operador');
    } finally {
      setCreatingOp(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Unlock size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Abrir Caja</h2>
              <p className="text-sm text-gray-500">Inicia una sesión de caja</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* Operator selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Encargado de caja</label>
            <div className="flex gap-2">
              <select
                value={form.operatorId || ''}
                onChange={e => setForm(p => ({ ...p, operatorId: e.target.value }))}
                required
                className="flex-1 border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar encargado...</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>
                    {[op.first_name, op.last_name].filter(Boolean).join(' ') || op.display_name || op.email} ({op.role})
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewOperator(true)}
                className="px-3 py-2.5 border border-dashed border-indigo-400 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Registrar nuevo operador">
                <Plus size={18} />
              </button>
            </div>
            {loadingOps && <p className="text-xs text-gray-400 mt-1">Cargando operadores...</p>}
          </div>

          {/* Inline new operator form */}
          {showNewOperator && (
            <div className="border border-dashed border-indigo-300 rounded-xl p-4 bg-indigo-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm text-gray-700">Nuevo Operador</p>
                <button type="button" onClick={() => setShowNewOperator(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Nombre *" value={newOp.first_name}
                  onChange={e => setNewOp(p => ({ ...p, first_name: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input placeholder="Apellido" value={newOp.last_name}
                  onChange={e => setNewOp(p => ({ ...p, last_name: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <input placeholder="Email *" type="email" value={newOp.email}
                onChange={e => setNewOp(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Teléfono" value={newOp.phone}
                  onChange={e => setNewOp(p => ({ ...p, phone: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input placeholder="Contraseña" value={newOp.password}
                  onChange={e => setNewOp(p => ({ ...p, password: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <button type="button" onClick={handleCreateOperator} disabled={creatingOp}
                className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1">
                <Plus size={14} /> {creatingOp ? 'Registrando...' : 'Registrar Operador'}
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la caja</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Caja Principal"
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fondo inicial (RD$)</label>
            <input type="number" min="0" step="0.01" placeholder="0.00"
              value={form.openingBalance}
              onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))}
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-mono" />
            <p className="text-xs text-gray-400 mt-1">Cantidad de efectivo con la que inicias el turno</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> Todos los cobros realizados durante el turno se registrarán automáticamente en esta caja.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-xl py-2.5 text-gray-700 hover:bg-gray-50 font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              <Unlock size={18} /> {saving ? 'Abriendo...' : 'Abrir Caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
