param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$DbName = "hrms",
    [string]$User = "omm",
    [string]$Password = "OpenGauss123!",
    [string]$MigrationsDir = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $MigrationsDir) {
    $MigrationsDir = Join-Path $RepoRoot "sql\migrations"
}

if (-not (Test-Path $MigrationsDir)) {
    throw "Migrations directory not found: $MigrationsDir"
}

$gsql = "/usr/local/opengauss/bin/gsql"
$ldPath = "/usr/local/opengauss/lib"

$historySql = @"
CREATE TABLE IF NOT EXISTS schema_migration_history (
    version VARCHAR(50) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"@

docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d $DbName -U $User -W $Password -c $historySql | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare schema_migration_history."
}

$files = Get-ChildItem -Path $MigrationsDir -Filter "V*__*.sql" | Sort-Object Name
if (-not $files) {
    Write-Host "No migration files found in $MigrationsDir"
    exit 0
}

foreach ($file in $files) {
    $version = $file.BaseName.Split("__")[0]
    $exists = docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d $DbName -U $User -W $Password -t -A -c "SELECT 1 FROM schema_migration_history WHERE version='${version}';" 2>$null
    if ($exists -match "1") {
        Write-Host "Skipping $($file.Name) (already applied)."
        continue
    }

    $containerPath = "/tmp/$($file.Name)"
    Write-Host "Applying $($file.Name)..."
    docker cp $file.FullName "${ContainerName}:${containerPath}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to copy migration file: $($file.Name)"
    }

    docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d $DbName -U $User -W $Password -f $containerPath
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed: $($file.Name)"
    }

    $insertSql = "INSERT INTO schema_migration_history (version, filename) VALUES ('${version}', '$($file.Name)');"
    docker exec -e LD_LIBRARY_PATH=$ldPath $ContainerName $gsql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -d $DbName -U $User -W $Password -c $insertSql | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to record migration history for $($file.Name)"
    }
}

Write-Host "All migrations are up to date."
