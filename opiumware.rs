use std::error::Error;
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use flate2::write::ZlibEncoder;
use flate2::Compression;

// ─── Ports 8392-8397 (matches official Opiumware API) ────────────────────────
const PORTS: &[&str] = &["8392", "8393", "8394", "8395", "8396", "8397"];

// ─── Opiumware script prefix ──────────────────────────────────────────────────
// IMPORTANT: Every script MUST be prefixed with "OpiumwareScript " or it will
// not execute. This matches the official JS reference implementation exactly.
const PREFIX: &str = "OpiumwareScript ";

fn compress_data(data: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
    // RFC 1950 zlib format — identical to Node.js Zlib.deflate output
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data)?;
    Ok(encoder.finish()?)
}

fn send_bytes(stream: &mut TcpStream, message: &str) -> Result<usize, String> {
    let compressed = compress_data(message.as_bytes()).map_err(|e| e.to_string())?;
    let len = compressed.len();
    stream.write_all(&compressed).map_err(|e| e.to_string())?;
    Ok(len)
}

fn connect_timeout(port: &str, timeout_ms: u64) -> Result<TcpStream, String> {
    let addr: SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .map_err(|e| e.to_string())?;
    TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms))
        .map_err(|e| format!("Failed to connect to port {}: {}", port, e))
}

/// Execute a script via the Opiumware protocol.
///
/// - `code`  — raw Lua code (the "OpiumwareScript " prefix is added automatically)
/// - `port`  — a specific port string ("8392"…"8397") **or** `"ALL"` to broadcast
///
/// Mirrors the official JS reference:
/// ```js
/// execute("OpiumwareScript print('hello')", "ALL")
/// ```
pub fn opiumware_execute(code: &str, port: &str) -> String {
    // Enforce the mandatory prefix — no prefix = no execution on Opiumware.
    let payload = if code.starts_with(PREFIX) {
        code.to_string()
    } else {
        format!("{}{}", PREFIX, code)
    };

    let ports_to_try: Vec<&str> = match port {
        "ALL" => PORTS.to_vec(),
        p     => vec![p],
    };

    let mut any_success      = false;
    let mut success_ports: Vec<String> = Vec::new();
    let mut last_error       = String::new();

    for &p in &ports_to_try {
        match connect_timeout(p, 800) {
            Ok(mut stream) => {
                println!("Successfully connected to Opiumware on port: {}", p);

                match send_bytes(&mut stream, &payload) {
                    Ok(bytes) => {
                        println!("Script sent ({} bytes)", bytes);
                        any_success = true;
                        success_ports.push(p.to_string());
                    }
                    Err(e) => {
                        last_error = format!("Error sending script: {}", e);
                        stream.shutdown(std::net::Shutdown::Both).ok();
                    }
                }

                // For a single-port call, first success ends the scan.
                if port != "ALL" {
                    break;
                }
            }
            Err(e) => {
                println!("{}", e);
                last_error = e;
            }
        }
    }

    if any_success {
        if success_ports.len() == 1 {
            format!("Successfully connected to Opiumware on port: {}", success_ports[0])
        } else {
            format!("Successfully executed on ports: {}", success_ports.join(", "))
        }
    } else {
        format!("Failed to connect on all ports. Last error: {}", last_error)
    }
}

/// Scan ports 8392-8397 and return the first reachable one.
/// Used by the Rust `attach` Tauri command (keep Rust attach, JS handles execute).
pub fn opiumware_attach_any() -> String {
    for &p in PORTS {
        if connect_timeout(p, 400).is_ok() {
            return format!("Successfully attached on port {}", p);
        }
    }
    "Failed to attach: no Opiumware instance found on ports 8392-8397".to_string()
}

pub fn opiumware_check_port(port: &str) -> bool {
    connect_timeout(port, 400).is_ok()
}