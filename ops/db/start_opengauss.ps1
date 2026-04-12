param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$Image = "opengauss/opengauss:latest",
    [string]$Password = "OpenGauss123!",
    [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

Write-Host "Checking Docker..."
docker version | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Engine is unavailable. Start Docker Desktop first."
}

$existing = docker ps -a --filter "name=^${ContainerName}$" --format "{{.Names}}"
if ($existing) {
    Write-Host "Container '$ContainerName' already exists."
    Write-Host "Starting existing container..."
    docker start $ContainerName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start container '$ContainerName'."
    }
} else {
    Write-Host "Creating container '$ContainerName' from image '$Image'..."
    docker run --name $ContainerName `
        --privileged=true `
        -d `
        -e GS_PASSWORD=$Password `
        -e GS_NODENAME=gaussdb `
        -p ${Port}:5432 `
        $Image | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create container '$ContainerName'."
    }
}

Write-Host ""
Write-Host "Done."
Write-Host "Container: $ContainerName"
Write-Host "Port: $Port"
Write-Host "User: omm"
Write-Host "Password: $Password"
Write-Host ""
Write-Host "Test command:"
Write-Host "docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib -it $ContainerName /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d postgres -U omm -W $Password"
