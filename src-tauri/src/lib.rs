use serde::Serialize;
use serialport::SerialPortType;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SerialStatus {
    pub connected: bool,
    pub port_name: String,
    pub relay_states: HashMap<u8, bool>,
    pub baud_rate: u32,
    pub protocol: String,
    pub auto_close_timeout: u32,
}

pub struct SerialState {
    port: Option<Box<dyn serialport::SerialPort>>,
    connected: bool,
    port_name: String,
    relay_states: HashMap<u8, bool>,
    baud_rate: u32,
    protocol: String,
    auto_close_timeout: u32,
    /// Cancel flags for auto-close timers, keyed by channel number.
    auto_close_cancel: HashMap<u8, Arc<AtomicBool>>,
}

impl Default for SerialState {
    fn default() -> Self {
        let mut relay_states = HashMap::new();
        relay_states.insert(1, false);
        relay_states.insert(2, false);
        Self {
            port: None,
            connected: false,
            port_name: String::new(),
            relay_states,
            baud_rate: 9600,
            protocol: "LCUS".to_string(),
            auto_close_timeout: 3,
            auto_close_cancel: HashMap::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// LCUS protocol helpers
// ---------------------------------------------------------------------------

fn lcus_open_command(channel: u8) -> [u8; 4] {
    let checksum = (0xA0u16 + channel as u16 + 0x01u16) as u8;
    [0xA0, channel, 0x01, checksum]
}

fn lcus_close_command(channel: u8) -> [u8; 4] {
    let checksum = (0xA0u16 + channel as u16 + 0x00u16) as u8;
    [0xA0, channel, 0x00, checksum]
}

fn write_to_port(port: &mut Box<dyn serialport::SerialPort>, data: &[u8]) -> Result<(), String> {
    port.write_all(data)
        .map_err(|e| format!("Error al escribir en el puerto serial: {}", e))?;
    port.flush()
        .map_err(|e| format!("Error al vaciar el buffer del puerto serial: {}", e))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn serial_list_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports()
        .map_err(|e| format!("Error al listar puertos seriales: {}", e))?;

    let result: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| {
            let (port_type, vendor_id, product_id) = match &p.port_type {
                SerialPortType::UsbPort(info) => (
                    "USB".to_string(),
                    Some(info.vid),
                    Some(info.pid),
                ),
                SerialPortType::BluetoothPort => ("Bluetooth".to_string(), None, None),
                SerialPortType::PciPort => ("PCI".to_string(), None, None),
                SerialPortType::Unknown => ("Desconocido".to_string(), None, None),
            };
            PortInfo {
                name: p.port_name,
                port_type,
                vendor_id,
                product_id,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
fn serial_connect(
    port_name: String,
    baud_rate: u32,
    protocol: String,
    auto_close_timeout: u32,
    state: tauri::State<'_, Mutex<SerialState>>,
) -> Result<(), String> {
    let mut s = state
        .lock()
        .map_err(|e| format!("Error al acceder al estado: {}", e))?;

    // Close existing connection if any
    if s.connected {
        if let Some(ref mut _port) = s.port {
            // Drop happens automatically when we replace
        }
        s.port = None;
        s.connected = false;
    }

    let port = serialport::new(&port_name, baud_rate)
        .timeout(Duration::from_millis(1000))
        .open()
        .map_err(|e| format!("Error al abrir el puerto '{}': {}", port_name, e))?;

    s.port = Some(port);
    s.connected = true;
    s.port_name = port_name;
    s.baud_rate = baud_rate;
    s.protocol = protocol;
    s.auto_close_timeout = auto_close_timeout;

    // Reset relay states
    s.relay_states.insert(1, false);
    s.relay_states.insert(2, false);

    Ok(())
}

#[tauri::command]
fn serial_disconnect(state: tauri::State<'_, Mutex<SerialState>>) -> Result<(), String> {
    let mut s = state
        .lock()
        .map_err(|e| format!("Error al acceder al estado: {}", e))?;

    if !s.connected {
        return Err("No hay conexión serial activa para desconectar".to_string());
    }

    // Cancel all pending auto-close timers
    for (_, cancel_flag) in s.auto_close_cancel.drain() {
        cancel_flag.store(true, Ordering::Relaxed);
    }

    s.port = None;
    s.connected = false;
    s.port_name.clear();
    s.relay_states.insert(1, false);
    s.relay_states.insert(2, false);

    Ok(())
}

#[tauri::command]
fn serial_open_relay(
    channel: u8,
    state: tauri::State<'_, Mutex<SerialState>>,
) -> Result<(), String> {
    // Cancel any previous auto-close timer for this channel
    {
        let s = state
            .lock()
            .map_err(|e| format!("Error al acceder al estado: {}", e))?;
        if let Some(flag) = s.auto_close_cancel.get(&channel) {
            flag.store(true, Ordering::Relaxed);
        }
    }

    // Send open command
    {
        let mut s = state
            .lock()
            .map_err(|e| format!("Error al acceder al estado: {}", e))?;

        if !s.connected {
            return Err("No hay conexión serial activa".to_string());
        }

        let cmd = lcus_open_command(channel);
        let port = s
            .port
            .as_mut()
            .ok_or_else(|| "Puerto serial no disponible".to_string())?;
        write_to_port(port, &cmd)?;
        s.relay_states.insert(channel, true);
    }

    // Schedule auto-close if timeout > 0
    let timeout;
    {
        let s = state
            .lock()
            .map_err(|e| format!("Error al acceder al estado: {}", e))?;
        timeout = s.auto_close_timeout;
    }

    if timeout > 0 {
        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut s = state
                .lock()
                .map_err(|e| format!("Error al acceder al estado: {}", e))?;
            s.auto_close_cancel.insert(channel, cancel_flag.clone());
        }

        let state_inner = state.inner().clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(timeout as u64));

            if cancel_flag.load(Ordering::Relaxed) {
                return;
            }

            let mut s = match state_inner.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            if !s.connected {
                return;
            }

            let cmd = lcus_close_command(channel);
            if let Some(ref mut port) = s.port {
                let _ = write_to_port(port, &cmd);
            }
            s.relay_states.insert(channel, false);
            s.auto_close_cancel.remove(&channel);
        });
    }

    Ok(())
}

#[tauri::command]
fn serial_close_relay(
    channel: u8,
    state: tauri::State<'_, Mutex<SerialState>>,
) -> Result<(), String> {
    // Cancel any pending auto-close timer for this channel
    let mut s = state
        .lock()
        .map_err(|e| format!("Error al acceder al estado: {}", e))?;

    if let Some(flag) = s.auto_close_cancel.get(&channel) {
        flag.store(true, Ordering::Relaxed);
    }
    s.auto_close_cancel.remove(&channel);

    if !s.connected {
        return Err("No hay conexión serial activa".to_string());
    }

    let cmd = lcus_close_command(channel);
    let port = s
        .port
        .as_mut()
        .ok_or_else(|| "Puerto serial no disponible".to_string())?;
    write_to_port(port, &cmd)?;
    s.relay_states.insert(channel, false);

    Ok(())
}

#[tauri::command]
fn serial_toggle_relay(
    channel: u8,
    state: tauri::State<'_, Mutex<SerialState>>,
) -> Result<(), String> {
    let currently_open = {
        let s = state
            .lock()
            .map_err(|e| format!("Error al acceder al estado: {}", e))?;
        *s.relay_states.get(&channel).unwrap_or(&false)
    };

    if currently_open {
        serial_close_relay(channel, state)
    } else {
        serial_open_relay(channel, state)
    }
}

#[tauri::command]
fn serial_get_status(state: tauri::State<'_, Mutex<SerialState>>) -> Result<SerialStatus, String> {
    let s = state
        .lock()
        .map_err(|e| format!("Error al acceder al estado: {}", e))?;

    Ok(SerialStatus {
        connected: s.connected,
        port_name: s.port_name.clone(),
        relay_states: s.relay_states.clone(),
        baud_rate: s.baud_rate,
        protocol: s.protocol.clone(),
        auto_close_timeout: s.auto_close_timeout,
    })
}

#[tauri::command]
fn serial_update_config(
    auto_close_timeout: Option<u32>,
    protocol: Option<String>,
    state: tauri::State<'_, Mutex<SerialState>>,
) -> Result<(), String> {
    let mut s = state
        .lock()
        .map_err(|e| format!("Error al acceder al estado: {}", e))?;

    if let Some(timeout) = auto_close_timeout {
        s.auto_close_timeout = timeout;
    }
    if let Some(proto) = protocol {
        s.protocol = proto;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Mutex::new(SerialState::default()))
        .invoke_handler(tauri::generate_handler![
            serial_list_ports,
            serial_connect,
            serial_disconnect,
            serial_open_relay,
            serial_close_relay,
            serial_toggle_relay,
            serial_get_status,
            serial_update_config,
        ])
        .setup(|app| {
            // --- System tray ---
            let show_item =
                MenuItemBuilder::with_id("show", "Mostrar ParkingPro").build(app)?;
            let hide_item =
                MenuItemBuilder::with_id("hide", "Ocultar").build(app)?;
            let quit_item =
                MenuItemBuilder::with_id("quit", "Salir").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&quit_item)
                .build()?;

            TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("ParkingPro")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("Error al ejecutar ParkingPro");
}
