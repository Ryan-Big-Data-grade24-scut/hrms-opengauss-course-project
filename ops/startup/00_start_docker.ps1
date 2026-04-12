$ErrorActionPreference = "Stop"

$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$wingetAvailable = $null

function Test-DockerEngine {
    cmd /c "docker info >nul 2>nul"
    return $LASTEXITCODE -eq 0
}

function Test-DockerCliInstalled {
    cmd /c "where docker >nul 2>nul"
    return $LASTEXITCODE -eq 0
}

function Test-WingetAvailable {
    if ($null -ne $script:wingetAvailable) {
        return $script:wingetAvailable
    }

    cmd /c "where winget >nul 2>nul"
    $script:wingetAvailable = $LASTEXITCODE -eq 0
    return $script:wingetAvailable
}

if (Test-DockerEngine) {
    Write-Host "Docker Engine is already available."
    exit 0
}

if (-not (Test-DockerCliInstalled) -and -not (Test-Path $dockerDesktop)) {
    Write-Host "Docker was not detected on this machine." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This project needs Docker Desktop to run openGauss." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Recommended install steps:" -ForegroundColor Yellow
    Write-Host "1. Install Docker Desktop manually from https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow

    if (Test-WingetAvailable) {
        Write-Host "2. Or install it from PowerShell with:" -ForegroundColor Yellow
        Write-Host "   winget install --id Docker.DockerDesktop -e --accept-source-agreements --accept-package-agreements" -ForegroundColor Yellow
    }

    Write-Host "3. After installation, reopen PowerShell and rerun start_stack.ps1" -ForegroundColor Yellow
    exit 1
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
