# HRMS 一键启动脚本（PowerShell）
param(
    [switch]$NoBrowser
)

$RepoRoot = Split-Path -Parent $PSCommandPath
$HostUI = "http://localhost:5173"
$BackendUI = "http://localhost:18080"

Write-Host "================================================"
Write-Host "  HRMS 一键启动"
Write-Host "================================================"
Write-Host ""

# 1. Docker
Write-Host "[1/5] 检查 Docker..."
docker version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Docker 未运行"
    exit 1
}
Write-Host "  ✅ Docker 运行中"

# 2. openGauss
Write-Host ""
Write-Host "[2/5] 检查 openGauss 容器..."
$container = docker ps --filter "name=opengauss-hrms" --format "{{.Names}}"
if ($container) {
    Write-Host "  ✅ openGauss 已在运行"
} else {
    $stopped = docker ps -a --filter "name=opengauss-hrms" --format "{{.Names}}"
    if ($stopped) {
        Write-Host "  🔄 启动已有容器..."
        docker start opengauss-hrms
    } else {
        Write-Host "  🔄 创建新容器..."
        docker run --name opengauss-hrms --privileged=true -d `
            -e GS_PASSWORD=OpenGauss123! `
            -e GS_NODENAME=gaussdb `
            -p 5432:5432 `
            -v opengauss-hrms-data:/var/lib/opengauss `
            opengauss/opengauss:latest
    }
    Start-Sleep -Seconds 3
    Write-Host "  ✅ openGauss 已就绪"
}

# 3. V10 迁移
Write-Host ""
Write-Host "[3/5] 检查 V10 审批流表..."
docker exec opengauss-hrms gsql -d hrms -U omm -W OpenGauss123! -t -A -c "SELECT count(*) FROM approval_request;" -e LD_LIBRARY_PATH=/usr/local/opengauss/lib 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ V10 表已存在"
} else {
    Write-Host "  🔄 应用 V10 迁移..."
    docker cp "$RepoRoot\sql\migrations\V10__approval_workflow.sql" opengauss-hrms:/tmp/V10.sql
    docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib opengauss-hrms gsql -d hrms -U omm -W OpenGauss123! -f /tmp/V10.sql | Out-Null
    Write-Host "  ✅ V10 迁移完成"
}

# 4. 后端
Write-Host ""
Write-Host "[4/5] 启动后端..."
$backProc = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "app.py" }
if ($backProc) {
    Write-Host "  ✅ 后端已在运行 (port 18080)"
} else {
    Start-Process powershell -NoNewWindow -ArgumentList "-NoExit", "-Command", "cd '$RepoRoot\backend'; python app.py"
    Start-Sleep -Seconds 4
    Write-Host "  ✅ 后端已启动 (port 18080)"
}

# 5. 前端
Write-Host ""
Write-Host "[5/5] 启动前端..."
$frontProc = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "vite" }
if ($frontProc) {
    Write-Host "  ✅ 前端已在运行 (port 5173)"
} else {
    Start-Process powershell -NoNewWindow -ArgumentList "-NoExit", "-Command", "cd '$RepoRoot\frontend-react'; npx vite --host 0.0.0.0 --port 5173"
    Start-Sleep -Seconds 5
    Write-Host "  ✅ 前端已启动 (port 5173)"
}

# 打开浏览器
if (-not $NoBrowser) {
    Start-Sleep -Seconds 1
    Start-Process $HostUI
}

Write-Host ""
Write-Host "================================================"
Write-Host "  🎉 启动完成！"
Write-Host ""
Write-Host "  前端: $HostUI"
Write-Host "  后端: $BackendUI"
Write-Host "  登录密码: 123456"
Write-Host "  账号: admin / ceo / vp_eng / employee"
Write-Host "================================================"
