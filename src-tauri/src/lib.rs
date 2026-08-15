use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use tauri::{AppHandle, Emitter};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Deserialize)]
struct TokenRequest {
    hash: String,
}

#[derive(Clone, serde::Serialize)]
struct TokenPayload {
    hash: String,
}

#[tauri::command]
fn start_oauth_server(app_handle: AppHandle) {
    // Spawn a thread so we don't block the main UI thread of Tauri
    thread::spawn(move || {
        // Try to bind to port 14209 (fixed port for oauth redirect)
        let listener = match TcpListener::bind("127.0.0.1:14209") {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Error binding to port 14209: {}", e);
                return;
            }
        };

        println!("OAuth local server listening on http://127.0.0.1:14209/callback ...");

        // Accept only the connections we need
        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    if handle_connection(&mut stream, &app_handle) {
                        println!("OAuth transfer complete. Shutting down local server.");
                        break; // Exit the loop and stop listening
                    }
                }
                Err(e) => {
                    eprintln!("Error accepting connection: {}", e);
                }
            }
        }
    });
}

fn handle_connection(stream: &mut TcpStream, app_handle: &AppHandle) -> bool {
    let mut buffer = [0; 4096];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(n) => n,
        Err(_) => return false,
    };

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);

    if request.starts_with("GET /callback") {
        // Serve the HTML file that extracts the hash and POSTs it back to us
        let html_content = include_str!("oauth_callback.html");
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            html_content.len(),
            html_content
        );
        let _ = stream.write_all(response.as_bytes());
        let _ = stream.flush();
        false // Keep the server listening for the subsequent POST
    } else if request.starts_with("POST /token") {
        if let Some(pos) = request.find("\r\n\r\n") {
            let body = &request[pos + 4..];
            // Remove any trailing null characters or white spaces
            let body = body.trim_end_matches('\0').trim();

            if let Ok(req_data) = serde_json::from_str::<TokenRequest>(body) {
                // Emit event to the frontend
                let _ = app_handle.emit("oauth-callback", TokenPayload { hash: req_data.hash });

                // Respond with success JSON
                let success_response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"status\":\"ok\"}";
                let _ = stream.write_all(success_response.as_bytes());
                let _ = stream.flush();
                return true; // We received the token, we can shut down the server
            }
        }
        
        // Respond with bad request if parsing failed
        let bad_response = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(bad_response.as_bytes());
        let _ = stream.flush();
        false
    } else {
        // Respond with not found for any other route
        let not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(not_found.as_bytes());
        let _ = stream.flush();
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, start_oauth_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
