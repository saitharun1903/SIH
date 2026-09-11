# PowerShell script to launch NEXUS Next.js frontend locally
Write-Host "Starting NEXUS Frontend Server..." -ForegroundColor Cyan

$frontendDir = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendDir

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Launching Next.js development server on http://localhost:3000 ..." -ForegroundColor Green
npm run dev
