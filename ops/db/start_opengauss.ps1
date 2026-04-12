param(
    [string]$ContainerName = "opengauss-hrms",
    [string]$Image = "opengauss/opengauss:6.0.0-RC1",
    [string]$Password = "OpenGauss123!",
    [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

Write-Host "Checking Docker..."
docker version | Out-Null

$existing = docker ps -a --filter "name=^${ContainerName}$" --format "{{.Names}}"
if ($existing) {
    Write-Host "Container '$ContainerName' already exists."
    Write-Host "Starting existing container..."
    docker start $ContainerName | Out-Null
} else {
    Write-Host "Creating container '$ContainerName' from image '$Image'..."
    docker run --name $ContainerName `
        --privileged=true `
        -d `
        -e GS_PASSWORD=$Password `
        -e GS_NODENAME=gaussdb `
        -p ${Port}:5432 `
        $Image | Out-Null
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
