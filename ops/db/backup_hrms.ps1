param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$DbName = "hrms",
    [string]$User = "omm",
    [string]$Password = "OpenGauss123!"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDir = Join-Path $RepoRoot "backups"
New-Item -ItemType Directory -Force $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "${DbName}_${timestamp}.sql"
$containerPath = "/tmp/$fileName"
$hostPath = Join-Path $BackupDir $fileName
$ldPath = "/usr/local/opengauss/lib"
$gsDump = "/usr/local/opengauss/bin/gs_dump"

Write-Host "Creating logical backup for database '$DbName'..."
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsDump -h 127.0.0.1 -p 5432 -U $User -W $Password -f $containerPath $DbName
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create backup inside container."
}

Write-Host "Copying backup to host..."
docker cp "${ContainerName}:${containerPath}" $hostPath
if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy backup file to host."
}

Write-Host "Backup completed: $hostPath"
