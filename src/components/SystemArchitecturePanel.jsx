import { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2,
  Monitor, Server, Database, Cloud, Wifi, Globe, HardDrive, Cpu,
  ArrowRight, ArrowDown, ChevronDown, ChevronRight, Shield, Zap,
  Smartphone, Router, Clock, ExternalLink, Info
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
const DEPLOYMENT_MODE = import.meta.env.VITE_DEPLOYMENT_MODE || 'remote';

// ── Status helpers ──────────────────────────────────────────
const STATUS = {
  ok: { color: 'green', icon: CheckCircle, label: 'Operativo', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  warning: { color: 'amber', icon: AlertTriangle, label: 'Degradado', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  error: { color: 'red', icon: XCircle, label: 'Sin conexión', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  checking: { color: 'blue', icon: Loader2, label: 'Verificando...', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  na: { color: 'gray', icon: Info, label: 'No aplica', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400' },
};

function StatusBadge({ status, label, latency }) {
  const s = STATUS[status] || STATUS.checking;
  const Icon = s.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text} ${s.border} border`}>
      <Icon size={12} className={status === 'checking' ? 'animate-spin' : ''} />
      <span>{label || s.label}</span>
      {latency != null && status === 'ok' && (
        <span className="text-[10px] opacity-70">{latency}ms</span>
      )}
    </div>
  );
}

// ── SVG Connection Arrow ────────────────────────────────────
function ConnectionLine({ from, to, status = 'ok', label, vertical = false }) {
  const s = STATUS[status] || STATUS.ok;
  const colors = { ok: '#22c55e', warning: '#f59e0b', error: '#ef4444', checking: '#3b82f6', na: '#9ca3af' };
  const color = colors[status] || colors.ok;

  if (vertical) {
    return (
      <div className="flex flex-col items-center py-1">
        <svg width="24" height="32" className="shrink-0">
          <line x1="12" y1="0" x2="12" y2="26" stroke={color} strokeWidth="2" strokeDasharray={status === 'error' ? '4,4' : 'none'} />
          <polygon points="7,22 12,32 17,22" fill={color} />
          {status === 'ok' && (
            <circle r="3" fill={color} opacity="0.6">
              <animateMotion dur="1.5s" repeatCount="indefinite" path="M12,0 L12,26" />
            </circle>
          )}
        </svg>
        {label && <span className="text-[10px] text-gray-400 -mt-1">{label}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 px-1">
      <svg width="48" height="24" className="shrink-0">
        <line x1="0" y1="12" x2="40" y2="12" stroke={color} strokeWidth="2" strokeDasharray={status === 'error' ? '4,4' : 'none'} />
        <polygon points="36,7 48,12 36,17" fill={color} />
        {status === 'ok' && (
          <circle r="3" fill={color} opacity="0.6">
            <animateMotion dur="1.5s" repeatCount="indefinite" path="M0,12 L40,12" />
          </circle>
        )}
      </svg>
      {label && <span className="text-[10px] text-gray-400 whitespace-nowrap">{label}</span>}
    </div>
  );
}

// ── Component Node (box in the diagram) ─────────────────────
function ComponentNode({ icon: Icon, name, subtitle, status = 'ok', details, onClick, highlight, badge }) {
  const s = STATUS[status] || STATUS.checking;
  const isClickable = !!onClick;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all min-w-[100px] ${
        highlight ? `${s.border} ${s.bg} shadow-md ring-2 ring-${s.color}-300/30` : `border-gray-200 bg-white hover:border-gray-300`
      } ${isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
    >
      {/* Status dot */}
      <div className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full ${s.dot} border-2 border-white shadow-sm ${
        status === 'ok' ? 'animate-pulse' : ''
      }`} />

      {badge && (
        <span className="absolute -top-2 -left-2 text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">
          {badge}
        </span>
      )}

      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        highlight ? `bg-${s.color}-100` : 'bg-gray-100'
      }`}>
        <Icon size={20} className={highlight ? `text-${s.color}-600` : 'text-gray-500'} />
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-800 leading-tight">{name}</p>
        {subtitle && <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{subtitle}</p>}
      </div>
      {details && <p className="text-[10px] text-gray-500 mt-0.5">{details}</p>}
    </button>
  );
}

// ── Detail Panel (expandable info per component) ────────────
function DetailPanel({ title, icon: Icon, items, color = 'indigo' }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${open ? `border-${color}-200` : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-3 text-sm transition-colors ${
          open ? `bg-${color}-50` : 'bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className={`text-${color}-600`} />
          <span className="font-medium text-gray-800">{title}</span>
        </div>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="border-t p-3 space-y-2 bg-white">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                item.status === 'ok' ? 'bg-green-500' : item.status === 'error' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-gray-400'
              }`} />
              <div>
                <span className="font-medium text-gray-700">{item.label}</span>
                {item.value && <span className="text-gray-500 ml-1">— {item.value}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function SystemArchitecturePanel() {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [health, setHealth] = useState(null);
  const [checks, setChecks] = useState({
    frontend: 'checking',
    backend: 'checking',
    database: 'checking',
    supabase: 'checking',
    socket: 'checking',
    internet: 'checking',
  });
  const [latencies, setLatencies] = useState({});
  const [backendInfo, setBackendInfo] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);

  // ── Run all health checks ──
  const runChecks = useCallback(async () => {
    setChecking(true);
    const newChecks = { ...checks };
    const newLatencies = {};

    // 1. Frontend — always ok if this code is running
    newChecks.frontend = 'ok';

    // 2. Backend API health check
    if (DEPLOYMENT_MODE === 'remote') {
      // In remote mode, no Express backend is expected
      newChecks.backend = 'na';
    } else {
      try {
        const t0 = performance.now();
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
        newLatencies.backend = Math.round(performance.now() - t0);
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
          setBackendInfo({
            environment: data.environment || 'unknown',
            uptime: data.uptime ? formatUptime(data.uptime) : 'N/A',
            mode: data.deploymentMode?.mode || DEPLOYMENT_MODE,
            modeLabel: data.deploymentMode?.label || DEPLOYMENT_MODE,
            features: data.deploymentMode?.features || {},
          });
          newChecks.backend = 'ok';
        } else {
          newChecks.backend = 'warning';
        }
      } catch {
        newChecks.backend = 'error';
      }
    }

    // 3. Database — check via a simple API call
    if (DEPLOYMENT_MODE === 'remote') {
      // In remote mode, DB is accessed via Supabase (checked below)
      newChecks.database = 'na';
    } else {
      try {
        const t0 = performance.now();
        const token = localStorage.getItem('pp_token') || '';
        const res = await fetch(`${API_BASE}/api/v1/setup/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        newLatencies.database = Math.round(performance.now() - t0);
        if (res.ok) {
          const data = await res.json();
          newChecks.database = 'ok';
          setDbInfo({
            setupComplete: data.isSetupComplete,
            steps: data.steps,
            deploymentMode: data.deploymentMode,
            hardware: data.hardware || {},
          });
        } else {
          newChecks.database = 'warning';
        }
      } catch {
        newChecks.database = 'error';
      }
    }

    // 4. Supabase — only relevant in remote/hybrid
    const mode = backendInfo?.mode || DEPLOYMENT_MODE;
    if (mode === 'local') {
      newChecks.supabase = 'na';
    } else if (SUPABASE_URL) {
      try {
        const t0 = performance.now();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}` },
          signal: AbortSignal.timeout(5000),
        });
        newLatencies.supabase = Math.round(performance.now() - t0);
        newChecks.supabase = res.ok || res.status === 401 || res.status === 406 ? 'ok' : 'warning';
      } catch {
        newChecks.supabase = 'error';
      }
    } else {
      newChecks.supabase = mode === 'remote' ? 'error' : 'na';
    }

    // 5. Socket.IO
    if (DEPLOYMENT_MODE === 'remote') {
      newChecks.socket = 'na';
    } else {
      try {
        const socketUrl = SOCKET_URL || API_BASE;
        const t0 = performance.now();
        const res = await fetch(`${socketUrl}/socket.io/?EIO=4&transport=polling`, { signal: AbortSignal.timeout(5000) });
        newLatencies.socket = Math.round(performance.now() - t0);
        newChecks.socket = res.ok ? 'ok' : 'warning';
      } catch {
        newChecks.socket = 'error';
      }
    }

    // 6. Internet — use Supabase connectivity as proxy (httpbin.org is unreliable)
    if (newChecks.supabase === 'ok') {
      newChecks.internet = 'ok';
      newLatencies.internet = newLatencies.supabase;
    } else {
      try {
        const t0 = performance.now();
        await fetch('https://www.google.com/generate_204', { mode: 'no-cors', signal: AbortSignal.timeout(4000) });
        newLatencies.internet = Math.round(performance.now() - t0);
        newChecks.internet = 'ok';
      } catch {
        newChecks.internet = 'error';
      }
    }

    setChecks(newChecks);
    setLatencies(newLatencies);
    setChecking(false);
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  // ── Derived state ──
  const mode = backendInfo?.mode || DEPLOYMENT_MODE;
  const overallStatus = Object.values(checks).every(c => c === 'ok' || c === 'na')
    ? 'ok'
    : Object.values(checks).some(c => c === 'error')
      ? 'error'
      : Object.values(checks).some(c => c === 'checking')
        ? 'checking'
        : 'warning';

  const modeConfig = {
    remote: { label: 'Remoto (Cloud)', icon: Cloud, color: 'blue', desc: 'PWA → Supabase RPC → PostgreSQL Cloud' },
    local: { label: 'Local (On-Premise)', icon: HardDrive, color: 'green', desc: 'PWA → Express API → PostgreSQL Local' },
    hybrid: { label: 'Híbrido', icon: RefreshCw, color: 'indigo', desc: 'PWA → Express API → PG Local → Sync → Supabase Cloud' },
  };
  const currentMode = modeConfig[mode] || modeConfig.remote;
  const ModeIcon = currentMode.icon;

  // ── Component details ──
  const frontendDetails = [
    { label: 'Framework', value: 'React + Vite (PWA)', status: 'ok' },
    { label: 'Modo de despliegue', value: currentMode.label, status: 'ok' },
    { label: 'API URL', value: API_BASE || 'No configurado', status: API_BASE ? 'ok' : 'error' },
    { label: 'Socket URL', value: SOCKET_URL || API_BASE || 'No configurado', status: 'ok' },
    { label: 'Supabase URL', value: SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] + '...' : 'No configurado', status: SUPABASE_URL ? 'ok' : mode === 'local' ? 'na' : 'warning' },
    { label: 'Service Worker', value: 'serviceWorker' in navigator ? 'Disponible' : 'No soportado', status: 'serviceWorker' in navigator ? 'ok' : 'warning' },
    { label: 'Navegador', value: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Otro', status: 'ok' },
  ];

  const backendDetails = [
    { label: 'Estado', value: checks.backend === 'ok' ? 'Operativo' : 'Sin conexión', status: checks.backend },
    { label: 'Entorno', value: backendInfo?.environment || 'N/A', status: 'ok' },
    { label: 'Uptime', value: backendInfo?.uptime || 'N/A', status: 'ok' },
    { label: 'Modo', value: backendInfo?.modeLabel || mode, status: 'ok' },
    { label: 'Latencia', value: latencies.backend ? `${latencies.backend}ms` : 'N/A', status: latencies.backend < 200 ? 'ok' : latencies.backend < 1000 ? 'warning' : 'error' },
    { label: 'Socket.IO', value: checks.socket === 'ok' ? 'Conectado' : 'Desconectado', status: checks.socket },
  ];

  const hasHardware = dbInfo?.hardware?.terminalsInstalled;
  const databaseDetails = [
    { label: 'Tipo', value: mode === 'local' ? 'PostgreSQL Local' : mode === 'hybrid' ? 'PostgreSQL Local + Supabase Cloud' : 'Supabase PostgreSQL', status: checks.database },
    { label: 'Conexión', value: checks.database === 'ok' ? 'Operativa' : 'Sin respuesta', status: checks.database },
    { label: 'Latencia', value: latencies.database ? `${latencies.database}ms` : 'N/A', status: latencies.database < 300 ? 'ok' : latencies.database < 1500 ? 'warning' : 'error' },
    { label: 'Setup completo', value: dbInfo?.setupComplete ? 'Sí' : 'No (software)', status: dbInfo?.setupComplete ? 'ok' : 'warning' },
    ...(dbInfo?.steps ? [
      { label: 'Admin creado', value: dbInfo.steps.adminCreated ? 'Sí' : 'No', status: dbInfo.steps.adminCreated ? 'ok' : 'error' },
      { label: 'Negocio configurado', value: dbInfo.steps.businessConfigured ? 'Sí' : 'No', status: dbInfo.steps.businessConfigured ? 'ok' : 'warning' },
      { label: 'Planes configurados', value: dbInfo.steps.plansConfigured ? 'Sí' : 'No', status: dbInfo.steps.plansConfigured ? 'ok' : 'warning' },
      { label: 'Terminales/Barreras', value: hasHardware ? `${dbInfo.hardware.terminalsCount} activas` : 'No instaladas', status: hasHardware ? 'ok' : 'na' },
    ] : []),
  ];

  const hardwareDetails = [
    { label: 'Barreras/Terminales', value: hasHardware ? `${dbInfo?.hardware?.terminalsCount || 0} instaladas` : 'No instaladas', status: hasHardware ? 'ok' : 'na' },
    { label: 'Relay / Controlador', value: 'No instalado', status: 'na' },
    { label: 'Sensores de presencia', value: 'No instalados', status: 'na' },
    { label: 'RFID / Lectores', value: 'No instalados', status: 'na' },
    { label: 'Dispositivos de cobro', value: 'No instalados', status: 'na' },
    { label: 'Caja registradora', value: 'No instalada', status: 'na' },
  ];

  const cloudDetails = [
    { label: 'Supabase', value: checks.supabase === 'ok' ? 'Conectado' : checks.supabase === 'na' ? 'No requerido' : 'Sin conexión', status: checks.supabase },
    { label: 'Latencia', value: latencies.supabase ? `${latencies.supabase}ms` : 'N/A', status: latencies.supabase < 300 ? 'ok' : latencies.supabase < 1000 ? 'warning' : 'error' },
    { label: 'Internet', value: checks.internet === 'ok' ? 'Conectado' : 'Sin acceso', status: checks.internet },
    { label: 'Sincronización', value: mode === 'hybrid' ? 'Activa' : mode === 'remote' ? 'N/A (todo en cloud)' : 'Desactivada', status: mode === 'hybrid' ? 'ok' : 'na' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <Activity size={20} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">Arquitectura del Sistema</h3>
            <p className="text-xs text-gray-400">Diagrama, componentes y estado en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={overallStatus} />
          {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t p-5 space-y-6">

          {/* ── Deployment Mode Banner ── */}
          <div className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-${currentMode.color}-50 to-${currentMode.color}-50/30 border border-${currentMode.color}-200`}>
            <div className={`w-12 h-12 rounded-xl bg-${currentMode.color}-100 flex items-center justify-center shrink-0`}>
              <ModeIcon size={24} className={`text-${currentMode.color}-600`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-800">{currentMode.label}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${currentMode.color}-600 text-white font-medium uppercase`}>Activo</span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{currentMode.desc}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); runChecks(); }}
              disabled={checking}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-${currentMode.color}-600 text-white text-sm rounded-lg hover:bg-${currentMode.color}-700 disabled:opacity-50 transition-colors shrink-0`}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Verificando...' : 'Re-verificar'}
            </button>
          </div>

          {/* ── VISUAL ARCHITECTURE DIAGRAM ── */}
          <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5 text-center">Flujo de Datos del Sistema</p>

            {/* Row 1: User Devices */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <ComponentNode icon={Smartphone} name="Operador" subtitle="Tablet/Móvil" status={checks.frontend} highlight={selectedNode === 'operator'} onClick={() => setSelectedNode(selectedNode === 'operator' ? null : 'operator')} />
              <ComponentNode icon={Monitor} name="Admin" subtitle="PC/Laptop" status={checks.frontend} highlight={selectedNode === 'admin'} onClick={() => setSelectedNode(selectedNode === 'admin' ? null : 'admin')} />
              <ComponentNode icon={Router} name="Barrera" subtitle={dbInfo?.hardware?.terminalsInstalled ? 'ZKTeco/Arduino' : 'No instalada'} status={dbInfo?.hardware?.terminalsInstalled ? checks.backend : 'na'} highlight={selectedNode === 'barrier'} onClick={() => setSelectedNode(selectedNode === 'barrier' ? null : 'barrier')} badge="IoT" />
            </div>

            {/* Arrow down */}
            <div className="flex justify-center">
              <ConnectionLine vertical status={checks.frontend} label="HTTPS / WSS" />
            </div>

            {/* Row 2: Frontend */}
            <div className="flex items-center justify-center mb-2">
              <ComponentNode icon={Globe} name="ParkingPro PWA" subtitle="React + Vite" status={checks.frontend} highlight={selectedNode === 'pwa'} onClick={() => setSelectedNode(selectedNode === 'pwa' ? null : 'pwa')} badge="SPA" />
            </div>

            {/* Arrow down — splits based on mode */}
            <div className="flex justify-center">
              <ConnectionLine vertical status={checks.backend} label={mode === 'remote' ? 'Supabase RPC' : 'REST API'} />
            </div>

            {/* Row 3: Backend / Supabase */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {mode !== 'remote' && (
                <>
                  <ComponentNode icon={Server} name="Express API" subtitle={`Puerto ${API_BASE.split(':').pop() || '3000'}`} status={checks.backend} highlight={selectedNode === 'api'} onClick={() => setSelectedNode(selectedNode === 'api' ? null : 'api')} badge="Node.js" />
                  <ConnectionLine status={checks.database} label="pg pool" />
                </>
              )}
              {mode === 'remote' ? (
                <ComponentNode icon={Cloud} name="Supabase" subtitle="Auth + RPC + Realtime" status={checks.supabase} highlight={selectedNode === 'supabase'} onClick={() => setSelectedNode(selectedNode === 'supabase' ? null : 'supabase')} badge="Cloud" />
              ) : mode === 'hybrid' ? (
                <>
                  <ComponentNode icon={Database} name="PostgreSQL Local" subtitle="Primario" status={checks.database} highlight={selectedNode === 'db'} onClick={() => setSelectedNode(selectedNode === 'db' ? null : 'db')} badge="Local" />
                  <ConnectionLine status={checks.supabase} label="Sync" />
                  <ComponentNode icon={Cloud} name="Supabase" subtitle="Backup/Sync" status={checks.supabase} highlight={selectedNode === 'supabase'} onClick={() => setSelectedNode(selectedNode === 'supabase' ? null : 'supabase')} badge="Cloud" />
                </>
              ) : (
                <ComponentNode icon={Database} name="PostgreSQL" subtitle="Base de Datos Local" status={checks.database} highlight={selectedNode === 'db'} onClick={() => setSelectedNode(selectedNode === 'db' ? null : 'db')} badge="Local" />
              )}
            </div>

            {/* Row 4: Socket.IO (lateral) */}
            <div className="flex items-center justify-center mt-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-dashed border-gray-300">
                <Zap size={14} className={checks.socket === 'ok' ? 'text-green-500' : 'text-red-400'} />
                <span className="text-xs text-gray-600">Socket.IO — Tiempo Real</span>
                <StatusBadge status={checks.socket} label={checks.socket === 'ok' ? 'Conectado' : 'Desconectado'} latency={latencies.socket} />
              </div>
            </div>
          </div>

          {/* ── STATUS SUMMARY BAR ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { key: 'frontend', label: 'Frontend', icon: Monitor },
              { key: 'backend', label: 'Backend', icon: Server },
              { key: 'database', label: 'Base de Datos', icon: Database },
              { key: 'supabase', label: 'Supabase', icon: Cloud },
              { key: 'socket', label: 'Socket.IO', icon: Zap },
              { key: 'internet', label: 'Internet', icon: Globe },
            ].map(({ key, label, icon: Icon }) => {
              const s = STATUS[checks[key]] || STATUS.checking;
              return (
                <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg ${s.bg} border ${s.border}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${s.dot} ${checks[key] === 'ok' ? 'animate-pulse' : ''}`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-medium truncate">{label}</p>
                    <p className={`text-xs font-bold ${s.text} truncate`}>
                      {checks[key] === 'ok' ? (latencies[key] ? `${latencies[key]}ms` : 'OK') : s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DETAILED INFO PANELS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DetailPanel title="Frontend (PWA)" icon={Monitor} items={frontendDetails} color="blue" />
            <DetailPanel title="Backend (API)" icon={Server} items={backendDetails} color="green" />
            <DetailPanel title="Base de Datos" icon={Database} items={databaseDetails} color="purple" />
            <DetailPanel title="Cloud y Red" icon={Cloud} items={cloudDetails} color="indigo" />
            <DetailPanel title="Hardware / Dispositivos" icon={Cpu} items={hardwareDetails} color="gray" />
          </div>

          {/* ── TROUBLESHOOTING GUIDE ── */}
          {(checks.backend === 'error' || checks.database === 'error' || checks.supabase === 'error') && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-600" />
                <p className="font-semibold text-red-800">Problemas Detectados</p>
              </div>
              <div className="space-y-2 text-sm text-red-700">
                {checks.backend === 'error' && (
                  <div className="flex items-start gap-2">
                    <XCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Backend sin conexión</p>
                      <p className="text-xs text-red-600 mt-0.5">Verifique que el servidor Express esté corriendo en <code className="bg-red-100 px-1 rounded">{API_BASE}</code>. Ejecute <code className="bg-red-100 px-1 rounded">npm start</code> en el directorio del backend.</p>
                    </div>
                  </div>
                )}
                {checks.database === 'error' && (
                  <div className="flex items-start gap-2">
                    <XCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Base de datos sin respuesta</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        {mode === 'local'
                          ? 'Verifique que PostgreSQL esté corriendo localmente y que DATABASE_URL sea correcto en el .env del backend.'
                          : 'Verifique la conexión a Supabase y que las credenciales SUPABASE_URL y SUPABASE_SERVICE_KEY sean correctas.'}
                      </p>
                    </div>
                  </div>
                )}
                {checks.supabase === 'error' && mode !== 'local' && (
                  <div className="flex items-start gap-2">
                    <XCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Supabase sin conexión</p>
                      <p className="text-xs text-red-600 mt-0.5">Verifique que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY estén correctos en el .env del frontend. URL actual: <code className="bg-red-100 px-1 rounded">{SUPABASE_URL || 'no configurado'}</code></p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── All OK message ── */}
          {overallStatus === 'ok' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Todos los componentes operativos</p>
                <p className="text-xs text-green-600 mt-0.5">El sistema ParkingPro está funcionando correctamente en modo {currentMode.label}.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
