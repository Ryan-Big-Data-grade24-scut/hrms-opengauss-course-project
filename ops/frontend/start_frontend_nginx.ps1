param(
    [string]$FrontendDistPath = "",
    [string]$NginxExe = "nginx"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if (-not $FrontendDistPath) {
    $FrontendDistPath = Join-Path $RepoRoot "dist\release_bundle\frontend_dist"
}

$NginxConfTemplate = Join-Path $RepoRoot "deploy\nginx\nginx.conf"
$TmpConf = Join-Path $env:TEMP "hrms_nginx.conf"

if (-not (Test-Path $FrontendDistPath)) {
    throw "frontend_dist 不存在：$FrontendDistPath`n请先运行 ops\deploy\build_release_bundle.ps1"
}

# 将模板中的占位路径替换为实际路径（Windows 路径需转换为正斜杠）
$distPathForwardSlash = $FrontendDistPath.Replace("\", "/")
(Get-Content $NginxConfTemplate -Raw) `
    -replace "/path/to/release_bundle/frontend_dist", $distPathForwardSlash |
    Set-Content $TmpConf -Encoding UTF8

Write-Host "Starting Nginx..."
Write-Host "  Config : $TmpConf"
Write-Host "  Dist   : $FrontendDistPath"
Write-Host "  URL    : http://127.0.0.1:80"

& $NginxExe -c $TmpConf
if ($LASTEXITCODE -ne 0) {
    throw "Nginx 启动失败，请检查配置：$TmpConf"
}

Write-Host "Nginx 已启动。使用 'nginx -s stop' 或关闭进程来停止。"
