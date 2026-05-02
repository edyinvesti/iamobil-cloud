@echo off
title iAmobil - Iniciando Sistema...
echo.
echo  ============================================
echo   iAmobil - Iniciando todos os servidores...
echo  ============================================
echo.

echo  [*] Liberando portas anteriores (3000 e 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":18789 " ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
echo  [OK] Portas liberadas.
echo.

echo  [*] Iniciando Central Hub (Porta 3000)...
start "iAmobil - Central Hub" cmd /k "cd /d %~dp0 && npm run dev"

echo  [*] Iniciando Gestor Corretor (Porta 5173)...
start "iAmobil - Gestor Corretor" powershell -NoExit -Command "Set-Location -Path '%~dp0..'; $p = Get-ChildItem -Directory -Filter '*gestor*' | Select-Object -First 1; Set-Location -Path $p.FullName; npm run dev"

echo.
echo  [SUCESSO] Todo o ecossistema IAmobil está subindo! 
echo  - Hub: http://localhost:3000
echo  - Gestor: http://localhost:5173 
echo.
pause
