use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::Duration;
use flate2::write::ZlibEncoder;
use flate2::Compression;

use tauri::State;

// ─── Ports ────────────────────────────────────────────────────────────────────

const PORTS: &[u16] = &[8392, 8393, 8394, 8395, 8396, 8397];

// ─── Shared state: which port we're attached to (None = disconnected) ─────────

pub struct AttachedPort(pub Mutex<Option<u16>>);

// ─── Low-level helpers ────────────────────────────────────────────────────────

fn tcp_connect(port: u16, timeout_ms: u64) -> Result<TcpStream, String> {
    let addr: SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms))
        .map_err(|e| format!("port {}: {}", port, e))
}

fn compress_zlib(data: &[u8]) -> Vec<u8> {
    let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
    enc.write_all(data).ok();
    enc.finish().unwrap_or_else(|_| data.to_vec())
}

fn send_script(port: u16, code: &str) -> Result<(), String> {
    let mut stream = tcp_connect(port, 800)?;
    let payload = compress_zlib(code.as_bytes());
    stream
        .write_all(&payload)
        .map_err(|e| format!("write error on port {}: {}", port, e))
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// Try to attach to the first reachable port in 8392-8397.
/// Returns the port number as a string on success, or an error string.
#[tauri::command]
fn attach(state: State<AttachedPort>) -> Result<String, String> {
    for &port in PORTS {
        if tcp_connect(port, 400).is_ok() {
            *state.0.lock().unwrap() = Some(port);
            return Ok(port.to_string());
        }
    }
    Err("No executor found on ports 8392-8397".to_string())
}

/// Execute a Lua script on the currently attached port.
#[tauri::command]
fn execute(code: String, state: State<AttachedPort>) -> Result<String, String> {
    let maybe_port = *state.0.lock().unwrap();
    match maybe_port {
        Some(port) => {
            send_script(port, &code)?;
            Ok(format!("Executed on port {}", port))
        }
        None => Err("Not attached to any port. Press Attach first.".to_string()),
    }
}

/// Detach from the current port.
#[tauri::command]
fn detach(state: State<AttachedPort>) -> String {
    let mut lock = state.0.lock().unwrap();
    let old = *lock;
    *lock = None;
    match old {
        Some(p) => format!("Detached from port {}", p),
        None => "Not attached".to_string(),
    }
}

// ─── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AttachedPort(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![attach, execute, detach])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
