@echo off
echo ========================================
echo   Configurando Cloudflare Tunnel
echo   Para: gugaleo.axnexlabs.com.br
echo ========================================
echo.

:: Baixar Cloudflared
echo [1/3] Baixando Cloudflared...
if not exist "cloudflared.exe" (
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    echo Cloudflared baixado!
) else (
    echo Cloudflared ja existe!
)

:: Verificar se o servidor esta rodando
echo.
echo [2/3] Verificando servidor...
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo AVISO: Servidor nao esta rodando!
    echo Execute primeiro: run-windows.bat
    echo.
    pause
    exit /b 1
)

:: Criar tunnel
echo.
echo [3/3] Criando tunnel...
echo ========================================
echo.
echo IMPORTANTE: O Cloudflare vai gerar uma URL temporaria
echo Esta URL muda cada vez que voce reinicia o tunnel
echo.
echo Para usar gugaleo.axnexlabs.com.br voce precisa:
echo 1. Conta Cloudflare (gratis)
echo 2. Configurar DNS no Cloudflare
echo 3. Criar tunnel permanente
echo.
echo Pressione qualquer tecla para criar tunnel temporario...
pause >nul

cloudflared.exe tunnel --url http://localhost:3000