$ErrorActionPreference = "Stop"

$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Test-DockerEngine {
    cmd /c "docker info >nul 2>nul"
    return $LASTEXITCODE -eq 0
}

if (Test-DockerEngine) {
    Write-Host "Docker Engine is already available."
    exit 0
}

if (-not (Test-Path $dockerDesktop)) {
    Write-Error "Docker Desktop was not found at: $dockerDesktop"
    exit 1
}

Write-Host "Starting Docker Desktop..."
Start-Process -FilePath $dockerDesktop | Out-Null

$maxAttempts = 24
for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Seconds 5
    if (Test-DockerEngine) {
        Write-Host "Docker Engine is ready."
        exit 0
    }
    Write-Host "Waiting for Docker Engine... ($i/$maxAttempts)"
}

Write-Error "Docker Engine is still unavailable. Open Docker Desktop and check its status manually."
exit 1
