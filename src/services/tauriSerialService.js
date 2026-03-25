/**
 * tauriSerialService.js
 * Native serial communication via Tauri IPC (replaces Web Serial API)
 * Uses Tauri v2 invoke() to call Rust backend commands.
 */

const { invoke } = window.__TAURI__?.core || {};

// Internal state mirror (synced with Rust backend)
const state = {
  connected: false,
  portName: null,
  relayStates: { 1: false, 2: false },
  baudRate: 9600,
  protocol: 'lcus',
  autoCloseTimeout: 3,
};

let _onStatusChange = null;

function emitStatusChange() {
  if (typeof _onStatusChange === 'function') {
    try { _onStatusChange(tauriSerialService.getStatus()); } catch (e) { console.error('[tauriSerial] callback error:', e); }
  }
}

async function syncStatus() {
  try {
    const status = await invoke('serial_get_status');
    Object.assign(state, {
      connected: status.connected,
      portName: status.port_name || null,
      relayStates: status.relay_states || { 1: false, 2: false },
      baudRate: status.baud_rate || 9600,
      protocol: status.protocol || 'lcus',
      autoCloseTimeout: status.auto_close_timeout ?? 3,
    });
    emitStatusChange();
  } catch (e) { console.error('[tauriSerial] sync error:', e); }
}

const tauriSerialService = {
  isSupported() {
    return !!window.__TAURI__;
  },

  async listPorts() {
    // Returns array of { name, port_type, vendor_id, product_id }
    try {
      return await invoke('serial_list_ports');
    } catch (e) {
      console.error('[tauriSerial] listPorts error:', e);
      return [];
    }
  },

  // In Tauri mode, requestPort shows available ports and returns the selected port name
  async requestPort() {
    const ports = await this.listPorts();
    if (!ports.length) throw new Error('No se encontraron puertos seriales');
    // Return first port (UI should use listPorts + dropdown for selection)
    return ports[0];
  },

  async connect(port, options = {}) {
    const portName = typeof port === 'string' ? port : port?.name;
    if (!portName) throw new Error('Puerto no especificado');

    try {
      await invoke('serial_connect', {
        portName,
        baudRate: options.baudRate || 9600,
        protocol: options.protocol || 'lcus',
        autoCloseTimeout: options.autoCloseTimeout ?? 3,
      });
      await syncStatus();
      return true;
    } catch (e) {
      throw new Error(`Error al conectar: ${e}`);
    }
  },

  async disconnect() {
    try {
      await invoke('serial_disconnect');
      await syncStatus();
    } catch (e) {
      console.warn('[tauriSerial] disconnect error:', e);
    }
  },

  async openRelay(channel = 1) {
    try {
      await invoke('serial_open_relay', { channel });
      state.relayStates[channel] = true;
      emitStatusChange();
    } catch (e) {
      throw new Error(`Error abriendo relay canal ${channel}: ${e}`);
    }
  },

  async closeRelay(channel = 1) {
    try {
      await invoke('serial_close_relay', { channel });
      state.relayStates[channel] = false;
      emitStatusChange();
    } catch (e) {
      throw new Error(`Error cerrando relay canal ${channel}: ${e}`);
    }
  },

  async toggleRelay(channel = 1) {
    try {
      await invoke('serial_toggle_relay', { channel });
      await syncStatus();
    } catch (e) {
      throw new Error(`Error toggling relay canal ${channel}: ${e}`);
    }
  },

  getStatus() {
    return {
      connected: state.connected,
      port: state.portName ? { name: state.portName } : null,
      relayStates: { ...state.relayStates },
      baudRate: state.baudRate,
      protocol: state.protocol,
      autoCloseTimeout: state.autoCloseTimeout,
    };
  },

  onStatusChange(callback) {
    _onStatusChange = callback;
  },

  updateConfig(config = {}) {
    invoke('serial_update_config', {
      autoCloseTimeout: config.autoCloseTimeout,
      protocol: config.protocol || null,
    }).then(syncStatus).catch(e => console.error('[tauriSerial] updateConfig error:', e));
  },
};

export default tauriSerialService;
