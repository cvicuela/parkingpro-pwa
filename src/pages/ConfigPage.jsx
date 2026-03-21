import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsAPI, usersAPI, systemAPI } from '../services/api';
import { toast } from 'react-toastify';
import timeService from '../services/timeService';
import {
  Settings, Save, RotateCw, Building2, Receipt, Shield,
  Bell, Wallet, Globe, ChevronDown, ChevronRight, Plus, Trash2,
  Printer, Star, Eye, QrCode, Wifi, Radio, MapPin, Edit2, Clock, RefreshCw,
  Users, Lock, Unlock, Key, AlertTriangle, CreditCard, X, Check, Calendar,
  Database, ShieldAlert, Loader2
} from 'lucide-react';
import { getPrinters, addPrinter, removePrinter, setDefaultPrinter, getDefaultPrinter, generateEntryTicketHTML, generatePaymentReceiptHTML, generateCashReportHTML, generateDailySummaryHTML } from '../services/printService';
import PrintPreviewModal from '../components/PrintPreviewModal';
import RFIDPage from './RFIDPage';
import DispositivosPage from './DispositivosPage';

const categoryConfig = {
  general: { label: 'General', icon: Building2, color: 'indigo', description: 'Datos del negocio y moneda' },
  caja: { label: 'Caja Registradora', icon: Wallet, color: 'green', description: 'Umbrales y configuración de caja' },
  facturacion: { label: 'Facturación', icon: Receipt, color: 'blue', description: 'ITBIS y numeración interna' },
  antifraude: { label: 'Antifraude', icon: Shield, color: 'red', description: 'Límites de reembolso y protección' },
  notificaciones: { label: 'Notificaciones', icon: Bell, color: 'amber', description: 'Email, Telegram y alertas' },
  parqueo: { label: 'Parqueo', icon: Globe, color: 'purple', description: 'Espacios, tolerancia y mora' },
};

const fieldConfig = {
  business_name: { label: 'Nombre del Negocio', type: 'text', placeholder: 'ParkingPro' },
  business_rnc: { label: 'RNC', type: 'text', placeholder: '000-000000-0' },
  business_address: { label: 'Dirección', type: 'text', placeholder: 'Av. Principal #123' },
  business_phone: { label: 'Teléfono', type: 'text', placeholder: '809-000-0000' },
  currency: { label: 'Moneda', type: 'select', options: ['DOP', 'USD', 'EUR'] },
  cash_diff_threshold: { label: 'Umbral diferencia de caja (RD$)', type: 'number', hint: 'Diferencias mayores requieren aprobación del supervisor' },
  multi_register_enabled: { label: 'Múltiples cajas simultáneas', type: 'toggle' },
  tax_rate: { label: 'Tasa ITBIS', type: 'number', hint: '0.18 = 18%' },
  invoice_mode: { label: 'Modo de Facturación', type: 'select', options: ['fiscal', 'interno'], hint: 'Fiscal = NCF/DGII | Interno = numeración propia sin reporte fiscal' },
  internal_invoice_prefix: { label: 'Prefijo factura interna', type: 'text', hint: 'Solo modo interno. Ej: FAC, INV', placeholder: 'FAC' },
  internal_invoice_next: { label: 'Próximo número factura interna', type: 'number', hint: 'Número secuencial siguiente para facturas internas' },
  refund_limit_operator: { label: 'Límite reembolso por operador (RD$)', type: 'number', hint: 'Máximo que un operador puede reembolsar sin aprobación' },
  refund_daily_multiplier: { label: 'Multiplicador diario de reembolso', type: 'number', hint: 'Tope diario = limite x multiplicador' },
  notification_email_1_enabled: { hidden: true },
  notification_email_1: { label: 'Email 1 (Principal)', type: 'email', placeholder: 'admin@empresa.com', hint: 'Email principal para alertas de caja, reembolsos y alertas críticas', toggleKey: 'notification_email_1_enabled' },
  notification_email_2_enabled: { hidden: true },
  notification_email_2: { label: 'Email 2 (Secundario)', type: 'email', placeholder: 'gerente@empresa.com', hint: 'Email secundario para recibir copias de notificaciones', toggleKey: 'notification_email_2_enabled' },
  notification_email_3_enabled: { hidden: true },
  notification_email_3: { label: 'Email 3 (Adicional)', type: 'email', placeholder: 'supervisor@empresa.com', hint: 'Email adicional para notificaciones', toggleKey: 'notification_email_3_enabled' },
  telegram_enabled: { label: 'Notificaciones por Telegram', type: 'toggle', hint: 'Activar envío de alertas a los números configurados' },
  telegram_phone_1: { label: 'Telegram - Número 1 (Principal)', type: 'text', placeholder: '+1 809-000-0000', hint: 'Número de WhatsApp/Telegram para alertas' },
  telegram_phone_2: { label: 'Telegram - Número 2 (Opcional)', type: 'text', placeholder: '+1 809-000-0000' },
  telegram_phone_3: { label: 'Telegram - Número 3 (Opcional)', type: 'text', placeholder: '+1 809-000-0000' },
  parking_name: { label: 'Nombre del Parqueo', type: 'text' },
  total_spaces: { label: 'Total de Espacios', type: 'number' },
  grace_period_hours: { label: 'Período de Gracia (horas)', type: 'number' },
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
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-center gap-3">
            <p className="text-base font-mono font-bold text-gray-800 tracking-wider">
              {timeService.nowDisplay()}
            </p>
            <span className="text-gray-300">|</span>
            <p className="text-sm text-gray-500">{currentTime}</p>
          </div>
        </div>

        {/* Timezone info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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

// ─── RFID READERS SECTION ───
function RFIDReadersSection() {
  const READERS_KEY = 'pp_rfid_readers';
  const [expanded, setExpanded] = useState(true);
  const [readers, setReaders] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newReader, setNewReader] = useState({ name: '', connection: 'usb', location: 'entry', ip: '', port: '', protocol: 'wiegand' });

  useEffect(() => {
    try { setReaders(JSON.parse(localStorage.getItem(READERS_KEY) || '[]')); } catch { setReaders([]); }
  }, []);

  const saveReaders = (list) => { localStorage.setItem(READERS_KEY, JSON.stringify(list)); setReaders(list); };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <CreditCard size={20} className="text-orange-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">Lectores RFID / NFC</h3>
            <p className="text-xs text-gray-400">Configuración de lectores de tarjetas de proximidad ({readers.length} configurados)</p>
          </div>
        </div>
        {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t p-5 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-800 font-medium mb-1">Lectores de Tarjetas RFID/NFC</p>
            <p className="text-xs text-orange-600">Configura los lectores de tarjetas de proximidad para control de acceso. Los lectores se conectan por USB (HID), red local (TCP/IP) o Wiegand. Compatible con tarjetas MIFARE, EM4100, y NFC estándar.</p>
          </div>

          {/* Registered readers */}
          <div>
            <p className="font-medium text-gray-700 text-sm mb-2">Lectores Registrados</p>
            {readers.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <CreditCard size={36} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No hay lectores registrados</p>
                <p className="text-gray-400 text-xs">Registra los lectores RFID conectados al sistema</p>
              </div>
            ) : (
              <div className="space-y-2">
                {readers.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <CreditCard size={20} className={r.enabled !== false ? 'text-orange-500' : 'text-gray-400'} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm flex items-center gap-2">
                          {r.name}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.location === 'entry' ? 'bg-green-100 text-green-700' : r.location === 'exit' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {r.location === 'entry' ? 'Entrada' : r.location === 'exit' ? 'Salida' : 'Ambos'}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{r.protocol?.toUpperCase() || 'WIEGAND'}</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {r.connection === 'usb' ? 'USB (HID)' : r.connection === 'tcp' ? 'TCP/IP' : 'Wiegand'}
                          {r.ip ? ` · IP: ${r.ip}` : ''}
                          {r.port ? `:${r.port}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${r.enabled !== false ? 'bg-green-400' : 'bg-gray-300'}`} />
                      <button onClick={() => { saveReaders(readers.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x)); toast.success(r.enabled !== false ? 'Lector desactivado' : 'Lector activado'); }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600" title="Activar/Desactivar">
                        <Radio size={14} />
                      </button>
                      <button onClick={() => { saveReaders(readers.filter(x => x.id !== r.id)); toast.success('Lector eliminado'); }}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add reader form */}
          {showAdd ? (
            <div className="border border-dashed border-orange-300 rounded-lg p-4 bg-orange-50/50 space-y-3">
              <p className="font-medium text-gray-700 text-sm">Registrar Lector RFID</p>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Nombre (ej: Lector Entrada Principal)" value={newReader.name}
                  onChange={e => setNewReader(p => ({ ...p, name: e.target.value }))}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <select value={newReader.connection} onChange={e => setNewReader(p => ({ ...p, connection: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="usb">USB (HID)</option>
                  <option value="tcp">TCP/IP (Red)</option>
                  <option value="wiegand">Wiegand (Serial)</option>
                </select>
                <select value={newReader.location} onChange={e => setNewReader(p => ({ ...p, location: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="entry">Entrada</option>
                  <option value="exit">Salida</option>
                  <option value="both">Ambos</option>
                </select>
                <select value={newReader.protocol} onChange={e => setNewReader(p => ({ ...p, protocol: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="wiegand">Wiegand 26/34</option>
                  <option value="mifare">MIFARE Classic</option>
                  <option value="em4100">EM4100 (125kHz)</option>
                  <option value="nfc">NFC (13.56MHz)</option>
                  <option value="hid">HID iCLASS</option>
                </select>
                {newReader.connection === 'tcp' && (
                  <>
                    <input placeholder="IP (ej: 192.168.1.200)" value={newReader.ip}
                      onChange={e => setNewReader(p => ({ ...p, ip: e.target.value }))}
                      className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                    <input placeholder="Puerto (ej: 4370)" value={newReader.port}
                      onChange={e => setNewReader(p => ({ ...p, port: e.target.value }))}
                      className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={() => {
                  if (!newReader.name.trim()) { toast.warning('Ingresa un nombre para el lector'); return; }
                  const device = { ...newReader, id: `rfid_reader_${Date.now()}`, enabled: true, createdAt: new Date().toISOString() };
                  saveReaders([...readers, device]);
                  setNewReader({ name: '', connection: 'usb', location: 'entry', ip: '', port: '', protocol: 'wiegand' });
                  setShowAdd(false);
                  toast.success('Lector RFID registrado');
                }} className="flex-1 bg-orange-600 text-white rounded-lg py-2 text-sm hover:bg-orange-700 flex items-center justify-center gap-1">
                  <Plus size={14} /> Registrar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="w-full border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 flex items-center justify-center gap-2 transition-colors">
              <Plus size={16} /> Registrar Lector RFID
            </button>
          )}

          {/* Status */}
          <div className="border-t pt-4 mt-2">
            <p className="font-medium text-gray-700 text-sm mb-2 flex items-center gap-2"><Radio size={14} className="text-orange-500" /> Estado de Lectores</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              {[
                { label: 'Entrada', count: readers.filter(r => (r.location === 'entry' || r.location === 'both') && r.enabled !== false).length },
                { label: 'Salida', count: readers.filter(r => (r.location === 'exit' || r.location === 'both') && r.enabled !== false).length },
                { label: 'Total Activos', count: readers.filter(r => r.enabled !== false).length },
              ].map(({ label, count }) => (
                <div key={label} className={`p-3 rounded-lg border ${count > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`font-medium ${count > 0 ? 'text-green-700' : 'text-gray-600'}`}>{label}</p>
                  <p className={`text-xs ${count > 0 ? 'text-green-600' : 'text-gray-400'}`}>{count > 0 ? `${count} activo${count > 1 ? 's' : ''}` : 'Sin lectores'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SYSTEM USERS MANAGEMENT SECTION ───
function SystemUsersSection() {
  const [expanded, setExpanded] = useState(true);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showResetPw, setShowResetPw] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', phone: '', password: '', confirmPassword: '', role: 'operator', firstName: '', lastName: '' });
  const [resetPw, setResetPw] = useState({ password: '', confirmPassword: '' });
  const [savingUser, setSavingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.list();
      setUsers(data.data || data || []);
    } catch { toast.error('Error cargando usuarios'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (expanded) fetchUsers(); }, [expanded, fetchUsers]);

  const roleLabels = { super_admin: 'Super Admin', admin: 'Administrador', operator: 'Operador', customer: 'Cliente' };
  const roleColors = { super_admin: 'bg-red-100 text-red-700', admin: 'bg-purple-100 text-purple-700', operator: 'bg-blue-100 text-blue-700', customer: 'bg-gray-100 text-gray-600' };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) { toast.warning('Email y contraseña son requeridos'); return; }
    if (newUser.password !== newUser.confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    if (newUser.password.length < 6) { toast.warning('La contraseña debe tener al menos 6 caracteres'); return; }
    setSavingUser(true);
    try {
      await usersAPI.create(newUser);
      toast.success('Usuario creado exitosamente');
      setNewUser({ email: '', phone: '', password: '', confirmPassword: '', role: 'operator', firstName: '', lastName: '' });
      setShowAdd(false);
      fetchUsers();
    } catch (err) { toast.error(err.message || 'Error creando usuario'); }
    finally { setSavingUser(false); }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersAPI.update(user.id, { status: newStatus });
      toast.success(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}`);
      fetchUsers();
    } catch { toast.error('Error actualizando usuario'); }
  };

  const handleResetPassword = async (userId) => {
    if (!resetPw.password) { toast.warning('Ingresa la nueva contraseña'); return; }
    if (resetPw.password !== resetPw.confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    if (resetPw.password.length < 6) { toast.warning('La contraseña debe tener al menos 6 caracteres'); return; }
    try {
      await usersAPI.resetPassword(userId, resetPw.password);
      toast.success('Contraseña actualizada');
      setShowResetPw(null);
      setResetPw({ password: '', confirmPassword: '' });
    } catch (err) { toast.error(err.message || 'Error actualizando contraseña'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
            <Users size={20} className="text-teal-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">Usuarios del Sistema</h3>
            <p className="text-xs text-gray-400">Gestiona cuentas, roles y credenciales de acceso ({users.length} usuarios)</p>
          </div>
        </div>
        {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t p-5 space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
            <p className="text-sm text-teal-800 font-medium mb-1">Control de Acceso</p>
            <p className="text-xs text-teal-600">Administra los usuarios que pueden acceder al sistema. Cada usuario tiene un rol que define sus permisos: <strong>Super Admin</strong> (acceso total), <strong>Administrador</strong> (gestion), <strong>Operador</strong> (cobros y acceso).</p>
          </div>

          {/* Users table */}
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <Users size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">No hay usuarios del sistema</p>
              <p className="text-gray-400 text-xs">Crea el primer usuario para habilitar el acceso</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className={`rounded-lg border p-3 ${u.status === 'active' ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${u.status === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
                        {(u.first_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm flex items-center gap-2">
                          {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                            {roleLabels[u.role] || u.role}
                          </span>
                          {u.status !== 'active' && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactivo</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {u.email} {u.phone ? `· ${u.phone}` : ''}
                          {u.last_login_at ? ` · Ultimo acceso: ${new Date(u.last_login_at).toLocaleDateString('es-DO')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowResetPw(showResetPw === u.id ? null : u.id); setResetPw({ password: '', confirmPassword: '' }); }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600" title="Cambiar contraseña">
                        <Key size={14} />
                      </button>
                      <button onClick={() => handleToggleStatus(u)}
                        className={`p-1.5 rounded hover:bg-gray-100 ${u.status === 'active' ? 'text-gray-400 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                        title={u.status === 'active' ? 'Desactivar' : 'Activar'}>
                        {u.status === 'active' ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Reset password inline */}
                  {showResetPw === u.id && (
                    <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">Nueva contraseña para {u.email}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="password" placeholder="Nueva contraseña" value={resetPw.password}
                          onChange={e => setResetPw(p => ({ ...p, password: e.target.value }))}
                          className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                        <input type="password" placeholder="Confirmar contraseña" value={resetPw.confirmPassword}
                          onChange={e => setResetPw(p => ({ ...p, confirmPassword: e.target.value }))}
                          className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setShowResetPw(null)} className="px-3 py-1 text-xs border rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
                        <button onClick={() => handleResetPassword(u.id)} className="px-3 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-1">
                          <Key size={12} /> Cambiar Contraseña
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add user form */}
          {showAdd ? (
            <div className="border border-dashed border-teal-300 rounded-lg p-4 bg-teal-50/50 space-y-3">
              <p className="font-medium text-gray-700 text-sm">Crear Usuario del Sistema</p>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Nombre" value={newUser.firstName}
                  onChange={e => setNewUser(p => ({ ...p, firstName: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <input placeholder="Apellido" value={newUser.lastName}
                  onChange={e => setNewUser(p => ({ ...p, lastName: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <input placeholder="Email" type="email" value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                  className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <input placeholder="Teléfono" value={newUser.phone}
                  onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <input placeholder="Contraseña" type="password" value={newUser.password}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <input placeholder="Confirmar contraseña" type="password" value={newUser.confirmPassword}
                  onChange={e => setNewUser(p => ({ ...p, confirmPassword: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleCreateUser} disabled={savingUser}
                  className="flex-1 bg-teal-600 text-white rounded-lg py-2 text-sm hover:bg-teal-700 flex items-center justify-center gap-1 disabled:opacity-50">
                  {savingUser ? <RotateCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {savingUser ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="w-full border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/50 flex items-center justify-center gap-2 transition-colors">
              <Plus size={16} /> Crear Usuario
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COLLAPSIBLE SECTION WRAPPER (for embedding pages) ───
function CollapsibleSection({ icon: Icon, iconColor, title, subtitle, children }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
            <Icon size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
        </div>
        {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="border-t">
          {children}
        </div>
      )}
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
  // Double verification state
  const [confirmModal, setConfirmModal] = useState({ open: false, key: null, label: '', value: '' });
  // Reset data state
  const [resetStep, setResetStep] = useState(0); // 0=closed, 1=preview, 2=type code, 3=final confirm
  const [resetPreview, setResetPreview] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');

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
      // Cache settings in localStorage for printService (company name, RNC, etc.)
      try { localStorage.setItem('pp_settings', JSON.stringify(vals)); } catch {}
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

  // Critical fields that require double verification
  const criticalFields = ['tax_rate', 'invoice_mode', 'refund_limit_operator', 'refund_daily_multiplier', 'currency'];

  const doSave = async (key) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await settingsAPI.update(key, editValues[key]);
      toast.success(`${fieldConfig[key]?.label || key} actualizado`);
      setHasChanges(prev => ({ ...prev, [key]: false }));
      // Update localStorage cache for printService
      try {
        const cached = JSON.parse(localStorage.getItem('pp_settings') || '{}');
        cached[key] = editValues[key];
        localStorage.setItem('pp_settings', JSON.stringify(cached));
      } catch {}
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSave = (key) => {
    if (criticalFields.includes(key)) {
      setConfirmModal({ open: true, key, label: fieldConfig[key]?.label || key, value: editValues[key] });
    } else {
      doSave(key);
    }
  };

  const confirmSave = () => {
    if (confirmModal.key) doSave(confirmModal.key);
    setConfirmModal({ open: false, key: null, label: '', value: '' });
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

    // Skip hidden fields (rendered inline with their parent)
    if (config.hidden) return null;

    // Email field with inline blue toggle
    if (config.toggleKey) {
      const toggleVal = editValues[config.toggleKey] ?? 'false';
      const isOn = toggleVal === 'true' || toggleVal === true;
      const toggleChanged = hasChanges[config.toggleKey];
      const anyChanged = changed || toggleChanged;
      const anySaving = saving[key] || saving[config.toggleKey];

      const handleSaveBoth = async () => {
        if (changed) await handleSave(key);
        if (toggleChanged) await handleSave(config.toggleKey);
      };

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
              type="email"
              value={value}
              placeholder={config.placeholder || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && anyChanged) handleSaveBoth(); }}
              className={`px-3 py-1.5 border rounded-lg text-sm w-52 focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${changed ? 'border-blue-400 bg-blue-50' : 'border-gray-300'} ${!isOn ? 'opacity-50' : ''}`}
            />
            <button
              onClick={() => {
                const newVal = isOn ? 'false' : 'true';
                handleChange(config.toggleKey, newVal);
              }}
              title={isOn ? 'Desactivar email' : 'Activar email'}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${isOn ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            {anySaving ? (
              <RotateCw size={16} className="animate-spin text-blue-500" />
            ) : anyChanged ? (
              <button onClick={handleSaveBoth}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1">
                <Save size={12} /> Guardar
              </button>
            ) : null}
          </div>
        </div>
      );
    }

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
            <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
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
                  {cat === 'facturacion' && (
                    <div className="px-5 py-4 bg-blue-50/50 border-t">
                      <div className="flex items-center gap-3">
                        <Receipt size={18} className="text-blue-600" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">Secuencias NCF (Comprobantes Fiscales)</p>
                          <p className="text-xs text-gray-500">Las secuencias de comprobantes fiscales se gestionan desde la página de NCF, cumpliendo con los requisitos de la DGII.</p>
                        </div>
                        <a href="/ncf"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap">
                          <Receipt size={14} /> Gestionar NCF
                        </a>
                      </div>
                    </div>
                  )}
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
              <p className="text-xs text-gray-400">Gestiona impresoras térmicas y de recibos ({printers.length} configuradas)</p>
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
              <p className="text-sm text-blue-800 font-medium mb-1">Cómo funciona</p>
              <p className="text-xs text-blue-600">ParkingPro usa el <strong>diálogo de impresión nativo</strong> de tu sistema operativo (Windows, Mac, Linux). Al imprimir, se abrirá la ventana del SO donde puedes seleccionar cualquier impresora instalada, configurar copias, y ajustar preferencias.</p>
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
              <p className="text-sm text-emerald-800 font-medium mb-1">Configuración de Perimetrales</p>
              <p className="text-xs text-emerald-600">Registra los escáner QR fijos y dispositivos de barrera para automatizar la entrada y salida de vehículos. Los dispositivos se conectan por red local (IP) o USB. Cuando están instalados, el sistema valida automáticamente el QR del ticket o suscripción.</p>
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
                            {sc.type === 'qr_fixed' ? 'Escáner QR Fijo' : sc.type === 'barrier' ? 'Barrera Automática' : sc.type === 'camera' ? 'Cámara LPR' : 'Otro'}
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
                    <option value="qr_fixed">Escáner QR Fijo</option>
                    <option value="barrier">Barrera Automática</option>
                    <option value="camera">Cámara LPR (Lectura Placas)</option>
                    <option value="handheld">Escáner QR Portátil</option>
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
              <p className="font-medium text-gray-700 text-sm mb-2 flex items-center gap-2"><Wifi size={14} className="text-blue-500" /> Estado de Integración</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {[
                  { label: 'Escáner QR', desc: scanners.filter(s => s.type === 'qr_fixed' && s.enabled !== false).length > 0 ? 'Configurado' : 'No instalado', active: scanners.filter(s => s.type === 'qr_fixed' && s.enabled !== false).length > 0 },
                  { label: 'Barreras', desc: scanners.filter(s => s.type === 'barrier' && s.enabled !== false).length > 0 ? 'Configurado' : 'No instalado', active: scanners.filter(s => s.type === 'barrier' && s.enabled !== false).length > 0 },
                  { label: 'Cámara LPR', desc: scanners.filter(s => s.type === 'camera' && s.enabled !== false).length > 0 ? 'Configurado' : 'No instalado', active: scanners.filter(s => s.type === 'camera' && s.enabled !== false).length > 0 },
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

      {/* ─── RFID READERS SECTION ─── */}
      <RFIDReadersSection />

      {/* ─── SYSTEM USERS SECTION ─── */}
      <SystemUsersSection />

      {/* ─── RFID CARDS SECTION ─── */}
      <CollapsibleSection
        icon={CreditCard}
        iconColor="bg-violet-100 text-violet-600"
        title="Tarjetas RFID"
        subtitle="Gestión de tarjetas de proximidad, asignación y estados"
      >
        <RFIDPage />
      </CollapsibleSection>

      {/* ─── ZKTECO DEVICES SECTION ─── */}
      <CollapsibleSection
        icon={Shield}
        iconColor="bg-cyan-100 text-cyan-600"
        title="Dispositivos ZKTeco"
        subtitle="Barreras, cámaras LPR, controladores y lectores"
      >
        <DispositivosPage />
      </CollapsibleSection>

      {/* Print Preview Modal */}
      <PrintPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} html={previewHtml} title={previewTitle} />

      {/* ─── DOUBLE VERIFICATION MODAL ─── */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Confirmar Cambio Crítico</h3>
                <p className="text-sm text-gray-500">Esta acción requiere doble verificación</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">Estas a punto de modificar:</p>
              <p className="font-bold text-gray-900 mt-1">{confirmModal.label}</p>
              <p className="text-sm text-gray-600 mt-2">Nuevo valor: <span className="font-mono font-bold text-indigo-700">{confirmModal.value}</span></p>
            </div>
            <p className="text-xs text-gray-500">Los cambios en configuraciones fiscales, monetarias y de secuencia pueden afectar la facturación y reportes. Verifica que el valor es correcto antes de confirmar.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ open: false, key: null, label: '', value: '' })}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                <X size={16} /> Cancelar
              </button>
              <button onClick={confirmSave}
                className="flex-1 bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-amber-700 flex items-center justify-center gap-2">
                <Check size={16} /> Confirmar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ═══════════ ZONA DE PELIGRO: RESET DE DATOS ═══════════ */}
      <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden mt-8">
        <div className="bg-red-50 p-5 border-b border-red-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Database size={20} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-red-800 text-lg">Zona de Peligro</h3>
              <p className="text-xs text-red-500">Operaciones destructivas e irreversibles</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <ShieldAlert size={24} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800">Resetear Datos Operacionales</h4>
              <p className="text-sm text-gray-500 mt-1">
                Elimina todas las sesiones de parqueo, pagos, facturas, cuadres de caja, incidentes,
                notificaciones y registros de auditoría. <strong>Se preservan:</strong> usuarios, clientes,
                vehículos, planes, suscripciones, configuración general, NCF (rangos), RNC, nombre de empresa y gastos.
              </p>
              <button
                onClick={async () => {
                  setResetStep(1);
                  setResetLoading(true);
                  setResetCode('');
                  setResetPassword('');
                  try {
                    const preview = await systemAPI.resetPreview();
                    setResetPreview(preview);
                  } catch (err) {
                    toast.error(err.message || 'Error obteniendo preview');
                    setResetStep(0);
                  } finally {
                    setResetLoading(false);
                  }
                }}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Iniciar Reset de Datos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ MODAL: TRIPLE VERIFICACIÓN RESET ═══════════ */}
      {resetStep > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setResetStep(0); setResetCode(''); setResetPassword(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert size={24} className="text-white" />
                <div>
                  <h3 className="font-bold text-white text-lg">Reset de Datos</h3>
                  <p className="text-red-200 text-xs">Verificación {resetStep} de 3</p>
                </div>
              </div>
              <button onClick={() => { setResetStep(0); setResetCode(''); setResetPassword(''); }} className="text-red-200 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 px-6 pt-4">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= resetStep ? 'bg-red-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="p-6 space-y-4">
              {/* STEP 1: Preview */}
              {resetStep === 1 && (
                <>
                  <div className="text-center">
                    <AlertTriangle size={48} className="text-amber-500 mx-auto mb-3" />
                    <h4 className="font-bold text-gray-800 text-lg">Datos que se eliminaran</h4>
                    <p className="text-sm text-gray-500 mt-1">Revisa cuidadosamente antes de continuar</p>
                  </div>

                  {resetLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={32} className="animate-spin text-red-500" />
                    </div>
                  ) : resetPreview && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                      {[
                        { key: 'parking_sessions', label: 'Sesiones de Parqueo', icon: '🅿️' },
                        { key: 'payments', label: 'Pagos', icon: '💳' },
                        { key: 'invoices', label: 'Facturas', icon: '🧾' },
                        { key: 'cash_registers', label: 'Cuadres de Caja', icon: '💰' },
                        { key: 'cash_register_transactions', label: 'Transacciones de Caja', icon: '📊' },
                        { key: 'access_events', label: 'Eventos de Acceso', icon: '🚧' },
                        { key: 'incidents', label: 'Incidentes', icon: '⚠️' },
                        { key: 'notifications', label: 'Notificaciones', icon: '🔔' },
                        { key: 'audit_logs', label: 'Registros de Auditoria', icon: '📋' },
                      ].map(({ key, label, icon }) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{icon} {label}</span>
                          <span className="font-bold text-red-700">{(resetPreview[key] || 0).toLocaleString()} registros</span>
                        </div>
                      ))}
                      <div className="border-t border-red-300 pt-2 mt-2 flex items-center justify-between font-bold text-red-800">
                        <span>Total a eliminar</span>
                        <span>{Object.values(resetPreview).reduce((a, b) => a + (Number(b) || 0), 0).toLocaleString()} registros</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-800 mb-1">Se preservarán:</p>
                    <p className="text-xs text-green-700">Usuarios, Clientes, Vehículos, Planes, Suscripciones, Configuración General, NCF (rangos), RNC, Nombre Empresa, Gastos/Suplidores</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setResetStep(0); setResetCode(''); }} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={() => setResetStep(2)} disabled={resetLoading} className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {/* STEP 2: Type confirmation code */}
              {resetStep === 2 && (
                <>
                  <div className="text-center">
                    <Lock size={48} className="text-red-500 mx-auto mb-3" />
                    <h4 className="font-bold text-gray-800 text-lg">Código de Confirmación</h4>
                    <p className="text-sm text-gray-500 mt-1">Escribe el código exacto para continuar</p>
                  </div>

                  <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Escribe este código exactamente:</p>
                    <p className="font-mono font-bold text-lg text-red-700 tracking-wider select-all">RESETEAR-DATOS-OPERACIONALES</p>
                  </div>

                  <input
                    type="text"
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.toUpperCase())}
                    placeholder="Escribe el código aquí..."
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-center font-mono text-sm focus:border-red-500 focus:ring-red-500 focus:outline-none"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  {resetCode && resetCode !== 'RESETEAR-DATOS-OPERACIONALES' && (
                    <p className="text-xs text-red-500 text-center">El codigo no coincide</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setResetStep(1); setResetCode(''); }} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                      Atras
                    </button>
                    <button
                      onClick={() => setResetStep(3)}
                      disabled={resetCode !== 'RESETEAR-DATOS-OPERACIONALES'}
                      className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {/* STEP 3: Final password confirmation & execute */}
              {resetStep === 3 && (
                <>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3 animate-pulse">
                      <AlertTriangle size={32} className="text-red-600" />
                    </div>
                    <h4 className="font-bold text-red-800 text-xl">ULTIMA ADVERTENCIA</h4>
                    <p className="text-sm text-gray-500 mt-1">Esta accion es <strong>IRREVERSIBLE</strong></p>
                  </div>

                  <div className="bg-red-100 border border-red-300 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-bold text-red-800">Al confirmar se eliminaran permanentemente:</p>
                    <ul className="text-xs text-red-700 space-y-1 ml-4 list-disc">
                      <li>Todas las sesiones de parqueo y eventos de acceso</li>
                      <li>Todos los pagos y facturas generadas</li>
                      <li>Todos los cuadres de caja y transacciones</li>
                      <li>Todos los incidentes y notificaciones</li>
                      <li>Todos los registros de auditoria</li>
                    </ul>
                    <p className="text-xs text-red-800 font-bold pt-1">Los contadores NCF se reiniciaran a cero.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ingresa tu contraseña para confirmar:</label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      placeholder="Tu contraseña de super admin..."
                      className="w-full border-2 border-red-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-red-500 focus:outline-none"
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setResetStep(2); setResetPassword(''); }} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                      Atras
                    </button>
                    <button
                      onClick={async () => {
                        if (!resetPassword || resetPassword.length < 4) {
                          toast.error('Ingresa tu contraseña');
                          return;
                        }
                        setResetLoading(true);
                        try {
                          // Verify password by re-authenticating
                          const userStr = localStorage.getItem('pp_user');
                          const user = userStr ? JSON.parse(userStr) : null;
                          if (!user?.email) throw new Error('No se encontro el usuario actual');
                          const { authAPI } = await import('../services/api');
                          await authAPI.login({ email: user.email, password: resetPassword });
                          // Password verified, proceed with reset
                          const result = await systemAPI.resetData('RESETEAR-DATOS-OPERACIONALES');
                          toast.success(result.message || 'Datos reseteados exitosamente');
                          setResetStep(0);
                          setResetCode('');
                          setResetPassword('');
                          // Reload settings to reflect changes
                          fetchSettings();
                        } catch (err) {
                          if (err.message?.includes('credenciales') || err.message?.includes('Invalid') || err.message?.includes('password') || err.message?.includes('autenticacion')) {
                            toast.error('Contraseña incorrecta');
                          } else {
                            toast.error(err.message || 'Error al resetear datos');
                          }
                        } finally {
                          setResetLoading(false);
                        }
                      }}
                      disabled={!resetPassword || resetPassword.length < 4 || resetLoading}
                      className="flex-1 bg-red-700 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {resetLoading ? <><Loader2 size={16} className="animate-spin" /> Procesando...</> : 'ELIMINAR TODOS LOS DATOS'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
