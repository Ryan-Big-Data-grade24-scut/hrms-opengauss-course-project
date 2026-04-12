param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$Image = "opengauss/opengauss:latest",
    [string]$Password = "OpenGauss123!",
    [string]$VolumeName = "opengauss-hrms-data",
    [string]$DatabaseName = "hrms",
    [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDir = Join-Path $RepoRoot "backups"
New-Item -ItemType Directory -Force $BackupDir | Out-Null

Write-Host "Checking Docker..."
docker version | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Engine is unavailable. Start Docker Desktop first."
}

$inspect = docker inspect $ContainerName | ConvertFrom-Json
if (-not $inspect -or $inspect.Count -lt 1) {
    throw "Container '$ContainerName' does not exist."
}

$mounts = $inspect[0].Mounts
if ($mounts -and $mounts.Count -gt 0) {
    Write-Host "Container '$ContainerName' already has persistent mounts. No migration needed."
    exit 0
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$containerDump = "/tmp/${DatabaseName}_${timestamp}.sql"
$hostDump = Join-Path $BackupDir "${DatabaseName}_${timestamp}.sql"
$ldPath = "/usr/local/opengauss/lib"
$gsql = "/usr/local/opengauss/bin/gsql"
$gsDump = "/usr/local/opengauss/bin/gs_dump"

Write-Host "Creating logical backup inside container..."
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsDump -d $DatabaseName -f $containerDump -U omm
if ($LASTEXITCODE -ne 0) {
    throw "Failed to dump database '$DatabaseName'."
}

Write-Host "Copying backup to host: $hostDump"
docker cp "${ContainerName}:${containerDump}" $hostDump
if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy dump file from container."
}

Write-Host "Stopping and removing old container..."
docker stop $ContainerName | Out-Null
docker rm $ContainerName | Out-Null

Write-Host "Starting new persistent container with named volume '$VolumeName'..."
docker run --name $ContainerName `
    --privileged=true `
    -d `
    -e GS_PASSWORD=$Password `
    -e GS_NODENAME=gaussdb `
    -p ${Port}:5432 `
    -v ${VolumeName}:/var/lib/opengauss `
    $Image | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create new persistent container."
}

Write-Host "Waiting for openGauss service..."
for ($i = 0; $i -lt 30; $i++) {
    try {
        docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -d postgres -U omm -W $Password -c "SELECT 1;" | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    } catch {
    }
    Start-Sleep -Seconds 2
}

Write-Host "Creating database '$DatabaseName'..."
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -d postgres -U omm -W $Password -c "CREATE DATABASE ${DatabaseName};" | Out-Null

Write-Host "Restoring logical backup..."
docker cp $hostDump "${ContainerName}:${containerDump}"
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -d $DatabaseName -U omm -W $Password -f $containerDump | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to restore database '$DatabaseName'."
}

Write-Host ""
Write-Host "Persistent upgrade completed."
Write-Host "Named volume: $VolumeName"
Write-Host "Backup file: $hostDump"
