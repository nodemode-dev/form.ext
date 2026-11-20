#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine_start;
mod packaged;
mod reveal;
mod traffic_lights;
#[cfg(windows)]
mod win_job;

use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_dialog::DialogExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const DEV_URL: &str = "http://localhost:5640";
const FALLBACK_SIZE: (f64, f64) = (1280.0, 820.0);
const MIN_SIZE: (f64, f64) = (960.0, 620.0);
const SCREEN_FRACTION: f64 = 0.85;

struct Backend(Mutex<Option<Child>>);
struct Engine(Mutex<String>);

#[tauri::command]
fn engine_url(engine: tauri::State<Engine>) -> String {
    engine.0.lock().map(|url| url.clone()).unwrap_or_default()
}

fn kill_backend(handle: &tauri::AppHandle) {
    let state = handle.state::<Backend>();
    let child = state.0.lock().ok().and_then(|mut slot| slot.take());
    if let Some(mut child) = child {
        #[cfg(unix)]
        {
            let pid = child.id().to_string();
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
                    std::thread::sleep(Duration::from_millis(50));
                    if matches!(child.try_wait(), Ok(Some(_))) {
                        return;
                    }
                }
            }
        }
        #[cfg(windows)]
        win_job::end();
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn focus_main(handle: &tauri::AppHandle) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_main(handle: &tauri::AppHandle, url: &str, key: Option<&str>) -> bool {
    let Ok(parsed) = url.parse() else { return false };
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
    let built = WebviewWindowBuilder::new(handle, "main", WebviewUrl::External(parsed))
        .title("form.ext")
        .visible(reveal::BUILD_VISIBLE)
        .background_color(reveal::BACKGROUND)
        .inner_size(width, height)
        .min_inner_size(MIN_SIZE.0, MIN_SIZE.1)
        .center()
        .disable_drag_drop_handler();
    let origin = url.trim_end_matches('/').to_string();
    let built = match key {
        Some(value) => built.initialization_script(format!("if (window.location.origin === {origin:?}) {{ window.__FORMEXT_WINDOW_KEY = {value:?}; }}")),
        None => built,
    };
    #[cfg(target_os = "macos")]
    let built = built.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true);
    let built = built
        .on_page_load(|window, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                traffic_lights::place(&window.as_ref().window());
            }
        })
        .build();
    match built {
        Ok(window) => {
            reveal::conceal(&window);
            traffic_lights::place(&window.as_ref().window());
            true
        }
        Err(_) => false,
    }
}

fn engine_exit_code(handle: &tauri::AppHandle) -> Option<i32> {
    let state = handle.state::<Backend>();
    let mut waited = Duration::ZERO;
    while waited < engine_start::EXIT_WAIT {
        if let Ok(mut slot) = state.0.lock() {
            let seen = slot.as_mut().map(|child| child.try_wait());
            match seen {
                Some(Ok(Some(status))) => return status.code(),
                Some(Ok(None)) => {}
                _ => return None,
            };
        }
        std::thread::sleep(engine_start::EXIT_STEP);
        waited += engine_start::EXIT_STEP;
    }
    None
}

fn engine_failed(handle: &tauri::AppHandle, failure: engine_start::Failure, tail: &engine_start::Tail) {
    let failure = match failure {
        engine_start::Failure::Stopped(None) => engine_start::Failure::Stopped(engine_exit_code(handle)),
        other => other,
    };
    let text = engine_start::message(&failure, &tail.lines(), engine_start::engine_log().as_deref());
    let _ = handle
        .dialog()
        .message(text)
        .title(engine_start::APP)
        .kind(tauri_plugin_dialog::MessageDialogKind::Error)
        .blocking_show();
    reveal::close_splash(handle);
    kill_backend(handle);
    handle.exit(1);
}

fn forward_lines<R: std::io::Read + Send + 'static>(stream: R, tx: tauri::async_runtime::Sender<String>) {
    std::thread::spawn(move || {
        for line in BufReader::new(stream).split(b'\n') {
            let Ok(bytes) = line else { break };
            let _ = tx.blocking_send(String::from_utf8_lossy(&bytes).into_owned());
        }
    });
}

fn start_engine(program: &std::path::Path) -> std::io::Result<(Child, tauri::async_runtime::Receiver<String>)> {
    let mut command = Command::new(program);
    command
        .env("FORMEXT_PORT", "0")
        .env("FORMEXT_WINDOW_KEY_STDOUT", "1")
        .env(engine_start::SHELL_ENV, std::process::id().to_string())
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(path) = packaged::launcher() {
        command.env("FORMEXT_LAUNCHER", path);
    }
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = command.spawn()?;
    #[cfg(windows)]
    win_job::hold(&child);
    let (tx, rx) = tauri::async_runtime::channel::<String>(64);
    if let Some(stdout) = child.stdout.take() {
        forward_lines(stdout, tx.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        forward_lines(stderr, tx);
    }
    Ok((child, rx))
}

async fn read_port(
    mut rx: tauri::async_runtime::Receiver<String>,
    tail: &mut engine_start::Tail,
) -> Result<(u16, Option<String>), engine_start::Failure> {
    let pattern = regex::Regex::new(r"formext-engine: http://127\.0\.0\.1:(\d+)").unwrap();
    let key_pattern = regex::Regex::new(r"formext-window-key: ([A-Za-z0-9_-]{32,})").unwrap();
    let mut key: Option<String> = None;
    let mut port: Option<u16> = None;
    let mut waiting = engine_start::Wait::Address;
    let (tick, mut timer) = tauri::async_runtime::channel::<()>(1);
    std::thread::spawn(move || {
        std::thread::sleep(engine_start::Wait::Address.limit());
        let _ = tick.blocking_send(());
    });
    loop {
        let next: Result<Option<String>, ()> = std::future::poll_fn(|cx| match timer.poll_recv(cx) {
            std::task::Poll::Ready(_) => std::task::Poll::Ready(Err(())),
            std::task::Poll::Pending => rx.poll_recv(cx).map(Ok),
        })
        .await;
        let text = match next {
            Err(()) => return Err(engine_start::Failure::TimedOut(waiting)),
            Ok(None) => return Err(engine_start::Failure::Stopped(None)),
            Ok(Some(text)) => text,
        };
        tail.push(&text);
        if key.is_none() {
            key = key_pattern.captures(&text).map(|found| found[1].to_string());
        }
        if port.is_none() {
            port = pattern.captures(&text).and_then(|found| found[1].parse::<u16>().ok());
            if port.is_some() && key.is_none() {
                let (key_tick, key_timer) = tauri::async_runtime::channel::<()>(1);
                std::thread::spawn(move || {
                    std::thread::sleep(engine_start::Wait::Key.limit());
                    let _ = key_tick.blocking_send(());
                });
                timer = key_timer;
                waiting = engine_start::Wait::Key;
            }
        }
        if let (Some(found), true) = (port, key.is_some()) {
            tauri::async_runtime::spawn(async move { while rx.recv().await.is_some() {} });
            return Ok((found, key));
        }
    }
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
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(event, WindowEvent::Resized(_) | WindowEvent::Focused(_) | WindowEvent::ThemeChanged(_) | WindowEvent::ScaleFactorChanged { .. })
            {
                traffic_lights::place(window);
            }
        })
        .invoke_handler(tauri::generate_handler![reveal::app_ready, engine_url, traffic_lights::set_window_title])
        .setup(|app| {
            let handle = app.handle().clone();
            reveal::round_splash(&handle);
            if dev_mode() {
                let url = std::env::var("FORMEXT_DEV_URL").unwrap_or_else(|_| DEV_URL.to_string());
                tauri::async_runtime::spawn(async move {
                    if !open_main(&handle, &url, None) {
                        engine_failed(&handle, engine_start::Failure::Window, &engine_start::Tail::default());
                    }
                });
                return Ok(());
            }
            let spawned = match packaged::engine_program() {
                Some(program) => start_engine(&program).map_err(|err| engine_start::Failure::NotStarted(err.to_string())),
                None => Err(engine_start::Failure::Missing),
            };
            tauri::async_runtime::spawn(async move {
                let mut tail = engine_start::Tail::default();
                let found = match spawned {
                    Ok((child, rx)) => {
                        if let Ok(mut slot) = handle.state::<Backend>().0.lock() {
                            *slot = Some(child);
                        }
                        read_port(rx, &mut tail).await
                    }
                    Err(failure) => Err(failure),
                };
                let failure = match found {
                    Ok((port, key)) if open_main(&handle, &format!("http://127.0.0.1:{port}"), key.as_deref()) => return,
                    Ok(_) => engine_start::Failure::Window,
                    Err(failure) => failure,
                };
                engine_failed(&handle, failure, &tail);
            });
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
