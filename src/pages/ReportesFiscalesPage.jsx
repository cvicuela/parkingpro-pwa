import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FileText, Download, Calendar, Building2, Eye,
  TrendingUp, TrendingDown, AlertCircle, ChevronDown,
  CheckCircle, RefreshCw, Clock
} from 'lucide-react';
import { fiscalAPI, settingsAPI } from '../services/api';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const EXPENSE_TYPE_LABELS = {
  '01': 'Gastos de Personal', '02': 'Gastos Trabajos/Suministros',
  '03': 'Arrendamientos', '04': 'Gastos Activos Fijos',
  '05': 'Gastos Representación', '06': 'Otras Deducciones',
  '07': 'Gastos Financieros', '08': 'Gastos Extraordinarios',
  '09': 'Costo de Venta', '10': 'Adquisición Activos', '11': 'Gastos Seguros'
};

const PAYMENT_METHOD_LABELS = {
  '01': 'Efectivo', '02': 'Cheque/Transferencia', '03': 'Tarjeta',
  '04': 'Crédito', '05': 'Permuta', '06': 'Nota de Crédito', '07': 'Mixto'
};

function formatCurrency(v) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v || 0);
}

function formatDGIIDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return '-';
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function periodToLabel(period) {
  if (!period || period.length < 6) return period;
  const year = period.slice(0, 4);
  const month = parseInt(period.slice(4, 6), 10);
  return `${MONTHS[month - 1] || ''} ${year}`;
}

// ============================================================
// Generate 607 TXT (Sales)
// ============================================================
function generate607TXT(companyRnc, period, rows) {
  const lines = [];
  // Header
  lines.push(`607|${companyRnc}|${period}|${rows.length}`);
  // Detail rows
  for (const r of rows) {
    const fields = [
      r.buyer_id || '',           // 1. RNC/Cedula comprador
      r.buyer_id_type || '2',     // 2. Tipo ID
      r.ncf || '',                // 3. NCF
      r.ncf_modified || '',       // 4. NCF modificado
      r.income_type || '01',      // 5. Tipo ingreso
      r.invoice_date || '',       // 6. Fecha comprobante
      r.retention_date || '',     // 7. Fecha retención
      fmtNum(r.subtotal),         // 8. Monto facturado
      fmtNum(r.itbis),            // 9. ITBIS facturado
      fmtNum(r.itbis_retenido),   // 10. ITBIS retenido por terceros
      fmtNum(r.itbis_percibido),  // 11. ITBIS percibido
      fmtNum(r.isr_retenido),     // 12. Retención renta terceros
      fmtNum(r.impuesto_selectivo),// 13. ISC
      fmtNum(r.otros_impuestos),  // 14. Otros impuestos
      fmtNum(r.propina_legal),    // 15. Propina legal
      fmtNum(r.cash_amount),      // 16. Efectivo
      fmtNum(r.check_transfer_amount), // 17. Cheque/Transferencia
      fmtNum(r.card_amount),      // 18. Tarjeta
      fmtNum(r.credit_sale_amount),// 19. Venta a crédito
      fmtNum(0),                  // 20. Bonos/Certificados
      fmtNum(r.permuta_amount),   // 21. Permuta
      fmtNum(r.other_amount),     // 22. Otras formas
    ];
    lines.push(fields.join('|'));
  }
  return lines.join('\r\n');
}

// ============================================================
// Generate 606 TXT (Purchases)
// ============================================================
function generate606TXT(companyRnc, period, rows) {
  const lines = [];
  lines.push(`606|${companyRnc}|${period}|${rows.length}`);
  for (const r of rows) {
    const fields = [
      r.supplier_id || '',         // 1. RNC/Cedula proveedor
      r.supplier_id_type || '1',   // 2. Tipo ID
      r.expense_type || '02',      // 3. Tipo bienes/servicios
      r.ncf || '',                 // 4. NCF
      r.ncf_modified || '',        // 5. NCF modificado
      r.invoice_date || '',        // 6. Fecha comprobante
      r.payment_date || '',        // 7. Fecha pago
      fmtNum(r.services_amount),   // 8. Monto servicios
      fmtNum(r.goods_amount),      // 9. Monto bienes
      fmtNum(r.total_invoiced),    // 10. Total facturado
      fmtNum(r.itbis),             // 11. ITBIS facturado
      fmtNum(r.itbis_retenido),    // 12. ITBIS retenido
      fmtNum(r.itbis_proporcionalidad), // 13. ITBIS proporcionalidad
      fmtNum(r.itbis_costo),       // 14. ITBIS al costo
      fmtNum(r.itbis_adelantar),   // 15. ITBIS por adelantar
      fmtNum(r.itbis_percibido),   // 16. ITBIS percibido
      r.isr_type || '00',          // 17. Tipo retención ISR
      fmtNum(r.isr_retenido),      // 18. Monto retención renta
      fmtNum(r.isr_percibido),     // 19. ISR percibido
      fmtNum(r.impuesto_selectivo),// 20. ISC
      fmtNum(r.otros_impuestos),   // 21. Otros impuestos
      fmtNum(r.propina_legal),     // 22. Propina legal
      r.payment_method || '04',    // 23. Forma de pago
    ];
    lines.push(fields.join('|'));
  }
  return lines.join('\r\n');
}

function fmtNum(v) {
  const n = parseFloat(v) || 0;
  return n === 0 ? '' : n.toFixed(2);
}

function downloadTXT(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generate607CSV(rows) {
  const headers = [
    'RNC/Cedula', 'Tipo ID', 'NCF', 'NCF Modificado', 'Tipo Ingreso',
    'Fecha Comprobante', 'Fecha Retención', 'Monto Facturado', 'ITBIS Facturado',
    'ITBIS Retenido', 'ITBIS Percibido', 'Retención Renta', 'ISC',
    'Otros Impuestos', 'Propina Legal', 'Efectivo', 'Cheque/Transferencia',
    'Tarjeta', 'Venta Crédito', 'Bonos', 'Permuta', 'Otras Formas'
  ];
  const escapeCSV = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.buyer_id || '', r.buyer_id_type || '2', r.ncf || '', r.ncf_modified || '',
      r.income_type || '01', r.invoice_date || '', r.retention_date || '',
      fmtNum(r.subtotal), fmtNum(r.itbis), fmtNum(r.itbis_retenido),
      fmtNum(r.itbis_percibido), fmtNum(r.isr_retenido), fmtNum(r.impuesto_selectivo),
      fmtNum(r.otros_impuestos), fmtNum(r.propina_legal), fmtNum(r.cash_amount),
      fmtNum(r.check_transfer_amount), fmtNum(r.card_amount), fmtNum(r.credit_sale_amount),
      fmtNum(0), fmtNum(r.permuta_amount), fmtNum(r.other_amount)
    ].map(escapeCSV).join(','));
  }
  return lines.join('\r\n');
}

function generate606CSV(rows) {
  const headers = [
    'RNC/Cedula', 'Tipo ID', 'Tipo Bienes/Servicios', 'NCF', 'NCF Modificado',
    'Fecha Comprobante', 'Fecha Pago', 'Monto Servicios', 'Monto Bienes',
    'Total Facturado', 'ITBIS Facturado', 'ITBIS Retenido', 'ITBIS Proporcionalidad',
    'ITBIS Costo', 'ITBIS Por Adelantar', 'ITBIS Percibido', 'Tipo Retención ISR',
    'Monto Retención Renta', 'ISR Percibido', 'ISC', 'Otros Impuestos',
    'Propina Legal', 'Forma de Pago'
  ];
  const escapeCSV = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.supplier_id || '', r.supplier_id_type || '1', r.expense_type || '02',
      r.ncf || '', r.ncf_modified || '', r.invoice_date || '', r.payment_date || '',
      fmtNum(r.services_amount), fmtNum(r.goods_amount), fmtNum(r.total_invoiced),
      fmtNum(r.itbis), fmtNum(r.itbis_retenido), fmtNum(r.itbis_proporcionalidad),
      fmtNum(r.itbis_costo), fmtNum(r.itbis_adelantar), fmtNum(r.itbis_percibido),
      r.isr_type || '00', fmtNum(r.isr_retenido), fmtNum(r.isr_percibido),
      fmtNum(r.impuesto_selectivo), fmtNum(r.otros_impuestos), fmtNum(r.propina_legal),
      r.payment_method || '04'
    ].map(escapeCSV).join(','));
  }
  return lines.join('\r\n');
}

function isValidNCF(ncf) {
  return ncf && typeof ncf === 'string' && ncf.startsWith('B') && ncf.length >= 11;
}

function getPreviousPeriod(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function getDGIIDeadline(year, month) {
  // Deadline is 15th of the month following the reported period
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 15);
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default function ReportesFiscalesPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('607');
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [companyRnc, setCompanyRnc] = useState('');
  const [rncLoaded, setRncLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [prevReportData, setPrevReportData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const period = `${periodYear}${String(periodMonth).padStart(2, '0')}`;

  // Cargar RNC al montar el componente (busca company_rnc o business_rnc)
  useState(() => {
    (async () => {
      try {
        // Intentar company_rnc primero
        const sRes = await settingsAPI.get('company_rnc');
        const val = sRes.data?.data?.value;
        if (val) {
          const rnc = typeof val === 'string' ? val.replace(/"/g, '') : val;
          if (rnc && rnc !== '000000000' && rnc !== '') {
            setCompanyRnc(rnc);
            setRncLoaded(true);
            return;
          }
        }
      } catch { /* ignore */ }
      try {
        // Fallback: buscar business_rnc (configurado en Setup/Config)
        const bRes = await settingsAPI.get('business_rnc');
        const bVal = bRes.data?.data?.value;
        if (bVal) {
          const rnc = typeof bVal === 'string' ? bVal.replace(/"/g, '') : bVal;
          if (rnc && rnc !== '') {
            setCompanyRnc(rnc);
            // Sincronizar a company_rnc para futuras cargas
            try { await settingsAPI.update('company_rnc', rnc); } catch {}
          }
        }
      } catch { /* ignore */ }
      setRncLoaded(true);
    })();
  });

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setReportData(null);
      setPrevReportData(null);

      const params = useCustomDates
        ? { fromDate, toDate }
        : { period };

      let res;
      if (activeTab === '607') {
        res = await fiscalAPI.generate607(params);
      } else {
        res = await fiscalAPI.generate606(params);
      }

      setReportData(res.data?.data || null);

      // Fetch previous period for comparison (only when using period selector, not custom dates)
      if (!useCustomDates) {
        try {
          const prev = getPreviousPeriod(periodYear, periodMonth);
          const prevPeriod = `${prev.year}${String(prev.month).padStart(2, '0')}`;
          let prevRes;
          if (activeTab === '607') {
            prevRes = await fiscalAPI.generate607({ period: prevPeriod });
          } else {
            prevRes = await fiscalAPI.generate606({ period: prevPeriod });
          }
          setPrevReportData(prevRes.data?.data || null);
        } catch { /* ignore prev period errors */ }
      }
    } catch (err) {
      toast.error('Error generando reporte: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, periodYear, periodMonth, useCustomDates, fromDate, toDate, companyRnc]);

  const handleExportTXT = () => {
    if (!reportData?.rows?.length) {
      toast.warning('No hay datos para exportar');
      return;
    }
    if (!companyRnc || companyRnc === '000000000') {
      toast.error('Debe configurar el RNC de la empresa antes de exportar');
      return;
    }

    let content, filename;
    if (activeTab === '607') {
      content = generate607TXT(companyRnc, period, reportData.rows);
      filename = `607_${companyRnc}_${period}.txt`;
    } else {
      content = generate606TXT(companyRnc, period, reportData.rows);
      filename = `606_${companyRnc}_${period}.txt`;
    }
    downloadTXT(content, filename);
    toast.success(`Archivo ${filename} descargado`);
  };

  const handleExportCSV = () => {
    if (!reportData?.rows?.length) {
      toast.warning('No hay datos para exportar');
      return;
    }
    let content, filename;
    if (activeTab === '607') {
      content = generate607CSV(reportData.rows);
      filename = `607_${companyRnc || '000000000'}_${period}.csv`;
    } else {
      content = generate606CSV(reportData.rows);
      filename = `606_${companyRnc || '000000000'}_${period}.csv`;
    }
    downloadCSV(content, filename);
    toast.success(`Archivo ${filename} descargado`);
  };

  const handleSaveRnc = async () => {
    if (!companyRnc || companyRnc.length < 9) {
      toast.error('RNC debe tener al menos 9 dígitos');
      return;
    }
    try {
      await settingsAPI.update('company_rnc', companyRnc);
      // Sincronizar con business_rnc para que aparezca en Configuración
      try { await settingsAPI.update('business_rnc', companyRnc); } catch {}
      toast.success('RNC guardado como predeterminado');
    } catch (err) {
      toast.error('Error guardando RNC: ' + err.message);
    }
  };

  const rows = reportData?.rows || [];
  const totals = reportData?.totals || {};
  const prevTotals = prevReportData?.totals || {};

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) years.push(y);

  // Validation counts
  const missingNCF = rows.filter(r => !isValidNCF(r.ncf)).length;
  const missingId = rows.filter(r => {
    const id = activeTab === '607' ? r.buyer_id : r.supplier_id;
    return !id || id.trim() === '';
  }).length;
  const zeroAmount = rows.filter(r => {
    const amt = activeTab === '607' ? (r.total_amount || 0) : (r.total || r.total_invoiced || 0);
    return parseFloat(amt) === 0;
  }).length;
  const allValid = missingNCF === 0 && missingId === 0 && zeroAmount === 0;

  // Period comparison
  const incomeChangePct = pctChange(totals.total_amount || 0, prevTotals.total_amount || 0);
  const countChangePct = pctChange(totals.count || 0, prevTotals.count || 0);
  const itbisChangePct = pctChange(totals.total_itbis || 0, prevTotals.total_itbis || 0);

  // DGII deadline
  const deadline = getDGIIDeadline(periodYear, periodMonth);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  const deadlinePassed = daysLeft <= 0;
  const deadlineLabel = deadline.toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reportes Fiscales DGII</h1>
          <p className="text-sm text-gray-500 mt-1">Generación de formatos 606 (compras) y 607 (ventas) para la DGII</p>
        </div>
        {/* DGII Deadline Indicator */}
        {!useCustomDates && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
            deadlinePassed
              ? 'bg-red-50 border-red-200 text-red-700'
              : daysLeft <= 5
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <Clock size={16} />
            <span>
              {deadlinePassed
                ? `Plazo de envío vencido (venció ${deadlineLabel})`
                : `Plazo de envío: ${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''} · ${deadlineLabel}`}
            </span>
          </div>
        )}
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setActiveTab('607'); setReportData(null); }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
            activeTab === '607'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          <TrendingUp size={18} />
          607 - Ventas
        </button>
        <button
          onClick={() => { setActiveTab('606'); setReportData(null); }}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
            activeTab === '606'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          <TrendingDown size={18} />
          606 - Compras
        </button>
      </div>

      {/* Config + Period */}
      <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        {/* Company RNC */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Building2 size={12} /> RNC de la Empresa
              {rncLoaded && companyRnc && companyRnc.length >= 9 && (
                <span className="text-green-500 flex items-center gap-0.5 ml-1">
                  <CheckCircle size={10} /> Guardado
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={companyRnc}
                onChange={e => setCompanyRnc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="border rounded-lg px-3 py-2 text-sm font-mono w-40 focus:ring-2 focus:ring-indigo-500"
                placeholder="000000000"
                maxLength={11}
              />
              <button onClick={handleSaveRnc}
                className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Guardar
              </button>
            </div>
            {!companyRnc && rncLoaded && (
              <p className="text-xs text-amber-500 mt-1">Configure el RNC en Configuración o aquí para exportar</p>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500 flex items-center gap-1">
              <input type="checkbox" checked={useCustomDates}
                onChange={e => setUseCustomDates(e.target.checked)}
                className="rounded" />
              Rango personalizado
            </label>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-end gap-3">
          {useCustomDates ? (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Desde</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mes</label>
                <select value={periodMonth} onChange={e => setPeriodMonth(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Año</label>
                <select value={periodYear} onChange={e => setPeriodYear(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          <button onClick={loadReport} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>

          {reportData && rows.length > 0 && (
            <>
              <button onClick={handleExportTXT}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Download size={16} />
                Descargar TXT
              </button>
              <button onClick={handleExportCSV}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                <Download size={16} />
                Descargar Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Período</p>
              <p className="text-lg font-bold">{periodToLabel(period)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Registros</p>
              <p className="text-lg font-bold">{totals.count || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Monto Total</p>
              <p className="text-lg font-bold">{formatCurrency(totals.total_amount)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">ITBIS Total</p>
              <p className="text-lg font-bold">{formatCurrency(totals.total_itbis)}</p>
            </div>
          </div>

          {/* Period Comparison Row */}
          {!useCustomDates && prevReportData && (prevTotals.count || 0) > 0 && (
            <div className="bg-white rounded-xl shadow-sm border px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-gray-500 font-medium">vs mes anterior:</span>
              {incomeChangePct !== null && (
                <span className={incomeChangePct >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {incomeChangePct >= 0 ? '+' : ''}{incomeChangePct.toFixed(1)}% ingresos
                </span>
              )}
              {countChangePct !== null && (
                <span className={countChangePct >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {countChangePct >= 0 ? '+' : ''}{(totals.count - prevTotals.count) > 0 ? '+' : ''}{(totals.count || 0) - (prevTotals.count || 0)} registros
                </span>
              )}
              {itbisChangePct !== null && (
                <span className={itbisChangePct >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {itbisChangePct >= 0 ? '+' : ''}{itbisChangePct.toFixed(1)}% ITBIS
                </span>
              )}
            </div>
          )}

          {/* Pre-export Validation Panel */}
          {rows.length > 0 && (
            <div className={`rounded-xl border p-4 ${allValid ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
              <p className="text-sm font-semibold text-gray-700 mb-3">Validación previa al envío DGII</p>
              {allValid ? (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={18} className="text-green-500" />
                  <span className="text-sm font-medium">Todos los registros validados</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    missingNCF > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {missingNCF > 0
                      ? <><AlertCircle size={15} />{missingNCF} registro{missingNCF !== 1 ? 's' : ''} sin NCF</>
                      : <><CheckCircle size={15} />NCF completos</>}
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    missingId > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {missingId > 0
                      ? <><AlertCircle size={15} />{missingId} registro{missingId !== 1 ? 's' : ''} sin identificación</>
                      : <><CheckCircle size={15} />Identificaciones completas</>}
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    zeroAmount > 0 ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                  }`}>
                    {zeroAmount > 0
                      ? <><AlertCircle size={15} />{zeroAmount} registro{zeroAmount !== 1 ? 's' : ''} con monto $0</>
                      : <><CheckCircle size={15} />Montos válidos</>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                {activeTab === '607' ? 'Detalle 607 - Ventas' : 'Detalle 606 - Compras'}
              </h3>
              <button onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <FileText size={14} />
                {showPreview ? 'Ver tabla' : 'Vista previa TXT'}
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No hay registros para este período</p>
                <p className="text-sm mt-1">
                  {activeTab === '607'
                    ? 'No se encontraron facturas de venta'
                    : 'No se encontraron gastos registrados'}
                </p>
              </div>
            ) : showPreview ? (
              /* TXT Preview */
              <div className="p-4">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
                  {activeTab === '607'
                    ? generate607TXT(companyRnc || '000000000', period, rows)
                    : generate606TXT(companyRnc || '000000000', period, rows)}
                </pre>
              </div>
            ) : activeTab === '607' ? (
              /* 607 Table */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">RNC/Cédula</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">NCF</th>
                      <th className="w-6 px-1 py-2"></th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Fecha</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Subtotal</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">ITBIS</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => (
                      <tr key={r.invoice_id || i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.buyer_id || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.ncf || '-'}</td>
                        <td className="px-1 py-2">
                          <span
                            title={isValidNCF(r.ncf) ? 'NCF válido' : 'NCF ausente o malformado'}
                            className={`inline-block w-2.5 h-2.5 rounded-full ${isValidNCF(r.ncf) ? 'bg-green-500' : 'bg-red-500'}`}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDGIIDate(r.invoice_date)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(r.subtotal)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(r.itbis)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.total_amount)}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.payment_method === 'cash' && 'Efectivo'}
                          {r.payment_method === 'card' && 'Tarjeta'}
                          {r.payment_method === 'transfer' && 'Transferencia'}
                          {r.payment_method === 'credit' && 'Crédito'}
                          {!r.payment_method && 'Crédito'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 font-semibold">
                      <td colSpan={5} className="px-3 py-2 text-right">Totales:</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totals.total_subtotal)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totals.total_itbis)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totals.total_amount)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* 606 Table */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Suplidor</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">RNC</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">NCF</th>
                      <th className="w-6 px-1 py-2"></th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Fecha</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Monto</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">ITBIS</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => (
                      <tr key={r.expense_id || i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.supplier_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.supplier_id || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.ncf || '-'}</td>
                        <td className="px-1 py-2">
                          <span
                            title={isValidNCF(r.ncf) ? 'NCF válido' : 'NCF ausente o malformado'}
                            className={`inline-block w-2.5 h-2.5 rounded-full ${isValidNCF(r.ncf) ? 'bg-green-500' : 'bg-red-500'}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs">{EXPENSE_TYPE_LABELS[r.expense_type] || r.expense_type}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDGIIDate(r.invoice_date)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(r.goods_amount)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(r.itbis)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(r.total)}</td>
                        <td className="px-3 py-2 text-xs">{PAYMENT_METHOD_LABELS[r.payment_method] || r.payment_method}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 font-semibold">
                      <td colSpan={7} className="px-3 py-2 text-right">Totales:</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totals.total_subtotal)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totals.total_itbis)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totals.total_amount)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Validation Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-medium">Notas importantes antes de enviar a la DGII:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li>Verifique que el RNC de la empresa esté correcto</li>
                  <li>Todos los registros deben tener NCF válido para ser aceptados</li>
                  <li>Use la herramienta de pre-validación de la DGII antes de subir el archivo</li>
                  <li>El plazo de envío es el día 15 del mes siguiente al período reportado</li>
                  <li>Suba el archivo TXT en la Oficina Virtual (dgii.gov.do) → Formatos de Envíos</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Initial state - no report loaded */}
      {!reportData && !loading && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Seleccione un período y genere el reporte</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {activeTab === '607'
              ? 'El formato 607 se genera automáticamente desde las facturas de venta del sistema.'
              : 'El formato 606 se genera desde los gastos registrados en la sección de Gastos.'}
          </p>
        </div>
      )}
    </div>
  );
}
