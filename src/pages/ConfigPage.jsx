import { useState, useEffect, useRef } from 'react';
import { settingsAPI } from '../services/api';
import { toast } from 'react-toastify';
import timeService from '../services/timeService';
import {
  Settings, Save, RotateCw, Building2, Receipt, Shield,
  Bell, Wallet, Globe, ChevronDown, ChevronRight, Plus, Trash2,
  Printer, Star, Eye, QrCode, Wifi, Radio, MapPin, Edit2, Clock, RefreshCw
} from 'lucide-react';
import { getPrinters, addPrinter, removePrinter, setDefaultPrinter, getDefaultPrinter, generateEntryTicketHTML, generatePaymentReceiptHTML, generateCashReportHTML, generateDailySummaryHTML } from '../services/printService';
import PrintPreviewModal from '../components/PrintPreviewModal';

const categoryConfig = {
  general: { label: 'General', icon: Building2, color: 'indigo', description: 'Datos del negocio y moneda' },
  caja: { label: 'Caja Registradora', icon: Wallet, color: 'green', description: 'Umbrales y configuracion de caja' },
  facturacion: { label: 'Facturacion', icon: Receipt, color: 'blue', description: 'ITBIS, NCF y comprobantes fiscales' },
  antifraude: { label: 'Antifraude', icon: Shield, color: 'red', description: 'Limites de reembolso y proteccion' },
  notificaciones: { label: 'Notificaciones', icon: Bell, color: 'amber', description: 'Email, Telegram y alertas' },
  parqueo: { label: 'Parqueo', icon: Globe, color: 'purple', description: 'Espacios, tolerancia y mora' },
};

const fieldConfig = {
  business_name: { label: 'Nombre del Negocio', type: 'text', placeholder: 'ParkingPro' },
  business_rnc: { label: 'RNC', type: 'text', placeholder: '000-000000-0' },
  business_address: { label: 'Direccion', type: 'text', placeholder: 'Av. Principal #123' },
  business_phone: { label: 'Telefono', type: 'text', placeholder: '809-000-0000' },
  currency: { label: 'Moneda', type: 'select', options: ['DOP', 'USD', 'EUR'] },
  cash_diff_threshold: { label: 'Umbral diferencia de caja (RD$)', type: 'number', hint: 'Diferencias mayores requieren aprobacion del supervisor' },
  multi_register_enabled: { label: 'Multiples cajas simultaneas', type: 'toggle' },
  tax_rate: { label: 'Tasa ITBIS', type: 'number', hint: '0.18 = 18%' },
  invoice_mode: { label: 'Modo de Facturacion', type: 'select', options: ['fiscal', 'interno'], hint: 'Fiscal = NCF/DGII | Interno = numeracion propia sin reporte fiscal' },
  ncf_series_consumer: { label: 'Serie NCF - Consumidor Final', type: 'text', hint: 'Solo modo fiscal. Ej: B01' },
  ncf_series_fiscal: { label: 'Serie NCF - Valor Fiscal', type: 'text', hint: 'Solo modo fiscal. Ej: B14' },
  ncf_series_credit: { label: 'Serie NCF - Nota de Credito', type: 'text', hint: 'Solo modo fiscal. Ej: B04' },
  internal_invoice_prefix: { label: 'Prefijo factura interna', type: 'text', hint: 'Solo modo interno. Ej: FAC, INV', placeholder: 'FAC' },
  internal_invoice_next: { label: 'Proximo numero factura interna', type: 'number', hint: 'Numero secuencial siguiente para facturas internas' },
  refund_limit_operator: { label: 'Limite reembolso por operador (RD$)', type: 'number', hint: 'Maximo que un operador puede reembolsar sin aprobacion' },
  refund_daily_multiplier: { label: 'Multiplicador diario de reembolso', type: 'number', hint: 'Tope diario = limite x multiplicador' },
  alert_email: { label: 'Email de alertas', type: 'email', placeholder: 'admin@empresa.com', hint: 'Recibe notificaciones de cierres de caja, reembolsos y alertas criticas' },
  notification_email_enabled: { label: 'Notificaciones por Email', type: 'toggle', hint: 'Activar envio de alertas al email configurado' },
  telegram_enabled: { label: 'Notificaciones por Telegram', type: 'toggle', hint: 'Activar envio de alertas a los numeros configurados' },
  telegram_phone_1: { label: 'Telegram - Numero 1 (Principal)', type: 'text', placeholder: '+1 809-000-0000', hint: 'Numero de WhatsApp/Telegram para alertas' },
  telegram_phone_2: { label: 'Telegram - Numero 2 (Opcional)', type: 'text', placeholder: '+1 809-000-0000' },
  telegram_phone_3: { label: 'Telegram - Numero 3 (Opcional)', type: 'text', placeholder: '+1 809-000-0000' },
  parking_name: { label: 'Nombre del Parqueo', type: 'text' },
  total_spaces: { label: 'Total de Espacios', type: 'number' },
  grace_period_hours: { label: 'Periodo de Gracia (horas)', type: 'number' },
  tolerance_minutes: { label: 'Tolerancia (minutos)', type: 'number' },
  late_fee: { label: 'Cargo por Mora (RD$)', type: 'number' },
  payment_retry_attempts: { label: 'Reintentos de Pago', type: 'number' },
};

function TimezoneClockPanel() {
  const [currentTime, setCurrentTime] = useState(timeService.nowFullDisplay());
  const [status, setStatus] = useState(timeService.getStatus());
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentTime(timeService.nowFullDisplay());
      setStatus(timeService.getStatus());
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const ok = await timeService.forceSync();
    setStatus(timeService.getStatus());
    toast[ok ? 'success' : 'warning'](ok ? 'Hora sincronizada correctamente' : 'No se pudo sincronizar — usando hora local');
    setSyncing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
            <Clock size={20} className="text-sky-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Zona Horaria y Reloj del Sistema</h3>
            <p className="text-xs text-gray-400">Hora sincronizada para todas las operaciones del parqueo</p>
          </div>
        </div>

        {/* Live clock */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-5 mb-4">
          <div className="text-center">
            <p className="text-4xl font-mono font-bold text-gray-800 tracking-wider">
              {timeService.nowDisplay()}
            </p>
            <p className="text-sm text-gray-500 mt-1">{currentTime}</p>
          </div>
        </div>

        {/* Timezone info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 font-medium uppercase">Zona Horaria</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{timeService.TZ}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 font-medium uppercase">UTC Offset</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">UTC-4 (AST)</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 font-medium uppercase">Fuente</p>
            <p className={`text-sm font-bold mt-0.5 ${status.synced ? 'text-green-700' : 'text-amber-700'}`}>
              {status.source}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 font-medium uppercase">Desfase</p>
            <p className={`text-sm font-bold mt-0.5 ${Math.abs(status.offset) < 2000 ? 'text-green-700' : 'text-amber-700'}`}>
              {status.offsetFormatted}
            </p>
          </div>
        </div>

        {/* Sync status & button */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status.synced ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-sm text-gray-600">
              {status.synced
                ? `Sincronizado con ${status.source}`
                : 'Usando hora local del dispositivo'}
            </span>
            {status.lastSync && (
              <span className="text-xs text-gray-400">
                · Ultima sync: {new Date(status.lastSync).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Santo_Domingo' })}
              </span>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Re-sincronizar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [editValues, setEditValues] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [hasChanges, setHasChanges] = useState({});
  // Printer state
  const [printers, setPrinters] = useState([]);
  const [defaultPrinterId, setDefaultPrinterId] = useState(null);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', type: 'thermal', paperSize: '80mm', location: '' });
  const [showPrinterSection, setShowPrinterSection] = useState(true);
  const [testingPrinter, setTestingPrinter] = useState(false);
  // Scanner / perimeter devices state
  const [showScannerSection, setShowScannerSection] = useState(true);
  const [scanners, setScanners] = useState([]);
  const [showAddScanner, setShowAddScanner] = useState(false);
  const [newScanner, setNewScanner] = useState({ name: '', type: 'qr_fixed', location: 'entry', ip: '', port: '' });
  const [editingScanner, setEditingScanner] = useState(null);
  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const loadPrinters = () => {
    setPrinters(getPrinters());
    setDefaultPrinterId(getDefaultPrinter());
  };
  const SCANNERS_KEY = 'pp_scanners';
  const loadScanners = () => {
    try { setScanners(JSON.parse(localStorage.getItem(SCANNERS_KEY) || '[]')); } catch { setScanners([]); }
  };
  const saveScanners = (list) => { localStorage.setItem(SCANNERS_KEY, JSON.stringify(list)); setScanners(list); };
  useEffect(() => { loadPrinters(); loadScanners(); }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await settingsAPI.list();
      const items = data.data || data || [];
      setSettings(items);
      const vals = {};
      items.forEach(s => {
        const v = s.value;
        vals[s.key] = typeof v === 'string' ? v : (v !== null && v !== undefined ? JSON.stringify(v) : '');
      });
      setEditValues(vals);
      // Expand all categories that have settings
      const cats = {};
      items.forEach(s => { cats[s.category || 'general'] = true; });
      setExpandedCategories(cats);
    } catch {
      toast.error('Error cargando configuraciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (key) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await settingsAPI.update(key, editValues[key]);
      toast.success(`${fieldConfig[key]?.label || key} actualizado`);
      setHasChanges(prev => ({ ...prev, [key]: false }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleChange = (key, value) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
    const original = settings.find(s => s.key === key);
    const origVal = original ? (typeof original.value === 'string' ? original.value : JSON.stringify(original.value)) : '';
    setHasChanges(prev => ({ ...prev, [key]: value !== origVal }));
  };

  const handleSaveAll = async () => {
    const changedKeys = Object.keys(hasChanges).filter(k => hasChanges[k]);
    if (changedKeys.length === 0) {
      toast.info('No hay cambios pendientes');
      return;
    }
    for (const key of changedKeys) {
      await handleSave(key);
    }
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const grouped = {};
  settings.forEach(s => {
    const cat = s.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  // Add uncategorized settings to 'parqueo' or 'general'
  const categoryOrder = ['general', 'caja', 'facturacion', 'antifraude', 'notificaciones', 'parqueo'];

  const changedCount = Object.values(hasChanges).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const renderField = (setting) => {
    const key = setting.key;
    const config = fieldConfig[key] || { label: key, type: 'text' };
    const value = editValues[key] ?? '';
    const changed = hasChanges[key];

    if (config.type === 'toggle') {
      const isOn = value === 'true' || value === true;
      return (
        <div key={key} className="flex items-center justify-between py-4 px-5 hover:bg-gray-50 rounded-lg transition-colors">
          <div className="flex-1">
            <p className="font-medium text-gray-800">{config.label}</p>
            {(config.hint || setting.description) && (
              <p className="text-xs text-gray-400 mt-0.5">{config.hint || setting.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newVal = isOn ? 'false' : 'true';
                handleChange(key, newVal);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            {changed && (
              <button onClick={() => handleSave(key)} disabled={saving[key]}
                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
                {saving[key] ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            )}
          </div>
        </div>
      );
    }

    if (config.type === 'select') {
      return (
        <div key={key} className="flex items-center justify-between py-4 px-5 hover:bg-gray-50 rounded-lg transition-colors">
          <div className="flex-1">
            <p className="font-medium text-gray-800">{config.label}</p>
            {(config.hint || setting.description) && (
              <p className="text-xs text-gray-400 mt-0.5">{config.hint || setting.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              className={`px-3 py-1.5 border rounded-lg text-sm w-32 focus:ring-2 focus:ring-indigo-500 outline-none ${changed ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'}`}
            >
              {config.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {changed && (
              <button onClick={() => handleSave(key)} disabled={saving[key]}
                className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
                {saving[key] ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="flex items-center justify-between py-4 px-5 hover:bg-gray-50 rounded-lg transition-colors">
        <div className="flex-1 mr-4">
          <p className="font-medium text-gray-800">{config.label}</p>
          {(config.hint || setting.description) && (
            <p className="text-xs text-gray-400 mt-0.5">{config.hint || setting.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type={config.type || 'text'}
            value={value}
            placeholder={config.placeholder || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && changed) handleSave(key); }}
            className={`px-3 py-1.5 border rounded-lg text-sm w-52 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${changed ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'}`}
          />
          {saving[key] ? (
            <RotateCw size={16} className="animate-spin text-indigo-500" />
          ) : changed ? (
            <button onClick={() => handleSave(key)}
              className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 flex items-center gap-1">
              <Save size={12} /> Guardar
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="text-indigo-600" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Configuracion</h2>
            <p className="text-sm text-gray-500">Administra los parametros del sistema</p>
          </div>
        </div>
        {changedCount > 0 && (
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <Save size={16} />
            Guardar todo ({changedCount})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total ajustes', value: settings.length, color: 'indigo' },
          { label: 'Categorias', value: Object.keys(grouped).length, color: 'blue' },
          { label: 'Pendientes', value: changedCount, color: changedCount > 0 ? 'amber' : 'green' },
          { label: 'Estado', value: changedCount > 0 ? 'Con cambios' : 'Sincronizado', color: changedCount > 0 ? 'amber' : 'green' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
            <p className={`text-xs text-${color}-600 font-medium uppercase`}>{label}</p>
            <p className={`text-lg font-bold text-${color}-700`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ─── TIMEZONE & CLOCK ─── */}
      <TimezoneClockPanel />

      {/* Settings by Category */}
      {settings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Settings size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin configuraciones</h3>
          <p className="text-gray-500">No se encontraron configuraciones en la base de datos.</p>
        </div>
      ) : (
        categoryOrder.filter(cat => grouped[cat]?.length > 0).map(cat => {
          const catConf = categoryConfig[cat] || { label: cat, icon: Settings, color: 'gray', description: '' };
          const CatIcon = catConf.icon;
          const expanded = expandedCategories[cat];
          const catSettings = grouped[cat] || [];
          const catChanges = catSettings.filter(s => hasChanges[s.key]).length;

          return (
            <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-${catConf.color}-100 flex items-center justify-center`}>
                    <CatIcon size={20} className={`text-${catConf.color}-600`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-800">{catConf.label}</h3>
                    <p className="text-xs text-gray-400">{catConf.description} ({catSettings.length} ajustes)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {catChanges > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                      {catChanges} cambio{catChanges > 1 ? 's' : ''}
                    </span>
                  )}
                  {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                </div>
              </button>

              {expanded && (
                <div className="border-t divide-y divide-gray-50">
                  {catSettings.map(setting => renderField(setting))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ─── PRINTERS SECTION ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button onClick={() => setShowPrinterSection(p => !p)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Printer size={20} className="text-violet-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Impresoras</h3>
              <p className="text-xs text-gray-400">Gestiona impresoras termicas y de recibos ({printers.length} configuradas)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showPrinterSection ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
          </div>
        </button>

        {showPrinterSection && (
          <div className="border-t p-5 space-y-4">
            {/* How it works */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium mb-1">Como funciona</p>
              <p className="text-xs text-blue-600">ParkingPro usa el <strong>dialogo de impresion nativo</strong> de tu sistema operativo (Windows, Mac, Linux). Al imprimir, se abrira la ventana del SO donde puedes seleccionar cualquier impresora instalada, configurar copias, y ajustar preferencias.</p>
            </div>

            {/* Registered printers */}
            <div>
              <p className="font-medium text-gray-700 text-sm mb-2">Impresoras Registradas</p>
              {printers.length === 0 ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <Printer size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">No hay impresoras registradas</p>
                  <p className="text-gray-400 text-xs">Registra las impresoras que usas para identificarlas rapidamente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {printers.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.id === defaultPrinterId ? 'border-violet-300 bg-violet-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <Printer size={20} className={p.id === defaultPrinterId ? 'text-violet-600' : 'text-gray-400'} />
                        <div>
                          <p className="font-medium text-gray-800 text-sm flex items-center gap-1">
                            {p.name}
                            {p.id === defaultPrinterId && <Star size={12} className="text-amber-500 fill-amber-500" />}
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.type === 'thermal' ? 'Termica' : p.type === 'laser' ? 'Laser' : 'PDF'} · {p.paperSize}
                            {p.location ? ` · ${p.location}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {p.id !== defaultPrinterId && (
                          <button onClick={() => { setDefaultPrinter(p.id); loadPrinters(); toast.success('Impresora predeterminada actualizada'); }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-violet-600" title="Establecer como predeterminada">
                            <Star size={14} />
                          </button>
                        )}
                        <button onClick={() => { removePrinter(p.id); loadPrinters(); toast.success('Impresora eliminada'); }}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add printer form */}
            {showAddPrinter ? (
              <div className="border border-dashed border-violet-300 rounded-lg p-4 bg-violet-50/50 space-y-3">
                <p className="font-medium text-gray-700 text-sm">Registrar Impresora</p>
                <p className="text-xs text-gray-500">Registra un nombre para identificar la impresora. Al imprimir, el sistema operativo te mostrara todas las impresoras disponibles en tu equipo.</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Nombre (ej: Termica Caja 1)" value={newPrinter.name}
                    onChange={e => setNewPrinter(p => ({ ...p, name: e.target.value }))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                  <select value={newPrinter.type} onChange={e => setNewPrinter(p => ({ ...p, type: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none">
                    <option value="thermal">Termica (POS)</option>
                    <option value="laser">Laser / Tinta</option>
                    <option value="pdf">Solo PDF</option>
                  </select>
                  <select value={newPrinter.paperSize} onChange={e => setNewPrinter(p => ({ ...p, paperSize: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none">
                    <option value="80mm">80mm (Estandar)</option>
                    <option value="58mm">58mm (Compacta)</option>
                    <option value="A4">A4 (Carta)</option>
                  </select>
                  <input placeholder="Ubicacion (ej: Entrada, Caja 2)" value={newPrinter.location}
                    onChange={e => setNewPrinter(p => ({ ...p, location: e.target.value }))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddPrinter(false)}
                    className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button onClick={() => {
                    if (!newPrinter.name.trim()) { toast.warning('Ingresa un nombre'); return; }
                    addPrinter(newPrinter);
                    loadPrinters();
                    setNewPrinter({ name: '', type: 'thermal', paperSize: '80mm', location: '' });
                    setShowAddPrinter(false);
                    toast.success('Impresora registrada');
                  }} className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm hover:bg-violet-700 flex items-center justify-center gap-1">
                    <Plus size={14} /> Registrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowAddPrinter(true)}
                  className="flex-1 border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 flex items-center justify-center gap-2 transition-colors">
                  <Plus size={16} /> Registrar Impresora
                </button>
                <button onClick={() => {
                  setTestingPrinter(true);
                  const w = window.open('', '_blank', 'width=350,height=500');
                  if (w) {
                    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prueba de Impresora</title>
<style>@page{margin:0;size:80mm auto}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm;color:#000}.center{text-align:center}.bold{font-weight:bold}.big{font-size:18px}.line{border-top:1px dashed #000;margin:6px 0}.mt{margin-top:8px}.mb{margin-bottom:8px}@media print{body{width:80mm}}</style></head><body>
<div class="center mb"><div class="bold big">ParkingPro</div><div>PAGINA DE PRUEBA</div></div>
<div class="line"></div>
<div class="center mt mb"><div class="bold big">IMPRESORA OK</div></div>
<div class="line"></div>
<div class="mt">Si puedes leer esto, la impresora esta funcionando correctamente.</div>
<div class="mt">Fecha: ${new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })}</div>
<div class="line"></div>
<div class="center mt">Linea de caracteres:</div>
<div class="center">================================</div>
<div class="center mt">1234567890 ABCDEFGHIJ</div>
<div class="center">abcdefghij !@#$%&*()</div>
<div class="line"></div>
<div class="center mt mb bold">Selecciona tu impresora arriba</div>
<script>setTimeout(()=>{window.print();setTimeout(()=>window.close(),1000)},500)</script>
</body></html>`);
                    w.document.close();
                  }
                  setTimeout(() => setTestingPrinter(false), 2000);
                }}
                  disabled={testingPrinter}
                  className="flex-1 border border-violet-300 rounded-lg py-3 text-sm text-violet-600 hover:bg-violet-50 flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                  <Printer size={16} /> {testingPrinter ? 'Abriendo...' : 'Probar Impresora'}
                </button>
              </div>
            )}

            {/* Print Preview / Test */}
            <div className="border-t pt-4 mt-4">
              <p className="font-medium text-gray-700 text-sm mb-3 flex items-center gap-2"><Eye size={16} className="text-indigo-500" /> Vista Previa de Documentos</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Ticket Entrada', fn: async () => {
                    setPreviewHtml(await generateEntryTicketHTML({ plate: 'A123456', entryTime: new Date().toISOString(), type: 'hourly', planName: 'Por Hora', sessionId: 'demo-session-id-12345678' }));
                    setPreviewTitle('Ticket de Entrada'); setPreviewOpen(true);
                  }},
                  { label: 'Recibo Pago', fn: async () => {
                    setPreviewHtml(await generatePaymentReceiptHTML({ receipt: { plateNumber: 'A123456', entryTime: new Date(Date.now() - 3600000 * 3).toISOString(), exitTime: new Date().toISOString(), hours: 3, paymentMethod: 'cash', subtotal: 450, tax: 81, total: 531, invoiceNumber: 'FAC-2026-0001', ncf: 'B0100000001', code: 'PAY-DEMO-001' } }));
                    setPreviewTitle('Recibo de Pago'); setPreviewOpen(true);
                  }},
                  { label: 'Cierre Caja', fn: () => {
                    setPreviewHtml(generateCashReportHTML({ register: { name: 'Caja Principal', opening_balance: 2000, opened_at: new Date(Date.now() - 28800000).toISOString(), closed_at: new Date().toISOString(), expected_balance: 8500, counted_balance: 8450, difference: -50 }, transactions: [
                      { type: 'payment', direction: 'in', amount: 350, description: 'Cobro A123456', created_at: new Date(Date.now() - 25000000).toISOString() },
                      { type: 'payment', direction: 'in', amount: 500, description: 'Cobro B789012', created_at: new Date(Date.now() - 18000000).toISOString() },
                      { type: 'payment', direction: 'in', amount: 150, description: 'Cobro C345678', created_at: new Date(Date.now() - 7200000).toISOString() },
                    ], operatorName: 'Juan Operador' }));
                    setPreviewTitle('Cierre de Caja'); setPreviewOpen(true);
                  }},
                  { label: 'Reporte Diario', fn: () => {
                    setPreviewHtml(generateDailySummaryHTML({ date: new Date(), stats: { totalVehicles: 87, subscribers: 32, hourly: 55, occupancyRate: 72, cashRevenue: 15200, cardRevenue: 8400, totalRevenue: 23600 } }));
                    setPreviewTitle('Reporte Diario'); setPreviewOpen(true);
                  }},
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Eye size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── QR SCANNER / PERIMETER DEVICES SECTION ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button onClick={() => setShowScannerSection(p => !p)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <QrCode size={20} className="text-emerald-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Dispositivos Perimetrales</h3>
              <p className="text-xs text-gray-400">Escaner QR, barreras y lectores de acceso ({scanners.length} configurados)</p>
            </div>
          </div>
          {showScannerSection ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
        </button>

        {showScannerSection && (
          <div className="border-t p-5 space-y-4">
            {/* Info box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm text-emerald-800 font-medium mb-1">Configuracion de Perimetrales</p>
              <p className="text-xs text-emerald-600">Registra los escaner QR fijos y dispositivos de barrera para automatizar la entrada y salida de vehiculos. Los dispositivos se conectan por red local (IP) o USB. Cuando estan instalados, el sistema valida automaticamente el QR del ticket o suscripcion.</p>
            </div>

            {/* Registered scanners */}
            <div>
              <p className="font-medium text-gray-700 text-sm mb-2">Dispositivos Registrados</p>
              {scanners.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <Radio size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">No hay dispositivos registrados</p>
                  <p className="text-gray-400 text-xs">Los dispositivos se configuran al instalar barreras y escaner QR</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scanners.map(sc => (
                    <div key={sc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors">
                      <div className="flex items-center gap-3">
                        {sc.type === 'qr_fixed' ? <QrCode size={20} className="text-emerald-500" /> :
                         sc.type === 'barrier' ? <Shield size={20} className="text-amber-500" /> :
                         <Wifi size={20} className="text-blue-500" />}
                        <div>
                          <p className="font-medium text-gray-800 text-sm flex items-center gap-2">
                            {sc.name}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sc.location === 'entry' ? 'bg-green-100 text-green-700' : sc.location === 'exit' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {sc.location === 'entry' ? 'Entrada' : sc.location === 'exit' ? 'Salida' : 'Ambos'}
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">
                            {sc.type === 'qr_fixed' ? 'Escaner QR Fijo' : sc.type === 'barrier' ? 'Barrera Automatica' : sc.type === 'camera' ? 'Camara LPR' : 'Otro'}
                            {sc.ip ? ` · IP: ${sc.ip}` : ''}
                            {sc.port ? `:${sc.port}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${sc.enabled !== false ? 'bg-green-400' : 'bg-gray-300'}`} title={sc.enabled !== false ? 'Activo' : 'Inactivo'} />
                        <button onClick={() => {
                          const updated = scanners.map(s => s.id === sc.id ? { ...s, enabled: !s.enabled } : s);
                          saveScanners(updated);
                          toast.success(sc.enabled !== false ? 'Dispositivo desactivado' : 'Dispositivo activado');
                        }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-emerald-600" title="Activar/Desactivar">
                          <Radio size={14} />
                        </button>
                        <button onClick={() => { const updated = scanners.filter(s => s.id !== sc.id); saveScanners(updated); toast.success('Dispositivo eliminado'); }}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add scanner form */}
            {showAddScanner ? (
              <div className="border border-dashed border-emerald-300 rounded-lg p-4 bg-emerald-50/50 space-y-3">
                <p className="font-medium text-gray-700 text-sm">Registrar Dispositivo</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Nombre (ej: Scanner Entrada Principal)" value={newScanner.name}
                    onChange={e => setNewScanner(p => ({ ...p, name: e.target.value }))}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <select value={newScanner.type} onChange={e => setNewScanner(p => ({ ...p, type: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="qr_fixed">Escaner QR Fijo</option>
                    <option value="barrier">Barrera Automatica</option>
                    <option value="camera">Camara LPR (Lectura Placas)</option>
                    <option value="handheld">Escaner QR Portatil</option>
                  </select>
                  <select value={newScanner.location} onChange={e => setNewScanner(p => ({ ...p, location: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="entry">Entrada</option>
                    <option value="exit">Salida</option>
                    <option value="both">Ambos (Entrada/Salida)</option>
                  </select>
                  <input placeholder="IP (ej: 192.168.1.100)" value={newScanner.ip}
                    onChange={e => setNewScanner(p => ({ ...p, ip: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  <input placeholder="Puerto (ej: 8080)" value={newScanner.port}
                    onChange={e => setNewScanner(p => ({ ...p, port: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddScanner(false)}
                    className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button onClick={() => {
                    if (!newScanner.name.trim()) { toast.warning('Ingresa un nombre para el dispositivo'); return; }
                    const device = { ...newScanner, id: `scanner_${Date.now()}`, enabled: true, createdAt: new Date().toISOString() };
                    saveScanners([...scanners, device]);
                    setNewScanner({ name: '', type: 'qr_fixed', location: 'entry', ip: '', port: '' });
                    setShowAddScanner(false);
                    toast.success('Dispositivo registrado');
                  }} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm hover:bg-emerald-700 flex items-center justify-center gap-1">
                    <Plus size={14} /> Registrar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddScanner(true)}
                className="w-full border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 flex items-center justify-center gap-2 transition-colors">
                <Plus size={16} /> Registrar Dispositivo Perimetral
              </button>
            )}

            {/* Integration info */}
            <div className="border-t pt-4 mt-2">
              <p className="font-medium text-gray-700 text-sm mb-2 flex items-center gap-2"><Wifi size={14} className="text-blue-500" /> Estado de Integracion</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {[
                  { label: 'Escaner QR', desc: scanners.filter(s => s.type === 'qr_fixed' && s.enabled !== false).length > 0 ? 'Configurado' : 'No instalado', active: scanners.filter(s => s.type === 'qr_fixed' && s.enabled !== false).length > 0 },
                  { label: 'Barreras', desc: scanners.filter(s => s.type === 'barrier' && s.enabled !== false).length > 0 ? 'Configurado' : 'No instalado', active: scanners.filter(s => s.type === 'barrier' && s.enabled !== false).length > 0 },
                  { label: 'Camara LPR', desc: scanners.filter(s => s.type === 'camera' && s.enabled !== false).length > 0 ? 'Configurado' : 'No instalado', active: scanners.filter(s => s.type === 'camera' && s.enabled !== false).length > 0 },
                ].map(({ label, desc, active }) => (
                  <div key={label} className={`p-3 rounded-lg border ${active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <p className={`font-medium ${active ? 'text-green-700' : 'text-gray-600'}`}>{label}</p>
                    <p className={`text-xs ${active ? 'text-green-600' : 'text-gray-400'}`}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} html={previewHtml} title={previewTitle} />

      {/* Categories without settings */}
      {categoryOrder.filter(cat => !grouped[cat] || grouped[cat].length === 0).length > 0 && (
        Object.keys(grouped).filter(cat => !categoryOrder.includes(cat)).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleCategory('_other')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Settings size={20} className="text-gray-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-800">Otros</h3>
                  <p className="text-xs text-gray-400">Configuraciones adicionales</p>
                </div>
              </div>
              {expandedCategories._other ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
            </button>
            {expandedCategories._other && (
              <div className="border-t divide-y divide-gray-50">
                {Object.keys(grouped).filter(cat => !categoryOrder.includes(cat)).flatMap(cat => grouped[cat]).map(setting => renderField(setting))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
