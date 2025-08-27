@echo off
echo ========================================
echo   ML Agent Platform - Windows Setup
echo   Dominio: gugaleo.axnexlabs.com.br
echo ========================================
echo.

:: Verificar Node.js
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao esta instalado!
    echo Por favor, instale em: https://nodejs.org
    pause
    exit /b 1
)

:: Copiar arquivo de ambiente
echo [2/5] Configurando variaveis de ambiente...
copy .env.production .env.local >nul 2>&1

:: Instalar dependencias (se necessario)
if not exist "node_modules" (
    echo [3/5] Instalando dependencias...
    call npm install
) else (
    echo [3/5] Dependencias ja instaladas
)

:: Fazer build
if not exist ".next" (
    echo [4/5] Fazendo build do projeto...
    call npm run build
) else (
    echo [4/5] Build ja existe
)

:: Iniciar servidor
echo [5/5] Iniciando servidor na porta 3000...
echo.
echo ========================================
echo   Servidor rodando!
echo   Local: http://localhost:3000
echo ========================================
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

set PORT=3000
npm start