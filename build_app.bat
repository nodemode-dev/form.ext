@echo off
setlocal
cd /d "%~dp0"
set "LOG=%~dp0build_app.log"
echo [formext] build_app.bat: the form.ext desktop build, start to finish > "%LOG%"
call :step "checking the tools"
where node >nul 2>nul || ( call :die "Node 20.19 or newer is required" & exit /b 1 )
where npm >nul 2>nul || ( call :die "Node 20.19 or newer is required" & exit /b 1 )
where cargo >nul 2>nul || ( call :die "Rust is required: install it from https://rustup.rs" & exit /b 1 )
where bash >nul 2>nul || ( call :die "Git for Windows is required (its bash freezes the engine): https://git-scm.com/download/win" & exit /b 1 )
where py >nul 2>nul || where python >nul 2>nul || ( call :die "Python 3.12 or newer is required" & exit /b 1 )
where claude >nul 2>nul && echo [formext] Claude Code found: the Terminal tab can start it || echo [formext] Claude Code is not installed: the Claude Code and Chat tabs say so
call :step "installing the engine and the window"
if not exist backend\venv\Scripts\python.exe call formext_oc_install.bat >> "%LOG%" 2>&1
if not exist frontend\node_modules\.bin\tauri.cmd ( pushd frontend & call npm ci --no-audit --no-fund >> "%LOG%" 2>&1 & popd )
call :step "building the window"
pushd frontend
call npm run build >> "%LOG%" 2>&1
if errorlevel 1 ( popd & call :die "the interface build failed" & exit /b 1 )
popd
call :step "freezing the engine into the app's sidecar"
bash setup/freeze_backend >> "%LOG%" 2>&1
if errorlevel 1 ( call :die "the engine freeze failed" & exit /b 1 )
call :step "building the desktop app (the first build compiles several hundred Rust crates)"
call frontend\node_modules\.bin\tauri.cmd build >> "%LOG%" 2>&1
if errorlevel 1 ( call :die "tauri build failed" & exit /b 1 )
echo [formext] done. The installer is in src-tauri\target\release\bundle
echo [formext] done. The installer is in src-tauri\target\release\bundle >> "%LOG%"
exit /b 0
:step
echo.
echo [formext] == %~1
echo [formext] == %~1 >> "%LOG%"
exit /b 0
:die
echo [formext] error: %~1
echo [formext] error: %~1 >> "%LOG%"
echo [formext] the full log is %LOG%
exit /b 1
