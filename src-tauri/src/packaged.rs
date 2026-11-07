use std::ffi::OsString;
use std::process::Command;

const ENGINE: &str = if cfg!(windows) { "formext-engine.exe" } else { "formext-engine" };

pub fn launcher() -> Option<String> {
    std::env::var_os("APPIMAGE")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::current_exe().ok())
        .map(|path| path.to_string_lossy().into_owned())
}

pub fn engine_folder() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    [dir.join("../Resources/engine"), dir.join("engine")]
        .into_iter()
        .map(|folder| folder.join(ENGINE))
        .find(|program| program.is_file())
}

pub fn command_line() -> Option<i32> {
    let mut args = std::env::args_os().skip(1);
    let first = args.next()?;
    match first.to_str()? {
        "cli" | "mcp" => Some(hand_over(first, args.collect())),
        _ => None,
    }
}

fn hand_over(mode: OsString, rest: Vec<OsString>) -> i32 {
    let Ok(exe) = std::env::current_exe() else {
        eprintln!("formext: cannot tell where the program is.");
        return 1;
    };
    let mut command = Command::new(engine_folder().unwrap_or_else(|| exe.with_file_name(ENGINE)));
    command.arg(mode).args(rest);
    if let Some(path) = launcher() {
        command.env("FORMEXT_LAUNCHER", path);
    }
    run(command)
}

#[cfg(unix)]
fn run(mut command: Command) -> i32 {
    use std::os::unix::process::CommandExt;
    let err = command.exec();
    eprintln!("formext: the engine could not start: {err}");
    1
}

#[cfg(not(unix))]
fn run(mut command: Command) -> i32 {
    match command.status() {
        Ok(status) => status.code().unwrap_or(1),
        Err(err) => {
            eprintln!("formext: the engine could not start: {err}");
            1
        }
    }
}
