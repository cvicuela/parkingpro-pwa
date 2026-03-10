import { useState, useEffect } from 'react';
import { devicesAPI } from '../services/api';
import { toast } from 'react-toastify';
import {
  Plus, Search, X, Wifi, WifiOff, Camera, Shield, Monitor,
  ChevronDown, ChevronUp, Play, Square, Trash2, Edit3, Settings,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, RefreshCw, Zap,
  Activity, MapPin, Hash, Clock, Server
} from 'lucide-react';

const DEVICE_TYPES = {
  barrier: { label: 'Barrera', icon: Shield, color: 'bg-blue-100 text-blue-700' },
  lpr_camera: { label: 'Camara LPR', icon: Camera, color: 'bg-purple-100 text-purple-700' },
  controller: { label: 'Controlador', icon: Server, color: 'bg-orange-100 text-orange-700' },
  reader: { label: 'Lector', icon: Monitor, color: 'bg-teal-100 text-teal-700' },
};

const DIRECTION_ICONS = {
  entry: ArrowDownLeft,
  exit: ArrowUpRight,
  bidirectional: ArrowLeftRight,
};

const DIRECTION_LABELS = {
  entry: 'Entrada',
  exit: 'Salida',
  bidirectional: 'Bidireccional',
};

const LOCATIONS = [
  { value: 'entrada_principal', label: 'Entrada Principal' },
  { value: 'salida_principal', label: 'Salida Principal' },
  { value: 'entrada_vip', label: 'Entrada VIP' },
  { value: 'salida_vip', label: 'Salida VIP' },
  { value: 'entrada_norte', label: 'Entrada Norte' },
  { value: 'salida_norte', label: 'Salida Norte' },
  { value: 'entrada_sur', label: 'Entrada Sur' },
  { value: 'salida_sur', label: 'Salida Sur' },
];

const MODELS = {
  barrier: ['PB3000', 'PB4000', 'PROBG3060', 'BGM-P060', 'PB-BG1000', 'CMP200'],
  lpr_camera: ['LPR6500', 'LPRS2000', 'ZK-LPR-CAM', 'IPC-B2200'],
  controller: ['C3-100', 'C3-200', 'C3-400', 'inBio160', 'inBio260', 'inBio460'],
  reader: ['KR500E', 'KR600E', 'KR500M', 'FR1300', 'FR1500-WP', 'ZK-RFID101', 'ZK-RFID201', 'CR10MW', 'CR20MW', 'SpeedFace-V5L', 'ProFace-X'],
};

const fmtTime = (d) => d ? new Date(d).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' }) : '-';

/* ─── Add/Edit Device Modal ─── */
function DeviceModal({ device, onClose, onSave }) {
  const [form, setForm] = useState(device ? {
    serial_number: device.serial_number,
    name: device.name,
    type: device.type,
    model: device.model,
    ip_address: device.ip_address || '',
    port: device.port || 4370,
    location: device.location,
    direction: device.direction,
    protocol: device.protocol || 'push',
    barrier_open_time: device.config?.barrier_open_time || 5,
    barrier_auto_close: device.config?.barrier_auto_close !== false,
    relay_number: device.config?.relay_number || 1,
    heartbeat_interval: device.config?.heartbeat_interval || 30,
    lpr_sensitivity: device.config?.lpr_sensitivity || 'high',
    wiegand_format: device.config?.wiegand_format || 26,
    read_mode: device.config?.read_mode || 'rfid',
    reader_buzzer: device.config?.reader_buzzer !== false,
    reader_led: device.config?.reader_led !== false,
  } : {
    serial_number: '',
    name: '',
    type: 'barrier',
    model: 'PB4000',
    ip_address: '',
    port: 4370,
    location: 'entrada_principal',
    direction: 'entry',
    protocol: 'push',
    barrier_open_time: 5,
    barrier_auto_close: true,
    relay_number: 1,
    heartbeat_interval: 30,
    lpr_sensitivity: 'high',
    wiegand_format: 26,
    read_mode: 'rfid',
    reader_buzzer: true,
    reader_led: true,
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [field]: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        serial_number: form.serial_number,
        name: form.name,
        type: form.type,
        model: form.model,
        ip_address: form.ip_address || null,
        port: parseInt(form.port) || 4370,
        location: form.location,
        direction: form.direction,
        protocol: form.protocol,
        config: {
          barrier_open_time: parseInt(form.barrier_open_time) || 5,
          barrier_auto_close: form.barrier_auto_close,
          relay_number: parseInt(form.relay_number) || 1,
          heartbeat_interval: parseInt(form.heartbeat_interval) || 30,
          lpr_sensitivity: form.lpr_sensitivity,
          wiegand_format: parseInt(form.wiegand_format) || 26,
          read_mode: form.read_mode,
          reader_buzzer: form.reader_buzzer,
          reader_led: form.reader_led,
        }
      };

      if (device) {
        await devicesAPI.update(device.serial_number, payload);
        toast.success('Dispositivo actualizado');
      } else {
        await devicesAPI.create(payload);
        toast.success('Dispositivo registrado');
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const models = MODELS[form.type] || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{device ? 'Editar Dispositivo' : 'Nuevo Dispositivo ZKTeco'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Serial + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Serie</label>
              <input value={form.serial_number} onChange={set('serial_number')} required
                disabled={!!device}
                placeholder="Ej: ZK2024001"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={form.name} onChange={set('name')} required
                placeholder="Ej: Barrera Entrada"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          {/* Type + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => {
                const newType = e.target.value;
                setForm({ ...form, type: newType, model: MODELS[newType]?.[0] || '' });
              }} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="barrier">Barrera</option>
                <option value="lpr_camera">Camara LPR</option>
                <option value="controller">Controlador</option>
                <option value="reader">Lector RFID/Bio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <select value={form.model} onChange={set('model')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* IP + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección IP</label>
              <input value={form.ip_address} onChange={set('ip_address')}
                placeholder="192.168.1.100"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
              <input type="number" value={form.port} onChange={set('port')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>

          {/* Location + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
              <select value={form.location} onChange={set('location')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <select value={form.direction} onChange={set('direction')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="entry">Entrada</option>
                <option value="exit">Salida</option>
                <option value="bidirectional">Bidireccional</option>
              </select>
            </div>
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Protocolo</label>
            <select value={form.protocol} onChange={set('protocol')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="push">PUSH (HTTP)</option>
              <option value="tcp">TCP/IP Directo</option>
              <option value="wiegand">Wiegand</option>
            </select>
          </div>

          {/* Barrier-specific config */}
          {(form.type === 'barrier' || form.type === 'controller') && (
            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-blue-800">Config. Barrera</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-700 mb-1">Tiempo apertura (seg)</label>
                  <input type="number" min="1" max="30" value={form.barrier_open_time} onChange={set('barrier_open_time')}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-blue-700 mb-1">No. Relay</label>
                  <select value={form.relay_number} onChange={set('relay_number')}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none">
                    <option value="1">Relay 1</option>
                    <option value="2">Relay 2</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-blue-700">
                <input type="checkbox" checked={form.barrier_auto_close} onChange={set('barrier_auto_close')}
                  className="rounded border-blue-300" />
                Cierre automatico
              </label>
            </div>
          )}

          {/* LPR-specific config */}
          {form.type === 'lpr_camera' && (
            <div className="bg-purple-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-purple-800">Config. Camara LPR</p>
              <div>
                <label className="block text-xs text-purple-700 mb-1">Sensibilidad</label>
                <select value={form.lpr_sensitivity} onChange={set('lpr_sensitivity')}
                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-purple-400 outline-none">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>
          )}

          {/* Reader-specific config */}
          {form.type === 'reader' && (
            <div className="bg-teal-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-teal-800">Config. Lector RFID/NFC</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-teal-700 mb-1">Formato Wiegand</label>
                  <select value={form.wiegand_format} onChange={set('wiegand_format')}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-400 outline-none">
                    <option value="26">Wiegand 26 bits</option>
                    <option value="34">Wiegand 34 bits</option>
                    <option value="37">Wiegand 37 bits</option>
                    <option value="0">Auto-detectar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-teal-700 mb-1">Modo de Lectura</label>
                  <select value={form.read_mode} onChange={set('read_mode')}
                    className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-400 outline-none">
                    <option value="rfid">Solo RFID/NFC</option>
                    <option value="rfid_pin">RFID + PIN</option>
                    <option value="fingerprint">Huella Digital</option>
                    <option value="face">Reconocimiento Facial</option>
                    <option value="multi">Multi-Factor</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-teal-700">
                  <input type="checkbox" checked={form.reader_buzzer} onChange={set('reader_buzzer')}
                    className="rounded border-teal-300" />
                  Buzzer al leer
                </label>
                <label className="flex items-center gap-2 text-sm text-teal-700">
                  <input type="checkbox" checked={form.reader_led} onChange={set('reader_led')}
                    className="rounded border-teal-300" />
                  LED indicador
                </label>
              </div>
              <p className="text-[11px] text-teal-600 mt-1">
                Este lector se puede usar para registrar y asignar tarjetas RFID/NFC desde la pagina de Tarjetas RFID.
              </p>
            </div>
          )}

          {/* Heartbeat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo Heartbeat (seg)</label>
            <input type="number" min="5" max="300" value={form.heartbeat_interval} onChange={set('heartbeat_interval')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Device Card Component ─── */
function DeviceCard({ device, onEdit, onDelete, onOpen, onClose: onCloseBarrier }) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = DEVICE_TYPES[device.type] || DEVICE_TYPES.barrier;
  const TypeIcon = typeInfo.icon;
  const DirIcon = DIRECTION_ICONS[device.direction] || ArrowLeftRight;
  const isOnline = device.status === 'online';
  const isBarrier = device.type === 'barrier' || device.type === 'controller';

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${isOnline ? 'border-gray-200' : 'border-red-200'} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
              <TypeIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800">{device.name}</h3>
                {isOnline
                  ? <Wifi size={14} className="text-green-500" />
                  : <WifiOff size={14} className="text-red-400" />
                }
              </div>
              <p className="text-xs text-gray-500">{device.model} &middot; {device.serial_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <span className="flex items-center gap-1"><MapPin size={13} /> {LOCATIONS.find(l => l.value === device.location)?.label || device.location}</span>
          <span className="flex items-center gap-1"><DirIcon size={13} /> {DIRECTION_LABELS[device.direction] || device.direction}</span>
          {device.ip_address && <span className="flex items-center gap-1 font-mono text-xs"><Hash size={13} /> {device.ip_address}:{device.port}</span>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          {isBarrier && (
            <>
              <button onClick={() => onOpen(device.serial_number)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200">
                <Play size={12} /> Abrir
              </button>
              <button onClick={() => onCloseBarrier(device.serial_number)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200">
                <Square size={12} /> Cerrar
              </button>
            </>
          )}
          <button onClick={() => onEdit(device)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200">
            <Edit3 size={12} /> Editar
          </button>
          <button onClick={() => onDelete(device.serial_number)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-50 text-red-500 rounded-lg hover:bg-red-50 border border-gray-200">
            <Trash2 size={12} />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="ml-auto flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600">
            <Settings size={12} /> {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded config details */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4 text-sm space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
            <span>Protocolo:</span><span className="font-medium">{device.protocol?.toUpperCase()}</span>
            <span>Firmware:</span><span className="font-medium">{device.firmware_version || '-'}</span>
            <span>Heartbeat:</span><span className="font-medium">{device.config?.heartbeat_interval || 30}s</span>
            {isBarrier && (
              <>
                <span>Tiempo apertura:</span><span className="font-medium">{device.config?.barrier_open_time || 5}s</span>
                <span>Relay:</span><span className="font-medium">#{device.config?.relay_number || 1}</span>
                <span>Cierre auto:</span><span className="font-medium">{device.config?.barrier_auto_close !== false ? 'Si' : 'No'}</span>
              </>
            )}
            {device.type === 'lpr_camera' && (
              <>
                <span>Sensibilidad LPR:</span><span className="font-medium capitalize">{device.config?.lpr_sensitivity || 'high'}</span>
              </>
            )}
            {device.type === 'reader' && (
              <>
                <span>Formato Wiegand:</span><span className="font-medium">{device.config?.wiegand_format || 26} bits</span>
                <span>Modo lectura:</span><span className="font-medium capitalize">{device.config?.read_mode || 'rfid'}</span>
                <span>Buzzer:</span><span className="font-medium">{device.config?.reader_buzzer !== false ? 'Si' : 'No'}</span>
              </>
            )}
            <span>Ultimo reporte:</span><span className="font-medium">{fmtTime(device.last_seen)}</span>
            {device.last_event && (
              <>
                <span>Ultimo evento:</span><span className="font-medium">{device.last_event.type} ({fmtTime(device.last_event.timestamp)})</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function DispositivosPage() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchDevices = async () => {
    try {
      const [devRes, statsRes] = await Promise.all([
        devicesAPI.list({ type: filterType || undefined }),
        devicesAPI.stats()
      ]);
      setDevices(devRes.data?.data || devRes.data || []);
      setStats(statsRes.data?.data || statsRes.data || null);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchDevices(); }, [filterType]);

  const handleOpenBarrier = async (serial) => {
    try {
      const res = await devicesAPI.openBarrier(serial);
      toast.success(res.data?.data?.message || res.data?.message || 'Barrera abierta');
    } catch (err) { toast.error(err.message || 'Error al abrir barrera'); }
  };

  const handleCloseBarrier = async (serial) => {
    try {
      await devicesAPI.closeBarrier(serial);
      toast.success('Barrera cerrada');
    } catch (err) { toast.error(err.message || 'Error al cerrar barrera'); }
  };

  const handleDelete = async (serial) => {
    if (!confirm(`Eliminar dispositivo ${serial}?`)) return;
    try {
      await devicesAPI.delete(serial);
      toast.success('Dispositivo eliminado');
      fetchDevices();
    } catch (err) { toast.error(err.message || 'Error al eliminar'); }
  };

  const filteredDevices = devices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name?.toLowerCase().includes(q)
      || d.serial_number?.toLowerCase().includes(q)
      || d.model?.toLowerCase().includes(q)
      || d.ip_address?.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dispositivos ZKTeco</h2>
          <p className="text-sm text-gray-500">Barreras, camaras LPR, controladores y lectores</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Agregar Dispositivo
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><Activity size={14} /> Total</div>
            <p className="text-2xl font-bold text-gray-800">{stats.total_devices}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-green-200">
            <div className="flex items-center gap-2 text-sm text-green-600 mb-1"><Wifi size={14} /> Online</div>
            <p className="text-2xl font-bold text-green-600">{stats.online}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-red-200">
            <div className="flex items-center gap-2 text-sm text-red-500 mb-1"><WifiOff size={14} /> Offline</div>
            <p className="text-2xl font-bold text-red-500">{stats.offline}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-blue-200">
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-1"><Shield size={14} /> Barreras</div>
            <p className="text-2xl font-bold text-blue-600">{stats.by_type?.barriers || 0}</p>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, serie, modelo o IP..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">Todos los tipos</option>
          <option value="barrier">Barreras</option>
          <option value="lpr_camera">Camaras LPR</option>
          <option value="controller">Controladores</option>
          <option value="reader">Lectores</option>
        </select>
        <button onClick={fetchDevices} className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Device List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Server size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-lg">No hay dispositivos registrados</p>
          <p className="text-gray-400 text-sm mt-1">Agrega tu primer dispositivo ZKTeco para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDevices.map(d => (
            <DeviceCard
              key={d.serial_number}
              device={d}
              onEdit={(dev) => { setEditing(dev); setShowModal(true); }}
              onDelete={handleDelete}
              onOpen={handleOpenBarrier}
              onClose={handleCloseBarrier}
            />
          ))}
        </div>
      )}

      {/* Recent Events */}
      {stats?.recent_events?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={14} /> Eventos Recientes
          </h3>
          <div className="space-y-2">
            {stats.recent_events.map((evt, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-amber-500" />
                  <span className="font-medium text-gray-700">{evt.serial_number}</span>
                  <span className="text-gray-500">{evt.event_type}</span>
                </div>
                <span className="text-xs text-gray-400">{fmtTime(evt.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DeviceModal
          device={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={() => { setShowModal(false); setEditing(null); fetchDevices(); }}
        />
      )}
    </div>
  );
}
