@echo off
echo ==========================================
echo Sincronizando IAmobil com GitHub...
echo ==========================================
git add .
git commit -m "chore: restaura estrutura completa para o deploy"
echo Tentando enviar para o GitHub...
git push origin main --force
if %errorlevel% neq 0 (
    echo.
    echo Erro ao enviar! Verifique suas credenciais do GitHub.
    git remote set-url origin https://github.com/edyinvesti/iamobil-cloud.git
    git push origin main --force
)
echo.
echo ==========================================
echo Processo concluído! Verifique o seu GitHub.
echo ==========================================
pause
