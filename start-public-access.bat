@echo off
title iAmobil - Tunnel Público (ngrok)
echo.
echo  ============================================
echo   iAmobil - Iniciando Tunnel ngrok...
echo  ============================================
echo.

:: Usa o caminho absoluto encontrado no npm-cache
set NGROK_CMD="C:\Users\User\AppData\Local\npm-cache\_npx\094a17e86d981b10\node_modules\ngrok\bin\ngrok.exe"

if not exist %NGROK_CMD% (
    echo [ERRO] ngrok nao encontrado no caminho esperado.
    pause
    exit /b 1
)

echo [*] Configurando Authtoken...
%NGROK_CMD% config add-authtoken 1zbePIpJ1pV87BswUMEJTXTogGA_5cekk89DTJaKe9DtbF2Tk

echo [*] Iniciando Tunnel na porta 5173...
%NGROK_CMD% http 5173
pause
