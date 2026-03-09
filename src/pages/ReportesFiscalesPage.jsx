import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FileText, Download, Calendar, Building2, Eye,
  TrendingUp, TrendingDown, AlertCircle, ChevronDown,
  CheckCircle, RefreshCw
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

export default function ReportesFiscalesPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('607');
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [companyRnc, setCompanyRnc] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const period = `${periodYear}${String(periodMonth).padStart(2, '0')}`;

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setReportData(null);

      // Load company RNC from settings if not set
      if (!companyRnc) {
        try {
          const sRes = await settingsAPI.get('company_rnc');
          const val = sRes.data?.data?.value;
          if (val) {
            const rnc = typeof val === 'string' ? val.replace(/"/g, '') : val;
            if (rnc && rnc !== '000000000') setCompanyRnc(rnc);
          }
        } catch { /* ignore */ }
      }

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
    } catch (err) {
      toast.error('Error generando reporte: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, useCustomDates, fromDate, toDate, companyRnc]);

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

  const handleSaveRnc = async () => {
    if (!companyRnc || companyRnc.length < 9) {
      toast.error('RNC debe tener al menos 9 dígitos');
      return;
    }
    try {
      await settingsAPI.update('company_rnc', companyRnc);
      toast.success('RNC guardado');
    } catch (err) {
      toast.error('Error guardando RNC: ' + err.message);
    }
  };

  const rows = reportData?.rows || [];
  const totals = reportData?.totals || {};

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) years.push(y);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes Fiscales DGII</h1>
        <p className="text-sm text-gray-500 mt-1">Generación de formatos 606 (compras) y 607 (ventas) para la DGII</p>
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
            <button onClick={handleExportTXT}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download size={16} />
              Descargar TXT
            </button>
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
                      <td colSpan={6} className="px-3 py-2 text-right">Totales:</td>
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
