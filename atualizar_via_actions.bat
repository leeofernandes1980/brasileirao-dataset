@echo off
chcp 65001 >nul
title Brasileirao Data Lake - Disparar Atualizacao (GitHub Actions)

echo.
echo ============================================================
echo   DISPARAR ATUALIZACAO VIA GITHUB ACTIONS
echo ============================================================
echo.
echo Isso roda a mesma Action do cron (deteccao de rodadas pendentes
echo + ingestao + gold + export + commit/push), na hora, sem esperar
echo o proximo agendamento de 12h. O Vercel redeploya sozinho assim
echo que o push cair no main.
echo.
echo Dispara com o fallback RapidAPI (SportAPI) ligado: se o Sofascore
echo bloquear (403) o IP deste runner, tenta pegar rodada/placar por esse
echo caminho alternativo. So gasta cota (50 req gratis/mes) quando o
echo Sofascore direto realmente falhar - disparo manual e esporadico, entao
echo cabe tranquilo. O cron automatico de 12h continua SEM esse fallback,
echo pra nao gastar a cota sozinho sem voce saber.
echo.

where gh >nul 2>nul
if errorlevel 1 (
    echo ERRO: GitHub CLI ^(gh^) nao encontrado no PATH.
    echo Instale em https://cli.github.com/ e rode "gh auth login".
    pause
    exit /b 1
)

cd /d "%~dp0"

echo Disparando a Action "Atualizar Rodada Brasileirao"...
gh workflow run atualizar-rodada.yml -f fallback_rapidapi=true
if errorlevel 1 (
    echo ERRO ao disparar a Action. Verifique se "gh auth login" foi feito.
    pause
    exit /b 1
)

echo.
echo Aguardando a run aparecer...
ping -n 9 127.0.0.1 >nul

for /f "usebackq tokens=*" %%R in (`gh run list --workflow=atualizar-rodada.yml --limit 1 --json databaseId --jq ".[0].databaseId"`) do set RUN_ID=%%R

if "%RUN_ID%"=="" (
    echo Nao consegui identificar a run automaticamente. Acompanhe manualmente com:
    echo   gh run list --workflow=atualizar-rodada.yml
    pause
    exit /b 0
)

echo Run #%RUN_ID% iniciada. Acompanhando ate concluir (pode levar alguns minutos)...
echo.
gh run watch %RUN_ID% --exit-status
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   A ACTION FALHOU. Veja os detalhes com:
    echo   gh run view %RUN_ID% --log-failed
    echo ============================================================
    pause
    exit /b 1
)

gh run view %RUN_ID% --log 2>nul | findstr /C:"continuam sem resultado depois" >nul
if not errorlevel 1 (
    echo.
    echo ============================================================
    echo   ATENCAO: uma ou mais rodadas continuam SEM RESULTADO mesmo
    echo   apos a ingestao ^(bloqueio persistente, ou cota RapidAPI
    echo   esgotada^). Veja o detalhe com:
    echo   gh run view %RUN_ID% --log
    echo ============================================================
)

echo.
echo ============================================================
echo   ATUALIZACAO PUBLICADA! O Vercel detecta o novo commit no
echo   main e redeploya sozinho em 1-2 minutos.
echo ============================================================
echo.
pause
