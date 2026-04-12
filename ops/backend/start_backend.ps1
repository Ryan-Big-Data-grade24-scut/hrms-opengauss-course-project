$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackendRoot = Join-Path $RepoRoot "backend"
Set-Location $BackendRoot
$env:HRMS_BACKEND_PORT = "18080"
python .\app.py
