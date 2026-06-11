@echo off
chcp 65001 >nul
title Brasileirao Data Lake - Atualizacao de Rodada

echo.
echo ============================================================
echo   BRASILEIRAO DATA LAKE - ATUALIZACAO DE RODADA 2026
echo ============================================================
echo.

:: Detectar Python (tenta caminho especifico, cai para PATH)
set PYTHON=python
if exist "C:\Python314\python.exe" set PYTHON=C:\Python314\python.exe
if exist "C:\Python313\python.exe" set PYTHON=C:\Python313\python.exe
if exist "C:\Python312\python.exe" set PYTHON=C:\Python312\python.exe

:: Diretorios do projeto
set ROOT=%~dp0
set PIPELINES=%ROOT%datalake\pipelines
set DASHBOARD_SCRIPTS=%ROOT%dashboard\scripts

echo Python: %PYTHON%
echo Pipelines: %PIPELINES%
echo.

:: [1/5] Ingestao de partidas (placares)
echo [1/5] Buscando resultados da ultima rodada...
cd /d "%PIPELINES%"
%PYTHON% -W ignore ingest_sofascore.py --seasons 2026 --fixtures-only
if errorlevel 1 (
    echo ERRO na ingestao de partidas. Verifique a conexao com a internet.
    pause
    exit /b 1
)

:: [2/5] Ingestao de detalhes (gols, cartoes, escalacoes)
echo.
echo [2/5] Buscando gols e cartoes da ultima rodada...
%PYTHON% -W ignore ingest_sofascore.py --seasons 2026
if errorlevel 1 (
    echo AVISO: Erro ao buscar detalhes. Continuando com dados de placar...
)

:: [3/5] Reconstruir tabelas analiticas (Gold)
echo.
echo [3/5] Reconstruindo tabelas analiticas (Gold)...
%PYTHON% -W ignore build_gold.py
if errorlevel 1 (
    echo ERRO ao construir camada Gold.
    pause
    exit /b 1
)

:: [4/5] Exportar dados para o dashboard (JSON + Parquet)
echo.
echo [4/5] Exportando dados para o dashboard...
cd /d "%DASHBOARD_SCRIPTS%"
%PYTHON% -W ignore export_data.py
if errorlevel 1 (
    echo AVISO: Erro ao exportar dados para o dashboard.
)

:: [5/5] Atualizar MySQL
echo.
echo [5/5] Atualizando MySQL...
cd /d "%PIPELINES%"
%PYTHON% -W ignore load_mysql.py
if errorlevel 1 (
    echo AVISO: Erro ao carregar MySQL. Verifique se o servico MySQL80 esta rodando.
)

echo.
echo ============================================================
echo   ATUALIZACAO CONCLUIDA!
echo   Dashboard:  http://localhost:3000
echo   MySQL:      brasileirao_datalake
echo ============================================================
echo.
pause