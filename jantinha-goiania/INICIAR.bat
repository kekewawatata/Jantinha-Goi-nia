@echo off
title Jantinha Goiania - Sistema ERP
echo.
echo  =========================================
echo   JANTINHA GOIANIA - Sistema ERP
echo  =========================================
echo.
echo  Iniciando servidor de producao...
echo  Acesse no navegador: http://localhost:3000
echo.
cd /d "%~dp0"
npm run start -- --hostname 0.0.0.0
pause
