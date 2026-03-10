import { useState, useEffect, useCallback } from 'react';
import { reportsAPI, plansAPI } from '../services/api';
import {
  BarChart3, DollarSign, Users, Car, TrendingUp, TrendingDown, AlertTriangle,
  Clock, RefreshCw, Download, Calendar, Wallet, FileText, PieChart,
  ArrowUpRight, ArrowDownRight, Minus, CreditCard, ShieldAlert, Activity
} from 'lucide-react';

// ==================== SHARED COMPONENTS ====================

function KPICard({ icon: Icon, label, value, subValue, color, trend }) {
  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    cyan: 'bg-cyan-100 text-cyan-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm card-hover">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {subValue && (
            <div className="flex items-center gap-1 mt-0.5">
              {trend === 'up' && <ArrowUpRight size={14} className="text-green-500" />}
              {trend === 'down' && <ArrowDownRight size={14} className="text-red-500" />}
              {trend === 'neutral' && <Minus size={14} className="text-gray-400" />}
              <span className={`text-xs ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                {subValue}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PeriodSelector({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const periods = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'quarter', label: 'Trimestre' },
    { value: 'year', label: 'Año' },
    { value: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {periods.map(p => (
        <button key={p.value} onClick={() => setPeriod(p.value)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            period === p.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {p.label}
        </button>
      ))}
      {period === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1.5" />
          <span className="text-gray-400">-</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1.5" />
        </div>
      )}
    </div>
  );
}

function SimpleBar({ value, maxValue, color = 'bg-indigo-500', height = 'h-6' }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className={`w-full bg-gray-100 rounded-full ${height}`}>
      <div className={`${height} rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

function MiniTable({ headers, rows, emptyMsg = 'Sin datos' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>{headers.map((h, i) => <th key={i} className="py-2.5 px-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="text-center py-6 text-gray-400">{emptyMsg}</td></tr>
          ) : rows.map((cells, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              {cells.map((cell, j) => <td key={j} className="py-2.5 px-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmtMoney = (n) => `RD$ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

// ==================== TAB: RESUMEN EJECUTIVO ====================

function TabResumen({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsAPI.executiveSummary()
      .then(r => setData(r.data?.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">No se pudo cargar el resumen</p>;

  const rev = data.revenue || {};
  const subs = data.subscriptions || {};
  const sess = data.sessions || {};
  const cash = data.cashRegisters || {};
  const col = data.collection || {};
  const ref = data.refunds || {};

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={DollarSign} label="Ingresos del Mes" value={fmtMoney(rev.currentMonth)} color="green"
          subValue={`${rev.changePercent > 0 ? '+' : ''}${rev.changePercent}% vs mes anterior`}
          trend={rev.changePercent >= 0 ? 'up' : 'down'} />
        <KPICard icon={Users} label="Suscripciones Activas" value={subs.totalActive} color="indigo"
          subValue={`${subs.newThisMonth} nuevas este mes`} trend={subs.newThisMonth > 0 ? 'up' : 'neutral'} />
        <KPICard icon={CreditCard} label="Tasa de Cobro" value={fmtPct(col.rate)} color="blue"
          subValue={`${col.paidCount}/${col.totalCount} cobrados`} trend={col.rate >= 90 ? 'up' : 'down'} />
        <KPICard icon={AlertTriangle} label="Cancelaciones" value={subs.cancelledThisMonth} color="red"
          subValue="Este mes" trend={subs.cancelledThisMonth > 0 ? 'down' : 'up'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Car} label="Sesiones por Hora" value={sess.totalThisMonth} color="cyan"
          subValue={`Duración prom: ${sess.avgDurationMinutes} min`} trend="neutral" />
        <KPICard icon={DollarSign} label="Ingresos Parqueo/Hora" value={fmtMoney(sess.hourlyRevenue)} color="emerald" />
        <KPICard icon={Wallet} label="Cuadres de Caja" value={cash.totalClosures} color="purple"
          subValue={cash.requiringApproval > 0 ? `${cash.requiringApproval} requieren aprobación` : 'Todo al dia'}
          trend={cash.requiringApproval > 0 ? 'down' : 'up'} />
        <KPICard icon={TrendingDown} label="Reembolsos" value={fmtMoney(ref.total)} color="amber"
          subValue={`${ref.count} reembolsos`} trend={ref.count > 0 ? 'down' : 'up'} />
      </div>

      {/* Financial Summary Table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Resumen Financiero del Mes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-600 mb-3">Ingresos</h4>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Suscripciones</span><span className="font-medium">{fmtMoney(rev.currentMonth - sess.hourlyRevenue)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Parqueo por hora</span><span className="font-medium">{fmtMoney(sess.hourlyRevenue)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total Bruto</span><span className="font-bold text-green-600">{fmtMoney(rev.currentMonth)}</span></div>
              <div className="flex justify-between text-red-600"><span>(-) Reembolsos</span><span>{fmtMoney(ref.total)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total Neto</span><span className="font-bold">{fmtMoney(rev.currentMonth - ref.total)}</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-600 mb-3">Metricas Clave</h4>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Mes anterior</span><span className="font-medium">{fmtMoney(rev.previousMonth)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Variacion</span>
                <span className={`font-medium ${rev.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {rev.changePercent > 0 ? '+' : ''}{rev.changePercent}%
                </span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Cobros exitosos</span><span className="font-medium">{fmtPct(col.rate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total facturado</span><span className="font-medium">{fmtMoney(col.totalBilled)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total cobrado</span><span className="font-medium">{fmtMoney(col.collected)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Diferencia cajas acum.</span><span className="font-medium">{fmtMoney(cash.totalAbsDifference)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== TAB: INGRESOS ====================

function TabIngresos({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [opData, setOpData] = useState(null);
  const [groupBy, setGroupBy] = useState('day');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = { period, from: customFrom, to: customTo, groupBy };
    Promise.all([
      reportsAPI.revenue(params).then(r => setData(r.data?.data || r.data)),
      reportsAPI.revenueByOperator({ period, from: customFrom, to: customTo }).then(r => setOpData(r.data?.data || r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [period, customFrom, customTo, groupBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">Sin datos</p>;

  const totals = data.totals || {};
  const timeline = data.timeline || [];
  const byMethod = data.byMethod || [];
  const byPlan = data.byPlan || [];
  const operators = opData?.operators || [];
  const maxTimelineVal = Math.max(...timeline.map(t => t.total), 1);

  return (
    <div className="space-y-6">
      {/* Group by selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Agrupar por:</span>
        {['day', 'week', 'month', 'year'].map(g => (
          <button key={g} onClick={() => setGroupBy(g)}
            className={`px-2.5 py-1 text-xs rounded-lg ${groupBy === g ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {g === 'day' ? 'Dia' : g === 'week' ? 'Semana' : g === 'month' ? 'Mes' : 'Año'}
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard icon={DollarSign} label="Ingresos Brutos" value={fmtMoney(totals.grossRevenue)} color="green" />
        <KPICard icon={DollarSign} label="Ingresos Netos" value={fmtMoney(totals.netRevenue)} color="emerald" />
        <KPICard icon={FileText} label="ITBIS Total" value={fmtMoney(totals.totalTax)} color="amber" />
        <KPICard icon={Activity} label="Transacciones" value={totals.transactions} color="blue" />
        <KPICard icon={TrendingUp} label="Ticket Promedio" value={fmtMoney(totals.avgTicket)} color="purple" />
      </div>

      {/* Timeline chart (horizontal bars) */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Ingresos en el Tiempo</h3>
        {timeline.length === 0 ? <p className="text-gray-400 text-center py-4">Sin datos para el periodo</p> : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-28 text-xs text-gray-500 text-right shrink-0">{fmtDate(t.period)}</div>
                <div className="flex-1"><SimpleBar value={t.total} maxValue={maxTimelineVal} color="bg-green-500" height="h-5" /></div>
                <div className="w-32 text-right text-sm font-medium shrink-0">{fmtMoney(t.total)}</div>
                <div className="w-12 text-right text-xs text-gray-400 shrink-0">{t.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Method & By Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Por Método de Pago</h3>
          <MiniTable headers={['Método', 'Transacciones', 'Total']}
            rows={byMethod.map(m => [
              <span className="capitalize font-medium">{m.method === 'cash' ? 'Efectivo' : m.method === 'cardnet' ? 'CardNet' : m.method === 'stripe' ? 'Tarjeta' : m.method}</span>,
              m.count,
              <span className="font-medium">{fmtMoney(m.total)}</span>
            ])} />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Por Plan</h3>
          <MiniTable headers={['Plan', 'Tipo', 'Cobros', 'Total']}
            rows={byPlan.map(p => [
              <span className="font-medium">{p.planName}</span>,
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full capitalize">{p.planType}</span>,
              p.count,
              <span className="font-medium">{fmtMoney(p.total)}</span>
            ])} />
        </div>
      </div>

      {/* By Operator */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Ingresos por Cajero/Operador</h3>
        <MiniTable headers={['Operador', 'Turnos', 'Transacciones', 'Ingresos', 'Egresos', 'Neto', 'Ticket Prom.']}
          rows={operators.map(o => [
            <span className="font-medium">{o.operatorName}</span>,
            o.shiftsCount,
            o.transactionCount,
            <span className="text-green-600 font-medium">{fmtMoney(o.totalIncome)}</span>,
            <span className="text-red-600">{fmtMoney(o.totalExpenses)}</span>,
            <span className="font-bold">{fmtMoney(o.netIncome)}</span>,
            fmtMoney(o.avgTransaction)
          ])} />
      </div>
    </div>
  );
}

// ==================== TAB: CUADRE DE CAJA ====================

function TabCuadreCaja({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsAPI.cashReconciliation({ period, from: customFrom, to: customTo })
      .then(r => setData(r.data?.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">Sin datos</p>;

  const s = data.summary || {};
  const closures = data.closures || [];
  const byOp = data.byOperator || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Wallet} label="Total Cierres" value={s.totalClosures} color="indigo" />
        <KPICard icon={DollarSign} label="Total Esperado" value={fmtMoney(s.totalExpected)} color="blue" />
        <KPICard icon={DollarSign} label="Total Contado" value={fmtMoney(s.totalCounted)} color="green" />
        <KPICard icon={AlertTriangle} label="Diferencia Absoluta" value={fmtMoney(s.absDifference)} color={s.absDifference > 0 ? 'red' : 'green'}
          subValue={`Prom: ${fmtMoney(s.avgDifference)} | Max: ${fmtMoney(s.maxDifference)}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={TrendingUp} label="Cierres Exactos" value={s.exactCount} color="green"
          subValue={s.totalClosures > 0 ? fmtPct(s.exactCount / s.totalClosures * 100) : '0%'} />
        <KPICard icon={ArrowUpRight} label="Sobrantes" value={s.surplusCount} color="amber" />
        <KPICard icon={ArrowDownRight} label="Faltantes" value={s.shortageCount} color="red" />
        <KPICard icon={ShieldAlert} label="Requirieron Aprobación" value={s.flaggedCount} color="purple"
          subValue={`${s.approvedCount} aprobados`} />
      </div>

      {/* Closures detail */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Detalle de Cierres</h3>
        <MiniTable
          headers={['Fecha', 'Operador', 'Caja', 'Apertura', 'Esperado', 'Contado', 'Diferencia', 'Pagos', 'Estado']}
          rows={closures.map(c => [
            fmtDateTime(c.closedAt),
            c.operatorName,
            c.registerName,
            fmtMoney(c.openingBalance),
            fmtMoney(c.expectedBalance),
            fmtMoney(c.countedBalance),
            <span className={`font-bold ${c.difference > 0 ? 'text-green-600' : c.difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {c.difference > 0 ? '+' : ''}{fmtMoney(c.difference)}
            </span>,
            c.paymentCount,
            c.requiresApproval
              ? <span className={`text-xs px-2 py-0.5 rounded-full ${c.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c.isApproved ? 'Aprobado' : 'Pendiente'}
                </span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
          ])} />
      </div>

      {/* By operator */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Rendimiento por Operador</h3>
        <MiniTable
          headers={['Operador', 'Cierres', 'Exactos', 'Flaggeados', 'Dif. Acum.', 'Dif. Prom.']}
          rows={byOp.map(o => [
            <span className="font-medium">{o.operatorName}</span>,
            o.closures,
            <span className="text-green-600 font-medium">{o.exactClosures}</span>,
            o.flaggedClosures > 0 ? <span className="text-red-600 font-medium">{o.flaggedClosures}</span> : '0',
            fmtMoney(o.totalAbsDiff),
            fmtMoney(o.avgDiff)
          ])} />
      </div>
    </div>
  );
}

// ==================== TAB: CLIENTES ====================

function TabClientes({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsAPI.customers({ period, from: customFrom, to: customTo })
      .then(r => setData(r.data?.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">Sin datos</p>;

  const topCustomers = data.topCustomers || [];
  const delinquent = data.delinquent || [];
  const statusDist = data.statusDistribution || [];
  const newTrend = data.newCustomersTrend || [];
  const churnTrend = data.churnTrend || [];

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-gray-100 text-gray-700',
    past_due: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-200 text-gray-600',
    suspended: 'bg-amber-100 text-amber-700',
  };

  const statusLabels = {
    active: 'Activa', pending: 'Pendiente', past_due: 'Morosa', cancelled: 'Cancelada', suspended: 'Suspendida'
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Tasa de Retención" value={fmtPct(data.retentionRate)} color="green"
          subValue="Suscripciones activas/total" />
        <KPICard icon={TrendingUp} label="Nuevos (periodo)" value={newTrend.reduce((s, t) => s + t.count, 0)} color="blue" />
        <KPICard icon={TrendingDown} label="Cancelados (periodo)" value={churnTrend.reduce((s, t) => s + t.count, 0)} color="red" />
        <KPICard icon={AlertTriangle} label="Cuentas Morosas" value={delinquent.length} color="amber" />
      </div>

      {/* Subscription status distribution */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Distribución de Suscripciones</h3>
        <div className="flex flex-wrap gap-4">
          {statusDist.map((s, i) => (
            <div key={i} className={`px-4 py-3 rounded-xl ${statusColors[s.status] || 'bg-gray-100 text-gray-700'}`}>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-sm">{statusLabels[s.status] || s.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* New customers trend */}
      {newTrend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Nuevos Clientes (por semana)</h3>
          <div className="space-y-2">
            {newTrend.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-28 text-xs text-gray-500 text-right shrink-0">{fmtDate(t.period)}</div>
                <div className="flex-1"><SimpleBar value={t.count} maxValue={Math.max(...newTrend.map(x => x.count), 1)} color="bg-blue-500" height="h-5" /></div>
                <div className="w-12 text-right text-sm font-medium">{t.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top customers */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Top 20 Clientes por Ingresos</h3>
        <MiniTable
          headers={['#', 'Cliente', 'Documento', 'Pagos', 'Total Pagado', 'Suscripciones', 'Desde']}
          rows={topCustomers.map((c, i) => [
            <span className="font-bold text-indigo-600">{i + 1}</span>,
            <span className="font-medium">{c.customerName}</span>,
            c.idDocument || '-',
            c.paymentCount,
            <span className="font-bold text-green-600">{fmtMoney(c.totalPaid)}</span>,
            c.subscriptionCount,
            fmtDate(c.customerSince)
          ])} />
      </div>

      {/* Delinquent */}
      {delinquent.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" /> Cuentas Morosas / Suspendidas
          </h3>
          <MiniTable
            headers={['Cliente', 'Plan', 'Estado', 'Monto', 'Próxima Factura', 'Dias Vencidos']}
            rows={delinquent.map(d => [
              <span className="font-medium">{d.customerName}</span>,
              d.planName,
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[d.status]}`}>
                {statusLabels[d.status]}
              </span>,
              fmtMoney(d.pricePerPeriod),
              fmtDate(d.nextBillingDate),
              <span className="font-bold text-red-600">{d.daysOverdue}</span>
            ])} />
        </div>
      )}
    </div>
  );
}

// ==================== TAB: OCUPACION ====================

function TabOcupacion({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportsAPI.occupancy({ period, from: customFrom, to: customTo }).then(r => setData(r.data?.data || r.data)),
      plansAPI.list().then(({ data }) => setPlans(data.data || data || []))
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">Sin datos</p>;

  const peakHours = data.peakHours || [];
  const peakDays = data.peakDays || [];
  const dailyTrend = data.dailyTrend || [];
  const avgDuration = data.avgDuration || [];
  const accessMethods = data.accessMethods || [];
  const maxHourly = Math.max(...peakHours.map(h => h.entryCount), 1);
  const maxDaily = Math.max(...peakDays.map(d => d.entryCount), 1);

  const totalCapacity = plans.reduce((s, p) => s + (p.max_capacity || 0), 0);
  const totalOccupancy = plans.reduce((s, p) => s + (p.current_occupancy || 0), 0);

  return (
    <div className="space-y-6">
      {/* Current occupancy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Car} label="Ocupación Actual" value={`${totalOccupancy}/${totalCapacity}`} color="blue"
          subValue={fmtPct(totalCapacity > 0 ? totalOccupancy / totalCapacity * 100 : 0)} />
        <KPICard icon={Activity} label="Espacios Disponibles" value={totalCapacity - totalOccupancy} color="green" />
        <KPICard icon={Clock} label="Entradas (periodo)" value={dailyTrend.reduce((s, d) => s + d.entries, 0)} color="indigo" />
        <KPICard icon={Clock} label="Salidas (periodo)" value={dailyTrend.reduce((s, d) => s + d.exits, 0)} color="purple" />
      </div>

      {/* Occupancy by plan */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Ocupación por Plan (Actual)</h3>
        <div className="space-y-4">
          {plans.map(plan => {
            const pct = plan.max_capacity > 0 ? Math.round((plan.current_occupancy / plan.max_capacity) * 100) : 0;
            const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
            return (
              <div key={plan.id} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-700">{plan.name}</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-5">
                    <div className={`h-5 rounded-full transition-all ${color} flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(Math.min(pct, 100), 5)}%` }}>
                      <span className="text-[10px] text-white font-bold">{pct}%</span>
                    </div>
                  </div>
                </div>
                <div className="w-24 text-right text-sm text-gray-500">{plan.current_occupancy}/{plan.max_capacity}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Horas Pico (Entradas)</h3>
          <div className="space-y-1.5">
            {peakHours.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-12 text-xs text-gray-500 text-right">{h.label}</div>
                <div className="flex-1"><SimpleBar value={h.entryCount} maxValue={maxHourly} color="bg-indigo-500" height="h-4" /></div>
                <div className="w-8 text-right text-xs font-medium">{h.entryCount}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Dias de Mayor Actividad</h3>
          <div className="space-y-2">
            {peakDays.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-600">{d.dayName}</div>
                <div className="flex-1"><SimpleBar value={d.entryCount} maxValue={maxDaily} color="bg-purple-500" height="h-5" /></div>
                <div className="w-12 text-right text-sm font-medium">{d.entryCount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Access methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Método de Acceso</h3>
          <MiniTable headers={['Método', 'Total', 'Entradas', 'Salidas']}
            rows={accessMethods.map(m => [
              <span className="capitalize font-medium">{m.method === 'rfid' ? 'RFID' : m.method === 'qr' ? 'QR' : m.method === 'manual' ? 'Manual' : m.method}</span>,
              <span className="font-bold">{m.count}</span>,
              m.entries,
              m.exits
            ])} />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Duración Promedio por Plan</h3>
          <MiniTable headers={['Plan', 'Sesiones', 'Prom.', 'Min', 'Max']}
            rows={avgDuration.map(d => [
              <span className="font-medium">{d.planName}</span>,
              d.sessionCount,
              <span className="font-bold">{d.avgMinutes} min</span>,
              `${d.minMinutes} min`,
              `${d.maxMinutes} min`
            ])} />
        </div>
      </div>

      {/* Daily trend */}
      {dailyTrend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Tendencia Diaria (Entradas vs Salidas)</h3>
          <MiniTable headers={['Fecha', 'Entradas', 'Salidas', 'Neto']}
            rows={dailyTrend.map(d => [
              fmtDate(d.date),
              <span className="text-green-600 font-medium">{d.entries}</span>,
              <span className="text-red-600">{d.exits}</span>,
              <span className={`font-bold ${d.net > 0 ? 'text-green-600' : d.net < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {d.net > 0 ? '+' : ''}{d.net}
              </span>
            ])} />
        </div>
      )}
    </div>
  );
}

// ==================== TAB: SESIONES ====================

function TabSesiones({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsAPI.sessions({ period, from: customFrom, to: customTo })
      .then(r => setData(r.data?.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">Sin datos</p>;

  const s = data.summary || {};
  const timeline = data.timeline || [];
  const byAccess = data.byAccessMethod || [];
  const durDist = data.durationDistribution || [];
  const maxDur = Math.max(...durDist.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Car} label="Total Sesiones" value={s.total} color="indigo" />
        <KPICard icon={Activity} label="Activas" value={s.active} color="green" />
        <KPICard icon={DollarSign} label="Ingresos Sesiones" value={fmtMoney(s.totalRevenue)} color="emerald" />
        <KPICard icon={Clock} label="Duración Promedio" value={`${s.avgDuration} min`} color="blue" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={CreditCard} label="Pagadas" value={s.paid} color="green" />
        <KPICard icon={FileText} label="Cerradas" value={s.closed} color="purple" />
        <KPICard icon={AlertTriangle} label="Abandonadas" value={s.abandoned} color="red" />
        <KPICard icon={TrendingUp} label="Ticket Promedio" value={fmtMoney(s.avgTicket)} color="amber" />
      </div>

      {/* Duration distribution */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Distribución por Duración</h3>
        <div className="space-y-3">
          {durDist.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600 text-right shrink-0">{d.bucket}</div>
              <div className="flex-1"><SimpleBar value={d.count} maxValue={maxDur} color="bg-cyan-500" height="h-6" /></div>
              <div className="w-12 text-right text-sm font-bold">{d.count}</div>
              <div className="w-28 text-right text-xs text-gray-500">Prom: {fmtMoney(d.avgPaid)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By access method */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Por Método de Acceso</h3>
        <MiniTable headers={['Método', 'Sesiones', 'Ingresos']}
          rows={byAccess.map(a => [
            <span className="capitalize font-medium">{a.method === 'rfid' ? 'RFID' : a.method === 'qr' ? 'QR' : a.method === 'manual' ? 'Manual' : a.method}</span>,
            <span className="font-bold">{a.count}</span>,
            <span className="text-green-600 font-medium">{fmtMoney(a.revenue)}</span>
          ])} />
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Sesiones por Dia</h3>
          <MiniTable headers={['Fecha', 'Total', 'Pagadas', 'Abandonadas', 'Ingresos']}
            rows={timeline.map(t => [
              fmtDate(t.date),
              <span className="font-bold">{t.total}</span>,
              <span className="text-green-600">{t.paid}</span>,
              t.abandoned > 0 ? <span className="text-red-600">{t.abandoned}</span> : '0',
              <span className="font-medium">{fmtMoney(t.revenue)}</span>
            ])} />
        </div>
      )}
    </div>
  );
}

// ==================== TAB: FACTURACION ====================

function TabFacturacion({ period, customFrom, customTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsAPI.invoicesReport({ period, from: customFrom, to: customTo })
      .then(r => setData(r.data?.data || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400 text-center py-8">Sin datos</p>;

  const s = data.summary || {};
  const byNCF = data.byNCFType || [];
  const timeline = data.timeline || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard icon={FileText} label="Total Facturas" value={s.totalInvoices} color="indigo" />
        <KPICard icon={DollarSign} label="Monto Total" value={fmtMoney(s.totalAmount)} color="green" />
        <KPICard icon={DollarSign} label="Subtotal" value={fmtMoney(s.totalSubtotal)} color="blue" />
        <KPICard icon={DollarSign} label="ITBIS" value={fmtMoney(s.totalTax)} color="amber" />
        <KPICard icon={Users} label="Clientes Unicos" value={s.uniqueCustomers} color="purple" />
      </div>

      {/* By NCF type */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Por Tipo de Comprobante (NCF)</h3>
        <MiniTable headers={['Tipo', 'Cantidad', 'Total']}
          rows={byNCF.map(n => [
            <span className="font-medium">{n.type}</span>,
            <span className="font-bold">{n.count}</span>,
            <span className="text-green-600 font-medium">{fmtMoney(n.total)}</span>
          ])} />
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Facturación por Dia</h3>
          <MiniTable headers={['Fecha', 'Facturas', 'Total']}
            rows={timeline.map(t => [
              fmtDate(t.date),
              <span className="font-bold">{t.count}</span>,
              <span className="font-medium">{fmtMoney(t.total)}</span>
            ])} />
        </div>
      )}
    </div>
  );
}

// ==================== SPINNER ====================

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

// ==================== MAIN PAGE ====================

const TABS = [
  { id: 'resumen', label: 'Resumen Ejecutivo', icon: BarChart3 },
  { id: 'ingresos', label: 'Ingresos / Ventas', icon: DollarSign },
  { id: 'caja', label: 'Cuadre de Caja', icon: Wallet },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'ocupacion', label: 'Ocupación', icon: Car },
  { id: 'sesiones', label: 'Sesiones Parqueo', icon: Clock },
  { id: 'facturacion', label: 'Facturación', icon: FileText },
];

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const tabProps = { period, customFrom, customTo };

  const [exportFormat, setExportFormat] = useState('csv');

  const handleExport = async (type, format = exportFormat) => {
    setExporting(true);
    try {
      const params = { period, from: customFrom, to: customTo };
      const titles = { payments: 'Reporte de Pagos', 'cash-registers': 'Cuadre de Caja', sessions: 'Sesiones de Parqueo', customers: 'Reporte de Clientes' };
      if (format === 'xls') await reportsAPI.exportXls(type, params);
      else if (format === 'pdf') await reportsAPI.exportPdf(type, params, titles[type] || 'Reporte');
      else await reportsAPI.exportCsv(type, params);
    } catch {
      // error
    }
    setExporting(false);
  };

  const exportOptions = {
    ingresos: 'payments',
    caja: 'cash-registers',
    sesiones: 'sessions',
    clientes: 'customers',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-indigo-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">Centro de Reportes</h2>
        </div>
        {exportOptions[activeTab] && (
          <div className="flex items-center gap-2">
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}
              className="text-sm border rounded-lg px-2 py-2 bg-white text-gray-700">
              <option value="csv">CSV</option>
              <option value="xls">Excel (XLS)</option>
              <option value="pdf">PDF</option>
            </select>
            <button onClick={() => handleExport(exportOptions[activeTab])} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm">
              <Download size={16} />
              {exporting ? 'Exportando...' : `Exportar ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        )}
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <PeriodSelector period={period} setPeriod={setPeriod}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'resumen' && <TabResumen {...tabProps} />}
          {activeTab === 'ingresos' && <TabIngresos {...tabProps} />}
          {activeTab === 'caja' && <TabCuadreCaja {...tabProps} />}
          {activeTab === 'clientes' && <TabClientes {...tabProps} />}
          {activeTab === 'ocupacion' && <TabOcupacion {...tabProps} />}
          {activeTab === 'sesiones' && <TabSesiones {...tabProps} />}
          {activeTab === 'facturacion' && <TabFacturacion {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
