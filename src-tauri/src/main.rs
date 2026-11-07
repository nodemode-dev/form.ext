#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod packaged;
mod reveal;

use std::sync::Mutex;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEV_URL: &str = "http://localhost:5640";
const FALLBACK_SIZE: (f64, f64) = (1280.0, 820.0);
const MIN_SIZE: (f64, f64) = (960.0, 620.0);
const SCREEN_FRACTION: f64 = 0.85;

struct Backend(Mutex<Option<CommandChild>>);
struct Engine(Mutex<String>);

#[tauri::command]
fn engine_url(engine: tauri::State<Engine>) -> String {
    engine.0.lock().map(|url| url.clone()).unwrap_or_default()
}

fn kill_backend(handle: &tauri::AppHandle) {
    let child = handle.state::<Backend>().0.lock().ok().and_then(|mut slot| slot.take());
    if let Some(child) = child {
        #[cfg(unix)]
        {
            let pid = child.pid().to_string();
            let signal = |sig: &str| {
                std::process::Command::new("kill")
                    .args([sig, pid.as_str()])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status()
                    .is_ok_and(|s| s.success())
            };
            if signal("-TERM") {
                for _ in 0..30 {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    if !signal("-0") {
                        return;
                    }
                }
            }
        }
        let _ = child.kill();
    }
}

fn focus_main(handle: &tauri::AppHandle) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_main(handle: &tauri::AppHandle, url: &str) {
    *handle.state::<Engine>().0.lock().unwrap() = url.trim_end_matches('/').to_string();
    let (width, height) = handle
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| {
            let logical = monitor.size().to_logical::<f64>(monitor.scale_factor());
            (
                (logical.width * SCREEN_FRACTION).max(MIN_SIZE.0),
                (logical.height * SCREEN_FRACTION).max(MIN_SIZE.1),
            )
        })
        .unwrap_or(FALLBACK_SIZE);
    let built = WebviewWindowBuilder::new(handle, "main", WebviewUrl::External(url.parse().unwrap()))
        .title("form.ext")
        .visible(reveal::BUILD_VISIBLE)
        .background_color(reveal::BACKGROUND)
        .inner_size(width, height)
        .min_inner_size(MIN_SIZE.0, MIN_SIZE.1)
        .center()
        .disable_drag_drop_handler()
        .build();
    match built {
        Ok(window) => reveal::conceal(&window),
        Err(_) => reveal::close_splash(handle),
    }
}

fn engine_failed(handle: &tauri::AppHandle) {
    reveal::close_splash(handle);
    let _ = handle
        .dialog()
        .message("The form.ext engine failed to start. Please relaunch the app.")
        .blocking_show();
    kill_backend(handle);
    handle.exit(1);
}

fn start_engine(app: &tauri::App) {
    let handle = app.handle().clone();
    let command = match packaged::engine_folder() {
        Some(program) => app.shell().command(program),
        None => match app.shell().sidecar("formext-engine") {
            Ok(command) => command,
            Err(_) => {
                engine_failed(&handle);
                return;
            }
        },
    };
    let mut command = command.env("FORMEXT_PORT", "0");
    if let Some(path) = packaged::launcher() {
        command = command.env("FORMEXT_LAUNCHER", path);
    }
    let (mut rx, child) = match command.spawn() {
        Ok(spawned) => spawned,
        Err(_) => {
            engine_failed(&handle);
            return;
        }
    };
    *app.state::<Backend>().0.lock().unwrap() = Some(child);
    tauri::async_runtime::spawn(async move {
        let pattern = regex::Regex::new(r"http://127\.0\.0\.1:(\d+)").unwrap();
        let mut port: Option<u16> = None;
        while let Some(event) = rx.recv().await {
            let text = match event {
                CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
                CommandEvent::Terminated(_) => break,
                _ => continue,
            };
            if let Some(found) = pattern.captures(&text).and_then(|c| c[1].parse::<u16>().ok()) {
                port = Some(found);
                break;
            }
        }
        match port {
            Some(port) => {
                open_main(&handle, &format!("http://127.0.0.1:{port}"));
                tauri::async_runtime::spawn(async move { while rx.recv().await.is_some() {} });
            }
            None => engine_failed(&handle),
        }
    });
}

fn dev_mode() -> bool {
    cfg!(debug_assertions) && std::env::var("FORMEXT_SIDECAR").map(|v| v != "1").unwrap_or(true)
}

fn main() {
    reveal::mark_launch();
    if let Some(code) = packaged::command_line() {
        std::process::exit(code);
    }
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| focus_main(app)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Backend(Mutex::new(None)))
        .manage(Engine(Mutex::new(String::new())))
        .invoke_handler(tauri::generate_handler![reveal::app_ready, engine_url])
        .setup(|app| {
            let handle = app.handle().clone();
            reveal::round_splash(&handle);
            if dev_mode() {
                let url = std::env::var("FORMEXT_DEV_URL").unwrap_or_else(|_| DEV_URL.to_string());
                open_main(&handle, &url);
            } else {
                start_engine(app);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the form.ext app");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            kill_backend(handle);
        }
    });
}
