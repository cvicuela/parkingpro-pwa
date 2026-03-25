import tauriSerialService from './tauriSerialService';

/**
 * usbRelayService.js
 * Servicio para controlar módulos de relay USB (barreras de estacionamiento)
 * Utiliza la Web Serial API (navigator.serial) para comunicarse con
 * módulos LCUS-type HID y CH340/FTDI por puerto serial.
 *
 * Protocolos soportados:
 *   LCUS: [0xA0, canal, estado, checksum]
 *     - Abrir relay 1:  [0xA0, 0x01, 0x01, 0xA2]
 *     - Cerrar relay 1: [0xA0, 0x01, 0x00, 0xA1]
 *     - Abrir relay 2:  [0xA0, 0x02, 0x01, 0xA3]
 *     - Cerrar relay 2: [0xA0, 0x02, 0x00, 0xA2]
 *
 * Requiere HTTPS o localhost. El método requestPort() debe ser
 * invocado desde un gesto del usuario (click).
 */

// --- Protocolo LCUS ---
// Construye el comando de bytes para abrir/cerrar un canal específico
function buildLCUSCommand(channel, open) {
  const ch = channel & 0xFF;
  const state = open ? 0x01 : 0x00;
  const checksum = (0xA0 + ch + state) & 0xFF;
  return new Uint8Array([0xA0, ch, state, checksum]);
}

// --- Estado interno ---
const state = {
  connected: false,
  port: null,
  reader: null,
  writer: null,
  relayStates: { 1: false, 2: false },
  baudRate: 9600,
  autoCloseTimeout: 3, // segundos (para barrera)
  autoCloseTimers: {},  // timers activos por canal
  protocol: 'lcus',     // 'lcus' | 'ch340'
};

// --- Callback de eventos ---
let _onStatusChange = null;

/**
 * Notifica al suscriptor sobre cambios de estado
 */
function emitStatusChange() {
  if (typeof _onStatusChange === 'function') {
    try {
      _onStatusChange(usbRelayService.getStatus());
    } catch (e) {
      console.error('[usbRelayService] Error en onStatusChange callback:', e);
    }
  }
}

/**
 * Envía bytes crudos al puerto serial conectado
 */
async function sendBytes(data) {
  if (!state.connected || !state.writer) {
    throw new Error('No hay conexión activa con el relay USB');
  }
  try {
    await state.writer.write(data);
  } catch (err) {
    console.error('[usbRelayService] Error enviando datos:', err);
    // Si falla el envío, probablemente se desconectó
    await usbRelayService.disconnect();
    throw new Error('Error de comunicación con el relay. Dispositivo desconectado.');
  }
}

// --- Servicio principal ---
const usbRelayService = {

  /**
   * Verifica si el navegador soporta Web Serial API
   * @returns {boolean}
   */
  isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  },

  /**
   * Solicita al usuario seleccionar un puerto serial (requiere gesto del usuario)
   * @returns {Promise<SerialPort>} Puerto seleccionado
   */
  async requestPort() {
    if (!this.isSupported()) {
      throw new Error('Web Serial API no soportada en este navegador');
    }
    try {
      const port = await navigator.serial.requestPort();
      return port;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        throw new Error('No se seleccionó ningún dispositivo');
      }
      if (err.name === 'SecurityError') {
        throw new Error('Permiso denegado. Asegúrate de usar HTTPS o localhost.');
      }
      throw err;
    }
  },

  /**
   * Lista los puertos serial previamente autorizados
   * @returns {Promise<Array>} Lista de puertos
   */
  async listPorts() {
    if (!this.isSupported()) {
      return [];
    }
    try {
      const ports = await navigator.serial.getPorts();
      return ports;
    } catch (err) {
      console.error('[usbRelayService] Error listando puertos:', err);
      return [];
    }
  },

  /**
   * Conecta a un puerto serial específico
   * @param {SerialPort} port - Puerto a conectar
   * @param {Object} options - Opciones de conexión
   * @param {number} options.baudRate - Velocidad en baudios (default: 9600)
   * @param {string} options.protocol - Protocolo del relay: 'lcus' | 'ch340' (default: 'lcus')
   * @param {number} options.autoCloseTimeout - Tiempo de auto-cierre en segundos (default: 3)
   */
  async connect(port, options = {}) {
    if (!port) {
      throw new Error('Puerto no especificado');
    }

    // Si ya hay una conexión activa, desconectar primero
    if (state.connected) {
      await this.disconnect();
    }

    const baudRate = options.baudRate || 9600;
    const protocol = options.protocol || 'lcus';
    const autoCloseTimeout = options.autoCloseTimeout ?? 3;

    try {
      // Verificar si el puerto ya está abierto
      if (port.readable && port.writable) {
        console.warn('[usbRelayService] Puerto ya abierto, reutilizando conexión');
      } else {
        await port.open({ baudRate });
      }

      // Obtener writer para enviar comandos
      const writer = port.writable.getWriter();

      state.port = port;
      state.writer = writer;
      state.connected = true;
      state.baudRate = baudRate;
      state.protocol = protocol;
      state.autoCloseTimeout = autoCloseTimeout;
      state.relayStates = { 1: false, 2: false };

      // Escuchar desconexión inesperada
      if (port.addEventListener) {
        port.addEventListener('disconnect', () => {
          console.warn('[usbRelayService] Dispositivo desconectado inesperadamente');
          state.connected = false;
          state.port = null;
          state.writer = null;
          state.relayStates = { 1: false, 2: false };
          // Limpiar timers de auto-cierre
          Object.values(state.autoCloseTimers).forEach(clearTimeout);
          state.autoCloseTimers = {};
          emitStatusChange();
        });
      }

      emitStatusChange();
      return true;
    } catch (err) {
      console.error('[usbRelayService] Error conectando:', err);
      if (err.message?.includes('already open')) {
        throw new Error('El puerto ya está abierto por otra aplicación');
      }
      throw new Error(`Error al conectar: ${err.message}`);
    }
  },

  /**
   * Desconecta del puerto serial actual
   */
  async disconnect() {
    // Limpiar timers de auto-cierre
    Object.values(state.autoCloseTimers).forEach(clearTimeout);
    state.autoCloseTimers = {};

    try {
      if (state.writer) {
        state.writer.releaseLock();
        state.writer = null;
      }
      if (state.port) {
        await state.port.close();
      }
    } catch (err) {
      console.warn('[usbRelayService] Error al desconectar (puede ser normal):', err.message);
    }

    state.connected = false;
    state.port = null;
    state.relayStates = { 1: false, 2: false };
    emitStatusChange();
  },

  /**
   * Abre (activa) un canal del relay
   * @param {number} channel - Número de canal (1 o 2)
   * @returns {Promise<void>}
   */
  async openRelay(channel = 1) {
    const cmd = buildLCUSCommand(channel, true);
    await sendBytes(cmd);

    state.relayStates[channel] = true;
    emitStatusChange();

    // Auto-cierre después del timeout configurado
    if (state.autoCloseTimeout > 0) {
      // Cancelar timer previo si existe
      if (state.autoCloseTimers[channel]) {
        clearTimeout(state.autoCloseTimers[channel]);
      }
      state.autoCloseTimers[channel] = setTimeout(async () => {
        try {
          await this.closeRelay(channel);
        } catch (e) {
          console.error(`[usbRelayService] Error en auto-cierre del canal ${channel}:`, e);
        }
        delete state.autoCloseTimers[channel];
      }, state.autoCloseTimeout * 1000);
    }
  },

  /**
   * Cierra (desactiva) un canal del relay
   * @param {number} channel - Número de canal (1 o 2)
   * @returns {Promise<void>}
   */
  async closeRelay(channel = 1) {
    const cmd = buildLCUSCommand(channel, false);
    await sendBytes(cmd);

    state.relayStates[channel] = false;

    // Cancelar timer de auto-cierre si existe
    if (state.autoCloseTimers[channel]) {
      clearTimeout(state.autoCloseTimers[channel]);
      delete state.autoCloseTimers[channel];
    }

    emitStatusChange();
  },

  /**
   * Alterna el estado de un canal del relay
   * @param {number} channel - Número de canal (1 o 2)
   * @returns {Promise<void>}
   */
  async toggleRelay(channel = 1) {
    if (state.relayStates[channel]) {
      await this.closeRelay(channel);
    } else {
      await this.openRelay(channel);
    }
  },

  /**
   * Obtiene el estado actual del servicio
   * @returns {Object} Estado actual
   */
  getStatus() {
    const portInfo = {};
    if (state.port) {
      try {
        const info = state.port.getInfo();
        portInfo.vendorId = info.usbVendorId;
        portInfo.productId = info.usbProductId;
      } catch (e) {
        // getInfo puede no estar disponible en todos los navegadores
      }
    }
    return {
      connected: state.connected,
      port: state.port ? portInfo : null,
      relayStates: { ...state.relayStates },
      baudRate: state.baudRate,
      protocol: state.protocol,
      autoCloseTimeout: state.autoCloseTimeout,
    };
  },

  /**
   * Registra un callback para cambios de estado
   * @param {Function|null} callback - Función a llamar cuando cambia el estado
   */
  onStatusChange(callback) {
    _onStatusChange = callback;
  },

  /**
   * Actualiza la configuración sin reconectar
   * @param {Object} config
   * @param {number} config.autoCloseTimeout - Tiempo de auto-cierre en segundos
   * @param {string} config.protocol - Protocolo del relay
   */
  updateConfig(config = {}) {
    if (config.autoCloseTimeout !== undefined) {
      state.autoCloseTimeout = config.autoCloseTimeout;
    }
    if (config.protocol) {
      state.protocol = config.protocol;
    }
    emitStatusChange();
  },
};

// --- Auto-detect: Tauri native vs Web Serial API ---
const isTauri = !!window.__TAURI__;
const relayService = isTauri ? tauriSerialService : usbRelayService;

export default relayService;
export { usbRelayService, tauriSerialService };
