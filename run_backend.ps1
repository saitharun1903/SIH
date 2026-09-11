# PowerShell script to launch NEXUS FastAPI backend locally
Write-Host "Starting NEXUS Backend Server..." -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
Set-Location $backendDir

if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    .\venv\Scripts\pip install -r requirements.txt
}

Write-Host "Initializing database..." -ForegroundColor Yellow
.\venv\Scripts\python -m app.db.init_db

Write-Host "Launching Uvicorn on http://127.0.0.1:8000 ..." -ForegroundColor Green
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
