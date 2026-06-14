# Baixa os logos dos times do ESPN CDN para public/logos/
# Uso: scripts\download-logos.ps1

$logos = @{
  819   = "Flamengo"
  874   = "Corinthians"
  2029  = "Palmeiras"
  1966  = "Santos"
  1966  = "Santos"
  1755  = "Sao Paulo"
  2062  = "Gremio"
  2068  = "Internacional"
  1887  = "Cruzeiro"
  1974  = "Atletico Mineiro"
  2032  = "Botafogo"
  2057  = "Vasco da Gama"
  2052  = "Fluminense"
  1872  = "Bahia"
  1975  = "Sport"
  2037  = "Coritiba"
  1881  = "Atletico Goianiense"
  1992  = "Fortaleza"
  2036  = "Ceara"
  1976  = "Goias"
  2067  = "Avai"
  1982  = "Chapecoense"
  1985  = "Bragantino"
  2050  = "Cuiaba"
  2064  = "Juventude"
  1870  = "America Mineiro"
  2027  = "Parana"
  2059  = "Criciuma"
  2033  = "Figueirense"
  2040  = "Guarani"
  1980  = "Joinville"
  2042  = "Nautico"
  2055  = "Vitoria"
  1873  = "Barueri"
  2063  = "Portuguesa"
}

$outDir = Join-Path $PSScriptRoot "..\public\logos"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

foreach ($id in $logos.Keys) {
  $outFile = Join-Path $outDir "espn-$id.png"
  if (Test-Path $outFile) {
    Write-Host "SKIP $($logos[$id]) (espn-$id.png ja existe)"
    continue
  }
  $url = "https://a.espncdn.com/i/teamlogos/soccer/500/$id.png"
  try {
    Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing -TimeoutSec 10
    Write-Host "OK   $($logos[$id]) (espn-$id.png)"
  } catch {
    Write-Warning "ERRO $($logos[$id]) (espn-$id.png): $_"
  }
  Start-Sleep -Milliseconds 200
}

Write-Host "`nDownload concluido. Arquivos em: $outDir"
