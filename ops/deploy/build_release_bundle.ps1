param(
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutputDir) {
    $OutputDir = Join-Path $RepoRoot "dist\release_bundle"
}

$FrontendRoot = Join-Path $RepoRoot "frontend"
$DeployRoot = Join-Path $RepoRoot "deploy"
$BackendRoot = Join-Path $RepoRoot "backend"
$OpsRoot = Join-Path $RepoRoot "ops"
$SqlRoot = Join-Path $RepoRoot "sql"

if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Force $OutputDir | Out-Null

Write-Host "Building frontend..."
Push-Location $FrontendRoot
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Frontend build failed."
}
Pop-Location

Write-Host "Copying backend..."
Copy-Item $BackendRoot (Join-Path $OutputDir "backend") -Recurse -Force

Write-Host "Copying frontend dist..."
Copy-Item (Join-Path $FrontendRoot "dist") (Join-Path $OutputDir "frontend_dist") -Recurse -Force

Write-Host "Copying deploy assets..."
Copy-Item $DeployRoot (Join-Path $OutputDir "deploy") -Recurse -Force

Write-Host "Copying ops..."
Copy-Item $OpsRoot (Join-Path $OutputDir "ops") -Recurse -Force

Write-Host "Copying sql..."
Copy-Item $SqlRoot (Join-Path $OutputDir "sql") -Recurse -Force

Write-Host "Release bundle created at: $OutputDir"
