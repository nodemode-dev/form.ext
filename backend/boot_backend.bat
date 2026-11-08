@echo off
setlocal
cd /d "%~dp0"
if not exist venv\Scripts\python.exe (
  echo [formext] creating the backend venv
  py -3.12 -m venv venv
  venv\Scripts\python.exe -m pip install -q -r requirements.txt
)
if "%FORMEXT_HOST%"=="" set "FORMEXT_HOST=127.0.0.1"
if "%FORMEXT_PORT%"=="" set "FORMEXT_PORT=8640"
if "%FORMEXT_RELOAD%"=="0" (
  venv\Scripts\python.exe -m uvicorn app.main:app --host %FORMEXT_HOST% --port %FORMEXT_PORT%
) else (
  venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-dir app --host %FORMEXT_HOST% --port %FORMEXT_PORT%
)
