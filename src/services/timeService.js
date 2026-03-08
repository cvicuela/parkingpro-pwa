/**
 * TimeService — Hora sincronizada con internet.
 *
 * Consulta multiples APIs gratuitas para obtener la hora real.
 * Si ninguna responde, usa la hora local del dispositivo.
 * Se re-sincroniza cada hora automaticamente.
 */

const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hora
const FETCH_TIMEOUT = 5000; // 5 segundos por API

let offsetMs = 0;        // diferencia entre hora internet y hora local
let lastSyncAt = null;    // cuando fue la ultima sincronizacion
let syncSource = 'local'; // fuente de la ultima sincronizacion exitosa
let syncInterval = null;

// ── APIs gratuitas de hora (se prueban en orden, primera que responda gana) ──
const TIME_APIS = [
  {
    name: 'WorldTimeAPI',
    url: 'https://worldtimeapi.org/api/timezone/America/Santo_Domingo',
    parse: (data) => new Date(data.datetime).getTime(),
  },
  {
    name: 'TimeAPI.io',
    url: 'https://timeapi.io/api/time/current/zone?timeZone=America/Santo_Domingo',
    parse: (data) => new Date(`${data.year}-${String(data.month).padStart(2,'0')}-${String(data.day).padStart(2,'0')}T${String(data.hour).padStart(2,'0')}:${String(data.minute).padStart(2,'0')}:${String(data.seconds).padStart(2,'0')}`).getTime(),
  },
  {
    name: 'WorldClockAPI',
    url: 'https://www.timeapi.io/api/time/current/zone?timeZone=UTC',
    parse: (data) => new Date(`${data.year}-${String(data.month).padStart(2,'0')}-${String(data.day).padStart(2,'0')}T${String(data.hour).padStart(2,'0')}:${String(data.minute).padStart(2,'0')}:${String(data.seconds).padStart(2,'0')}Z`).getTime(),
  },
];

/**
 * Intenta obtener la hora de una API con timeout.
 */
async function fetchTimeFromAPI(api) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(api.url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const serverTime = api.parse(data);
    if (isNaN(serverTime) || serverTime < 1000000000000) throw new Error('Hora invalida');
    return { time: serverTime, source: api.name };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sincroniza la hora consultando las APIs en orden.
 * Retorna true si logro sincronizar, false si usa hora local.
 */
async function syncTime() {
  const localBefore = Date.now();

  for (const api of TIME_APIS) {
    try {
      const result = await fetchTimeFromAPI(api);
      const localAfter = Date.now();
      // Compensar el tiempo de la peticion (usar punto medio)
      const localMid = (localBefore + localAfter) / 2;
      offsetMs = result.time - localMid;
      lastSyncAt = new Date();
      syncSource = result.source;
      console.log(`[TimeService] Sincronizado con ${result.source} | offset: ${offsetMs > 0 ? '+' : ''}${Math.round(offsetMs)}ms`);
      return true;
    } catch (err) {
      console.warn(`[TimeService] ${api.name} fallo:`, err.message);
    }
  }

  // Ninguna API respondio — usar hora local
  offsetMs = 0;
  syncSource = 'local';
  lastSyncAt = new Date();
  console.warn('[TimeService] Sin conexion a APIs de hora — usando hora local del dispositivo');
  return false;
}

/**
 * Inicia el servicio: sincroniza ahora y programa re-sync cada hora.
 */
function startTimeService() {
  if (syncInterval) return; // ya iniciado
  syncTime(); // primera sincronizacion inmediata
  syncInterval = setInterval(syncTime, SYNC_INTERVAL);
}

/**
 * Detiene el servicio.
 */
function stopTimeService() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Obtiene la hora actual sincronizada (Date object).
 */
function now() {
  return new Date(Date.now() + offsetMs);
}

/**
 * Obtiene el timestamp actual sincronizado (ms).
 */
function timestamp() {
  return Date.now() + offsetMs;
}

/**
 * Obtiene la hora actual como ISO string.
 */
function nowISO() {
  return now().toISOString();
}

/**
 * Formatea la hora actual para mostrar en pantalla (hora local RD).
 */
function nowDisplay() {
  return now().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Formatea la fecha+hora actual para mostrar.
 */
function nowFullDisplay() {
  return now().toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/**
 * Info de estado del servicio.
 */
function getStatus() {
  return {
    offset: offsetMs,
    offsetFormatted: `${offsetMs > 0 ? '+' : ''}${(offsetMs / 1000).toFixed(1)}s`,
    source: syncSource,
    lastSync: lastSyncAt,
    synced: syncSource !== 'local',
  };
}

/**
 * Fuerza una re-sincronizacion inmediata.
 */
async function forceSync() {
  return await syncTime();
}

export {
  startTimeService,
  stopTimeService,
  now,
  timestamp,
  nowISO,
  nowDisplay,
  nowFullDisplay,
  getStatus,
  forceSync,
  syncTime,
};

export default {
  start: startTimeService,
  stop: stopTimeService,
  now,
  timestamp,
  nowISO,
  nowDisplay,
  nowFullDisplay,
  getStatus,
  forceSync,
};
