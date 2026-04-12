param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$DbName = "hrms",
    [string]$User = "omm",
    [string]$Password = "OpenGauss123!",
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

$ldPath = "/usr/local/opengauss/lib"
$gsql = "/usr/local/opengauss/bin/gsql"
$containerPath = "/tmp/" + [System.IO.Path]::GetFileName($BackupFile)

Write-Host "Copying backup file into container..."
docker cp $BackupFile "${ContainerName}:${containerPath}"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy backup file into container."
}

Write-Host "Creating database '$DbName' if it does not exist..."
$exists = docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -t -A -c "SELECT 1 FROM pg_database WHERE datname='${DbName}';" 2>$null
if ($exists -notmatch "1") {
    docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -c "CREATE DATABASE ${DbName};" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create database '$DbName' before restore."
    }
}

Write-Host "Resetting schema in '$DbName' before restore..."
$terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DbName}' AND pid <> pg_backend_pid();"
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -c $terminateSql | Out-Null

$resetSql = @"
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO omm;
GRANT ALL ON SCHEMA public TO public;
"@

docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d $DbName -U $User -W $Password -c $resetSql | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to reset schema in '$DbName' before restore."
}

Write-Host "Restoring database '$DbName' from backup..."
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d $DbName -U $User -W $Password -f $containerPath
if ($LASTEXITCODE -ne 0) {
    throw "Failed to restore database from backup."
}

Write-Host "Restore completed."
