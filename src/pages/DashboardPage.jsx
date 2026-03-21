import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsAPI, plansAPI, accessAPI, expensesAPI, incidentsAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { toast } from 'react-toastify';
import { offlineQueue } from '../services/offlineQueue';
import { DollarSign, Users, Car, AlertTriangle, TrendingUp, TrendingDown, Shield, Receipt, ArrowUpRight, ArrowDownRight, LogIn, LogOut, Wallet, CheckCircle } from 'lucide-react';
import PushNotificationToggle from '../components/PushNotificationToggle';

const fmtRD = (n) => { const p = Number(n || 0).toFixed(0).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `RD$ ${p.join('.')}`; };

const DAY_LABELS_ES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
function generateMockTrend() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { date: d.toISOString().split('T')[0], amount: 0, label: DAY_LABELS_ES[d.getDay()] };
  });
}

function StatCard({ icon: Icon, label, value, color, subtext }) {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm card-hover">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

function OccupancyBar({ plan }) {
  const percentage = plan.max_capacity > 0
    ? Math.round((plan.current_occupancy / plan.max_capacity) * 100)
    : 0;
  const barColor = percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-gray-700">{plan.name}</span>
        <span className="text-sm text-gray-500">
          {plan.current_occupancy}/{plan.max_capacity}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{percentage}% ocupado</span>
        <span className="text-xs text-gray-400">
          {plan.max_capacity - plan.current_occupancy} disponibles
        </span>
      </div>
    </div>
  );
}

// ---- Revenue Trend Mini-Chart (inline SVG bars) ----
function RevenueTrendChart({ data }) {
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const BAR_WIDTH = 28;
  const BAR_MAX_H = 80;
  const GAP = 12;
  const SVG_W = data.length * (BAR_WIDTH + GAP);
  const SVG_H = BAR_MAX_H + 36;
  const maxVal = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm flex-1">
      <h4 className="text-sm font-semibold text-gray-600 mb-3">Tendencia (7 días)</h4>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400">No disponible</p>
      ) : (
        <svg width={SVG_W} height={SVG_H} className="overflow-visible">
          {data.map((d, i) => {
            const barH = Math.max(4, Math.round((d.amount / maxVal) * BAR_MAX_H));
            const x = i * (BAR_WIDTH + GAP);
            const y = BAR_MAX_H - barH;
            const isToday = i === data.length - 1;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_WIDTH}
                  height={barH}
                  rx={4}
                  fill={isToday ? '#4f46e5' : '#a5b4fc'}
                />
                <text
                  x={x + BAR_WIDTH / 2}
                  y={BAR_MAX_H + 13}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9ca3af"
                >
                  {d.label || DAY_LABELS[new Date(d.date).getDay()] || ''}
                </text>
                <text
                  x={x + BAR_WIDTH / 2}
                  y={BAR_MAX_H + 26}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#6b7280"
                >
                  {d.amount >= 1000 ? `${(d.amount / 1000).toFixed(1)}k` : d.amount.toFixed(0)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ---- Payment Method Donut (inline SVG) ----
function PaymentDonut({ methods }) {
  const COLORS = { efectivo: '#22c55e', tarjeta: '#3b82f6', transferencia: '#a855f7' };
  const LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
  const total = methods.reduce((s, m) => s + m.amount, 0);
  const R = 42;
  const CX = 56;
  const CY = 56;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  let offset = 0;
  const segments = methods.map((m) => {
    const pct = total > 0 ? m.amount / total : 0;
    const seg = { ...m, pct, dashArray: pct * CIRCUMFERENCE, dashOffset: -offset * CIRCUMFERENCE };
    offset += pct;
    return seg;
  });

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm flex-1">
      <h4 className="text-sm font-semibold text-gray-600 mb-3">Métodos de Pago</h4>
      {total === 0 ? (
        <p className="text-xs text-gray-400">No disponible</p>
      ) : (
        <div className="flex items-center gap-4">
          <svg width={112} height={112}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={16} />
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={COLORS[seg.key] || '#d1d5db'}
                strokeWidth={16}
                strokeDasharray={`${seg.dashArray} ${CIRCUMFERENCE}`}
                strokeDashoffset={seg.dashOffset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
              />
            ))}
            <text x={CX} y={CY - 5} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="600">
              {fmtRD(total).replace('RD$ ', '')}
            </text>
            <text x={CX} y={CY + 9} textAnchor="middle" fontSize={8} fill="#9ca3af">
              total
            </text>
          </svg>
          <div className="flex flex-col gap-1.5">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: COLORS[seg.key] || '#d1d5db' }}
                />
                <span className="text-xs text-gray-600">
                  {LABELS[seg.key] || seg.key}
                </span>
                <span className="text-xs font-semibold text-gray-700 ml-auto">
                  {Math.round(seg.pct * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Circular Progress Indicator ----
function CircularProgress({ value, label, size = 72 }) {
  const R = (size - 12) / 2;
  const CX = size / 2;
  const CY = size / 2;
  const CIRC = 2 * Math.PI * R;
  const filled = Math.min(100, Math.max(0, value));
  const color = filled >= 95 ? '#22c55e' : filled >= 80 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e7eb" strokeWidth={6} />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${(filled / 100) * CIRC} ${CIRC}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px`, transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={13} fontWeight="700" fill={color}>
          {filled.toFixed(0)}%
        </text>
      </svg>
      {label && <span className="text-xs text-gray-500 text-center">{label}</span>}
    </div>
  );
}

const sessionStatusLabel = (s) => {
  const map = { active: 'Activa', paid: 'Pagada', closed: 'Cerrada', abandoned: 'Abandonada' };
  return map[s] || s || 'Activa';
};
const sessionStatusColor = (s) => {
  const map = { active: 'bg-green-100 text-green-700', paid: 'bg-blue-100 text-blue-700', closed: 'bg-gray-100 text-gray-700', abandoned: 'bg-amber-100 text-amber-700' };
  return map[s] || 'bg-green-100 text-green-700';
};

function ActiveSessionRow({ session }) {
  const minutes = Math.round(session.minutes_elapsed || 0);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 font-mono font-medium">{session.vehicle_plate}</td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {new Date(session.entry_time).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' })}
      </td>
      <td className="py-3 px-4 text-sm">{hours}h {mins}m</td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sessionStatusColor(session.status)}`}>
          {sessionStatusLabel(session.status)}
        </span>
      </td>
      <td className="py-3 px-4 text-sm font-medium text-green-600">
        RD$ {(session.current_amount || 0).toFixed(2)}
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [expenseStats, setExpenseStats] = useState(null);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [loading, setLoading] = useState(true);
  // New state for enhancements
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [collectionRate, setCollectionRate] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, plansRes, sessionsRes, expRes, incRes] = await Promise.allSettled([
        reportsAPI.dashboard(),
        plansAPI.list(),
        accessAPI.activeSessions(),
        expensesAPI.stats(),
        incidentsAPI.list({ status: 'open', limit: 1 }),
      ]);

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value.data.data || dashRes.value.data;
        const dashboardData = {
          revenue: parseFloat(d.revenue ?? d.total_revenue ?? 0),
          active_customers: parseInt(d.activeCustomers ?? d.active_customers ?? 0),
          total_subscriptions: parseInt(d.totalSubscriptions ?? d.total_subscriptions ?? 0),
          overdue_count: parseInt(d.overdueCount ?? d.overdue_count ?? 0),
        };
        setDashboard(dashboardData);
        offlineQueue.cacheData('dashboard', dashboardData);

        // Expense data from dashboard RPC (fallback if expensesAPI.stats fails)
        if (d.expense_total != null && !expenseStats) {
          setExpenseStats({
            total_amount: parseFloat(d.expense_total ?? 0),
            total_itbis: parseFloat(d.expense_itbis ?? 0),
          });
        }

        // Today stats from dashboard RPC
        const todayEntries = d.todayEntries ?? d.today_entries ?? null;
        const todayExits = d.todayExits ?? d.today_exits ?? null;
        const todayPayments = d.todayPayments ?? d.today_payments ?? null;
        const todayRevenue = d.todayRevenue ?? d.today_revenue ?? null;
        if (todayEntries !== null || todayRevenue !== null) {
          setTodayStats({
            entries: parseInt(todayEntries ?? 0),
            exits: parseInt(todayExits ?? 0),
            payments: parseInt(todayPayments ?? 0),
            revenue: parseFloat(todayRevenue ?? 0),
          });
        }

        // Collection rate from dashboard RPC
        const sessionsPaid = parseInt(d.sessionsPaid ?? d.sessions_paid ?? 0);
        const sessionsCompleted = parseInt(d.sessionsCompleted ?? d.sessions_completed ?? 0);
        if (sessionsCompleted > 0) {
          setCollectionRate(Math.round((sessionsPaid / sessionsCompleted) * 100));
        }
      }
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data.data || plansRes.value.data || []);
      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value.data.data || sessionsRes.value.data || []);
      if (expRes.status === 'fulfilled') {
        const d = expRes.value.data?.data || expRes.value.data;
        setExpenseStats(d);
      }
      if (incRes.status === 'fulfilled') {
        const d = incRes.value.data?.data || incRes.value.data;
        setOpenIncidents(d?.total || 0);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // Fetch revenue trend and payment methods separately (may not exist on all backends)
  const fetchChartData = useCallback(async () => {
    // Revenue trend last 7 days
    try {
      const res = await reportsAPI.revenue({ groupBy: 'day', period: 'week' });
      const raw = res.data?.data || res.data || [];
      const rows = Array.isArray(raw) ? raw : (raw.rows || raw.items || []);
      if (rows.length > 0) {
        const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const mapped = rows.slice(-7).map((r) => ({
          date: r.date || r.period || r.day,
          amount: parseFloat(r.amount || r.total || r.revenue || 0),
          label: r.label || (r.date ? DAY_LABELS[new Date(r.date).getDay()] : ''),
        }));
        setRevenueTrend(mapped);
      } else {
        // Mock last 7 days from no data (show zeros)
        setRevenueTrend(generateMockTrend());
      }
    } catch {
      setRevenueTrend(generateMockTrend());
    }

    // Payment methods — try sessions report or cash reconciliation
    try {
      const res = await reportsAPI.cashReconciliation({ period: 'month' });
      const raw = res.data?.data || res.data || {};
      const byMethod = raw.by_method || raw.byMethod || raw.payment_methods || raw.paymentMethods || null;
      if (byMethod && (Array.isArray(byMethod) ? byMethod.length : Object.keys(byMethod).length)) {
        const arr = Array.isArray(byMethod)
          ? byMethod
          : Object.entries(byMethod).map(([key, val]) => ({ key, amount: parseFloat(val?.amount ?? val ?? 0) }));
        setPaymentMethods(arr.map((m) => ({
          key: (m.key || m.method || m.payment_method || '').toLowerCase(),
          amount: parseFloat(m.amount || m.total || 0),
        })));
      } else {
        // Try to build from raw totals in the reconciliation data
        const pm = [];
        if (raw.efectivo_total != null) pm.push({ key: 'efectivo', amount: parseFloat(raw.efectivo_total) });
        if (raw.tarjeta_total != null) pm.push({ key: 'tarjeta', amount: parseFloat(raw.tarjeta_total) });
        if (raw.transferencia_total != null) pm.push({ key: 'transferencia', amount: parseFloat(raw.transferencia_total) });
        setPaymentMethods(pm);
      }
    } catch {
      setPaymentMethods([]);
    }
  }, []);

  // Fetch sessions report for collection rate if not available in dashboard
  const fetchSessionStats = useCallback(async () => {
    if (collectionRate !== null) return;
    try {
      const res = await reportsAPI.sessions({ period: 'month' });
      const raw = res.data?.data || res.data || {};
      const paid = raw.paid_count ?? raw.paidCount ?? raw.sessions_paid ?? null;
      const completed = raw.total_completed ?? raw.totalCompleted ?? raw.sessions_completed ?? (raw.total ?? null);
      if (paid !== null && completed > 0) {
        setCollectionRate(Math.round((paid / completed) * 100));
      }
    } catch {}
  }, [collectionRate]);

  // Today stats fallback: try executiveSummary
  const fetchTodayStats = useCallback(async () => {
    if (todayStats !== null) return;
    try {
      const res = await reportsAPI.executiveSummary();
      const raw = res.data?.data || res.data || {};
      setTodayStats({
        entries: raw.today_entries ?? raw.todayEntries ?? 0,
        exits: raw.today_exits ?? raw.todayExits ?? 0,
        payments: raw.today_payments ?? raw.todayPayments ?? 0,
        revenue: raw.today_revenue ?? raw.todayRevenue ?? 0,
      });
    } catch {}
  }, [todayStats]);

  useEffect(() => {
    // Load cached dashboard data immediately so the UI is populated even before
    // the first network response arrives (or when offline).
    offlineQueue.getCachedData('dashboard', 5 * 60 * 1000).then((cached) => {
      if (cached) setDashboard(cached);
    }).catch(() => {});

    fetchData();
    fetchChartData();
    fetchSessionStats();
    fetchTodayStats();
    const interval = setInterval(fetchData, 30000);

    const socket = connectSocket();
    socket.on('occupancy_update', (data) => {
      if (data.plans) setPlans(data.plans);
    });
    socket.on('session_update', (data) => {
      if (data.sessions) setSessions(data.sessions);
    });
    socket.on('vehicle_entry', (data) => {
      toast.info(`Entrada: ${data.plate}`, { autoClose: 3000 });
      fetchData();
    });
    socket.on('vehicle_exit', (data) => {
      toast.info(`Salida: ${data.plate}`, { autoClose: 3000 });
      fetchData();
    });
    socket.on('payment_received', (data) => {
      toast.success(`Pago recibido: RD$${parseFloat(data.amount).toLocaleString()}`, { autoClose: 3000 });
    });
    socket.on('incident_created', (data) => {
      toast.warn(`Nuevo incidente: ${data.description}`, { autoClose: 5000 });
    });

    return () => {
      clearInterval(interval);
      socket.off('occupancy_update');
      socket.off('session_update');
      socket.off('vehicle_entry');
      socket.off('vehicle_exit');
      socket.off('payment_received');
      socket.off('incident_created');
      disconnectSocket();
    };
  }, [fetchData, fetchChartData, fetchSessionStats, fetchTodayStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <PushNotificationToggle compact />
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate('/acceso')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <LogIn size={16} />
          Nueva Entrada
        </button>
        <button
          onClick={() => navigate('/acceso')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <LogOut size={16} />
          Registrar Salida
        </button>
        <button
          onClick={() => navigate('/caja')}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Wallet size={16} />
          Abrir Caja
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Ingresos del Mes"
          value={fmtRD(dashboard?.revenue)}
          color="green"
          subtext={<span className="flex items-center gap-0.5 text-green-600"><ArrowUpRight size={10} />Ventas</span>}
        />
        <StatCard
          icon={TrendingDown}
          label="Gastos del Mes"
          value={fmtRD(parseFloat(expenseStats?.total_amount))}
          color="amber"
          subtext={`ITBIS: ${fmtRD(parseFloat(expenseStats?.total_itbis))}`}
        />
        <StatCard
          icon={Car}
          label="Vehículos Activos"
          value={sessions.length}
          color="blue"
          subtext="Sesiones activas ahora"
        />
        <StatCard
          icon={Users}
          label="Clientes Activos"
          value={dashboard?.active_customers || 0}
          color="indigo"
        />
      </div>

      {/* Today's Performance Info Bar */}
      {todayStats && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold text-indigo-700">Hoy:</span>
          <span className="flex items-center gap-1.5 text-gray-700">
            <LogIn size={14} className="text-indigo-500" />
            <strong>{todayStats.entries}</strong> entradas
          </span>
          <span className="flex items-center gap-1.5 text-gray-700">
            <LogOut size={14} className="text-emerald-500" />
            <strong>{todayStats.exits}</strong> salidas
          </span>
          <span className="flex items-center gap-1.5 text-gray-700">
            <CheckCircle size={14} className="text-blue-500" />
            <strong>{todayStats.payments}</strong> pagos
          </span>
          <span className="flex items-center gap-1.5 text-gray-700">
            <DollarSign size={14} className="text-green-500" />
            <strong>{fmtRD(todayStats.revenue)}</strong> recaudado
          </span>
        </div>
      )}

      {/* Revenue Trend + Payment Methods */}
      <div className="flex flex-col sm:flex-row gap-4">
        <RevenueTrendChart data={revenueTrend} />
        <PaymentDonut methods={paymentMethods} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Receipt size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Utilidad Neta (Mes)</p>
            <p className={`text-xl font-bold ${(dashboard?.revenue || 0) - (parseFloat(expenseStats?.total_amount) || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtRD((dashboard?.revenue || 0) - (parseFloat(expenseStats?.total_amount) || 0))}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${openIncidents > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
            {openIncidents > 0 ? <AlertTriangle size={20} /> : <Shield size={20} />}
          </div>
          <div>
            <p className="text-xs text-gray-500">Incidentes Abiertos</p>
            <p className={`text-xl font-bold ${openIncidents > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {openIncidents > 0 ? openIncidents : 'Todo en orden'}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Morosos</p>
            <p className="text-xl font-bold text-red-600">{dashboard?.overdue_count || 0}</p>
          </div>
        </div>
        {/* Collection Rate */}
        <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
          {collectionRate !== null ? (
            <>
              <CircularProgress value={collectionRate} size={68} />
              <div>
                <p className="text-xs text-gray-500">Tasa de Cobro</p>
                <p className="text-xs text-gray-400 mt-0.5">Sesiones pagadas</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Tasa de Cobro</p>
                <p className="text-sm font-semibold text-gray-400">No disponible</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Occupancy Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Ocupación por Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <OccupancyBar key={plan.id} plan={plan} />
          ))}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-700">
            Sesiones Activas ({sessions.length})
          </h3>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <TrendingUp size={14} /> En tiempo real
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="p-6 text-center text-gray-400">No hay sesiones activas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500">
                <tr>
                  <th className="py-2 px-4">Placa</th>
                  <th className="py-2 px-4">Entrada</th>
                  <th className="py-2 px-4">Duración</th>
                  <th className="py-2 px-4">Estado</th>
                  <th className="py-2 px-4">Monto Actual</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s) => (
                  <ActiveSessionRow key={s.id} session={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
