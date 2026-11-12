# scripts/gerar-hostinger.ps1
# Script para compilar o sistema em HTML/CSS/JS estático + APIs PHP para a Hostinger

$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Gerador de Pacote para Hostinger Single" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Limpa cache antigo do Next.js
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}
if (Test-Path "out") {
    Remove-Item -Recurse -Force "out"
}

# 2. Backup de arquivos para o build estático
Copy-Item "next.config.mjs" "next.config.mjs.bak" -Force

$staticNextConfig = @"
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
"@
Set-Content "next.config.mjs" $staticNextConfig -Encoding UTF8

# Move app/api temporariamente para não conflitar com export estático
if (Test-Path "app\api") {
    Move-Item "app\api" "app\_api_temp" -Force
}

$hasProxy = Test-Path "proxy.ts"
if ($hasProxy) {
    Move-Item "proxy.ts" "proxy.ts.bak" -Force
}

try {
    Write-Host "`n--> Compilando frontend Next.js para HTML estatico com trailingSlash..." -ForegroundColor Yellow
    & npx next build

    if ($LASTEXITCODE -ne 0) {
        throw "Erro durante o build do Next.js"
    }

    Write-Host "`n--> Copiando arquivos compilados para hostinger_deploy..." -ForegroundColor Yellow
    Copy-Item "out\*" "hostinger_deploy\" -Recurse -Force
    Copy-Item "jantinha.sql" "hostinger_deploy\jantinha.sql" -Force

    # Gera o ZIP com tar.exe para formato POSIX / Linux nativo
    $zipPath = Join-Path $root "jantinha_hostinger.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    Write-Host "`n--> Compactando pacote final em jantinha_hostinger.zip com tar (padrao Linux)..." -ForegroundColor Yellow
    Push-Location "hostinger_deploy"
    tar.exe -a -c -f $zipPath .htaccess *
    Pop-Location

    $zipItem = Get-Item $zipPath
    $tamanhoMB = [math]::Round($zipItem.Length / 1MB, 2)

    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host " [SUCESSO] Pacote gerado com sucesso!" -ForegroundColor Green
    Write-Host " Arquivo: jantinha_hostinger.zip" -ForegroundColor Green
    Write-Host " Tamanho: $tamanhoMB MB" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
}
finally {
    # Restaura arquivos originais
    if (Test-Path "app\_api_temp") {
        Move-Item "app\_api_temp" "app\api" -Force
    }
    if (Test-Path "proxy.ts.bak") {
        Move-Item "proxy.ts.bak" "proxy.ts" -Force
    }
    if (Test-Path "next.config.mjs.bak") {
        Move-Item "next.config.mjs.bak" "next.config.mjs" -Force
    }
}
