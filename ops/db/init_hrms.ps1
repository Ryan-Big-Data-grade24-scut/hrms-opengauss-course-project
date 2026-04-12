param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$DbName = "hrms",
    [string]$User = "omm",
    [string]$Password = "OpenGauss123!"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "Waiting for openGauss service to become ready..."
$maxAttempts = 24
$ready = $false
for ($i = 1; $i -le $maxAttempts; $i++) {
    $probe = docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib $ContainerName /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -t -A -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0 -and $probe -match "1") {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 5
}

if (-not $ready) {
    throw "openGauss inside container '$ContainerName' is not ready yet."
}

Write-Host "Creating database '$DbName' if it does not exist..."
$gsql = "/usr/local/opengauss/bin/gsql"
$ldPath = "/usr/local/opengauss/lib"
$exists = docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -t -A -c "SELECT 1 FROM pg_database WHERE datname='${DbName}';" 2>$null
if ($exists -match "1") {
    Write-Host "Database '$DbName' already exists."
} else {
    docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -c "CREATE DATABASE ${DbName};"
}

Write-Host "Applying migrations..."
& (Join-Path $PSScriptRoot "apply_migrations.ps1") -ContainerName $ContainerName -DbName $DbName -User $User -Password $Password

Write-Host ""
Write-Host "Done."
Write-Host "Database: $DbName"
Write-Host "Migrations dir: $(Join-Path $RepoRoot 'sql\migrations')"
