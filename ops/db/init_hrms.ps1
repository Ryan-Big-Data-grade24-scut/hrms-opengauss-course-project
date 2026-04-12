param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$DbName = "hrms",
    [string]$User = "omm",
    [string]$Password = "OpenGauss123!"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$SchemaFile = Join-Path $RepoRoot "sql\10_hrms_schema.sql"

Write-Host "Creating database '$DbName' if it does not exist..."
$gsql = "/usr/local/opengauss/bin/gsql"
$ldPath = "/usr/local/opengauss/lib"
$exists = docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -t -A -c "SELECT 1 FROM pg_database WHERE datname='${DbName}';" 2>$null
if ($exists -match "1") {
    Write-Host "Database '$DbName' already exists."
} else {
    docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -h 127.0.0.1 -p 5432 -d postgres -U $User -W $Password -c "CREATE DATABASE ${DbName};"
}

Write-Host "Applying schema..."
docker cp $SchemaFile "${ContainerName}:/tmp/10_hrms_schema.sql"
docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -h 127.0.0.1 -p 5432 -d ${DbName} -U $User -W $Password -f /tmp/10_hrms_schema.sql

Write-Host ""
Write-Host "Done."
Write-Host "Database: $DbName"
Write-Host "Schema file: $SchemaFile"
