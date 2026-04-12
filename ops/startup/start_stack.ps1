$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "Step 1/3: prepare database..."
& (Join-Path $RepoRoot "ops\db\start_opengauss.ps1")
& (Join-Path $RepoRoot "ops\db\init_hrms.ps1")

Write-Host ""
Write-Host "Step 2/3: start backend in a new window..."
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $RepoRoot "ops\backend\start_backend.ps1")

Start-Sleep -Seconds 2

Write-Host "Step 3/3: start frontend in a new window..."
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $RepoRoot "ops\frontend\start_frontend.ps1")

Write-Host ""
Write-Host "Stack launch requested."
Write-Host "Backend: http://127.0.0.1:8080"
Write-Host "Frontend: http://127.0.0.1:5173"
