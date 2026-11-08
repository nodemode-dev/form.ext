@echo off
setlocal
cd /d "%~dp0"
set "CMD=%~1"
if "%CMD%"=="" set "CMD=boot"
set "PYEXE=python"
if exist backend\venv\Scripts\python.exe set "PYEXE=backend\venv\Scripts\python.exe"
if /i "%CMD%"=="boot" goto boot
if /i "%CMD%"=="dev" goto boot
if /i "%CMD%"=="install" ( call formext_oc_install.bat & goto :eof )
if /i "%CMD%"=="backend" ( call backend\boot_backend.bat & goto :eof )
if /i "%CMD%"=="frontend" goto frontend
if /i "%CMD%"=="build" goto build
if /i "%CMD%"=="serve" goto serve
if /i "%CMD%"=="freeze" ( bash setup/freeze_backend & goto :eof )
if /i "%CMD%"=="app" ( call build_app.bat %2 %3 %4 & goto :eof )
if /i "%CMD%"=="desktop" goto desktop
if /i "%CMD%"=="cli" ( shift & "%PYEXE%" backend\formext_engine.py cli %1 %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="mcp" ( shift & "%PYEXE%" backend\formext_engine.py mcp %1 %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="claude" goto claude
if /i "%CMD%"=="agents" ( shift & "%PYEXE%" setup\agents.py %1 %2 %3 %4 %5 %6 %7 %8 %9 & goto :eof )
if /i "%CMD%"=="doctor" goto doctor
if /i "%CMD%"=="version" ( "%PYEXE%" backend\formext_engine.py --version & goto :eof )
if /i "%CMD%"=="help" goto usage
echo [formext] unknown command: %CMD%
goto usage
:boot
if not exist frontend\node_modules call formext_oc_install.bat
start "formext engine" cmd /k backend\boot_backend.bat
start "formext interface" cmd /k "cd /d %~dp0frontend && node node_modules\vite\bin\vite.js"
echo [formext] open http://localhost:5640
goto :eof
:frontend
cd frontend
node node_modules\vite\bin\vite.js
goto :eof
:build
cd frontend
call npm run build
goto :eof
:serve
if not exist frontend\dist\index.html ( pushd frontend & call npm run build & popd )
echo [formext] open http://127.0.0.1:8640
set "FORMEXT_RELOAD=0"
call backend\boot_backend.bat
goto :eof
:desktop
if /i "%~2"=="build" ( call build_app.bat & goto :eof )
start "formext engine" cmd /k backend\boot_backend.bat
start "formext interface" cmd /k "cd /d %~dp0frontend && node node_modules\vite\bin\vite.js"
frontend\node_modules\.bin\tauri.cmd dev --no-dev-server-wait
goto :eof
:claude
where claude >nul 2>nul || ( echo [formext] Claude Code is not installed. Install it with: irm https://claude.ai/install.ps1 ^| iex & exit /b 1 )
set "CLAUDE_PROJECT_DIR=%~dp0"
claude --mcp-config "%~dp0.mcp.json" --allowedTools mcp__formext mcp__formmcp
goto :eof
:doctor
echo   node       & node -v
echo   python     & "%PYEXE%" -V
echo   claude     & where claude 2>nul || echo missing
echo   cargo      & cargo -V 2>nul || echo missing (desktop builds only)
goto :eof
:usage
echo formext.bat [command]
echo   boot ^| install ^| backend ^| frontend ^| build ^| serve ^| freeze ^| app ^| desktop dev ^| desktop build
echo   cli ... ^| mcp ... ^| claude ^| agents install^|status^|sync ^| doctor ^| version ^| help
exit /b 0
