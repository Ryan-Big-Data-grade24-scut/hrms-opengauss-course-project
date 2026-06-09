# HRMS 一键启动脚本（PowerShell）
# 用法: .\start.ps1 [-NoBrowser]
# 自动完成: 依赖安装 → Docker → 数据库初始化 → 迁移 → 后端 → 前端

param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSCommandPath

Write-Host "================================================"
Write-Host "  HRMS 一键启动"
Write-Host "================================================"
Write-Host ""

# ============================================================
# 1. 安装依赖
# ============================================================
Write-Host "[1/7] 检查 Python 依赖..."
try {
    $pyCode = python -c "import psycopg2; print('ok')" 2>&1
    if ($pyCode -ne "ok") { throw }
    Write-Host "  ✅ Python 依赖已安装"
} catch {
    Write-Host "  🔄 安装 psycopg2-binary..."
    pip install psycopg2-binary 2>&1 | Out-Null
    Write-Host "  ✅ Python 依赖安装完成"
}

Write-Host "[2/7] 检查 Node 依赖..."
if (-not (Test-Path "$RepoRoot\frontend-react\node_modules")) {
    Write-Host "  🔄 安装前端依赖..."
    Push-Location "$RepoRoot\frontend-react"
    npm install 2>&1 | Out-Null
    Pop-Location
    Write-Host "  ✅ 前端依赖安装完成"
} else {
    Write-Host "  ✅ 前端依赖已安装"
}

# ============================================================
# 2. Docker 检查
# ============================================================
Write-Host "[3/7] 检查 Docker..."
try { docker info *>$null } catch {
    Write-Host "  ❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
}
Write-Host "  ✅ Docker 运行中"

# ============================================================
# 3. 启动 openGauss
# ============================================================
Write-Host "[4/7] 启动 openGauss 数据库..."
$container = docker ps --filter "name=opengauss-hrms" --format "{{.Names}}" 2>$null
if ($container) {
    Write-Host "  ✅ 容器已在运行"
} else {
    $stopped = docker ps -a --filter "name=opengauss-hrms" --format "{{.Names}}" 2>$null
    if ($stopped) {
        Write-Host "  🔄 启动已有容器..."
        docker start opengauss-hrms
    } else {
        Write-Host "  🔄 创建新容器..."
        docker run --name opengauss-hrms --privileged=true -d `
            -e GS_PASSWORD=OpenGauss123! -e GS_NODENAME=gaussdb `
            -p 5432:5432 -v opengauss-hrms-data:/var/lib/opengauss `
            opengauss/opengauss:latest
    }
}

# 等待数据库就绪（最多 60 秒）
Write-Host "  ⏳ 等待数据库就绪..."
$maxWait = 60
$ready = $false
for ($i = 1; $i -le $maxWait; $i++) {
    $result = docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib opengauss-hrms `
        sh -c '/usr/local/opengauss/bin/gsql -d postgres -U omm -W OpenGauss123! -t -A -c "SELECT 1;"' 2>$null
    if ($result -eq "1") { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Write-Host "  ❌ 数据库在 $maxWait 秒内未就绪"
    exit 1
}
Write-Host "  ✅ 数据库就绪"

# ============================================================
# 4. 初始化数据库（创建用户 + 数据库 + 迁移）
# ============================================================
Write-Host "[5/7] 初始化数据库..."

$gsql = '/usr/local/opengauss/bin/gsql'
$ldPath = 'LD_LIBRARY_PATH=/usr/local/opengauss/lib'
$conn = "-d postgres -U omm -W OpenGauss123!"

# 创建 hrms_app 用户
$userExists = docker exec -e $ldPath opengauss-hrms sh -c "$gsql $conn -t -A -c ""SELECT 1 FROM pg_roles WHERE rolname='hrms_app';""" 2>$null
if ($userExists -ne "1") {
    docker exec -e $ldPath opengauss-hrms sh -c "$gsql $conn -c ""CREATE USER hrms_app WITH PASSWORD 'HRMS_App_2026!' SYSADMIN;""" 2>$null
    Write-Host "  ✅ 创建 hrms_app 用户"
} else {
    Write-Host "  ✅ hrms_app 用户已存在"
}

# 创建 hrms 数据库
$dbExists = docker exec -e $ldPath opengauss-hrms sh -c "$gsql -t -A -c ""SELECT 1 FROM pg_database WHERE datname='hrms';""" 2>$null
if ($dbExists -ne "1") {
    docker exec -e $ldPath opengauss-hrms sh -c "$gsql -c ""CREATE DATABASE hrms;""" 2>$null
    Write-Host "  ✅ 创建 hrms 数据库"
} else {
    Write-Host "  ✅ hrms 数据库已存在"
}

# 检查迁移历史表
$migTable = docker exec -e $ldPath opengauss-hrms sh -c "$gsql -d hrms -U omm -W OpenGauss123! -t -A -c ""SELECT 1 FROM information_schema.tables WHERE table_name='schema_migration_history';""" 2>$null

if ($migTable -eq "1") {
    # 检查已应用的迁移数
    $applied = docker exec -e $ldPath opengauss-hrms sh -c "$gsql -d hrms -U omm -W OpenGauss123! -t -A -c ""SELECT COUNT(*) FROM schema_migration_history;""" 2>$null
    Write-Host "  ✅ 已有 $applied 个迁移已应用"
} else {
    Write-Host "  🔄 运行 V1 迁移..."
    docker cp "$RepoRoot\sql\migrations\V1__baseline.sql" opengauss-hrms:/tmp/V1.sql
    docker exec -e $ldPath opengauss-hrms sh -c "$gsql -d hrms -U omm -W OpenGauss123! -f /tmp/V1.sql" 2>$null
}

# 按顺序应用 V2-V11（跳过已应用的）
Write-Host "  🔄 检查并应用迁移..."
$migs = @(
    "V2__org_and_job.sql", "V3__employee_profile_and_history.sql",
    "V4__leave_type_and_leave_upgrade.sql", "V5__discover.sql",
    "V6__company_seed.sql", "V7__attrition_hybrid.sql",
    "V8__analytics_attendance_performance.sql", "V9__schema_enhance.sql",
    "V9__permissions_seed.sql", "V10__approval_workflow.sql",
    "V11__fix_approval_schema.sql"
)
foreach ($file in $migs) {
    $ver = $file.Split("__")[0]
    $done = docker exec -e $ldPath opengauss-hrms sh -c "$gsql -d hrms -U omm -W OpenGauss123! -t -A -c ""SELECT 1 FROM schema_migration_history WHERE version='$ver';""" 2>$null
    if ($done -eq "1") {
        Write-Host "  ⏭️ 跳过 $ver（已应用）"
    } else {
        Write-Host "  🔄 应用 $ver..."
        docker cp "$RepoRoot\sql\migrations\$file" opengauss-hrms:/tmp/$file
        docker exec -e $ldPath opengauss-hrms sh -c "$gsql -d hrms -U omm -W OpenGauss123! -f /tmp/$file" 2>$null
        # 记录迁移
        docker exec -e $ldPath opengauss-hrms sh -c "$gsql -d hrms -U omm -W OpenGauss123! -c ""INSERT INTO schema_migration_history (version, filename) SELECT '$ver', '$file' WHERE NOT EXISTS (SELECT 1 FROM schema_migration_history WHERE version='$ver');""" 2>$null
    }
}
Write-Host "  ✅ 数据库初始化完成"

# ============================================================
# 5. 启动后端
# ============================================================
Write-Host "[6/7] 启动后端..."
$backProc = Get-CimInstance Win32_Process -Filter "Name='python.exe'" 2>$null | Where-Object { $_.CommandLine -match 'app.py' }
if ($backProc) {
    Write-Host "  ✅ 后端已在运行"
} else {
    $logFile = "$RepoRoot\backend\app.log"
    Push-Location "$RepoRoot\backend"
    $p = Start-Process -WindowStyle Hidden -PassThru python -ArgumentList "app.py"
    Pop-Location
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:18080/api/auth/login" -Method POST `
            -ContentType "application/json" -Body '{"username":"admin","password":"123456"}' -UseBasicParsing -TimeoutSec 5
        Write-Host "  ✅ 后端已启动 (port 18080)"
    } catch {
        Write-Host "  ⚠️ 后端启动中，请稍后检查"
    }
}

# ============================================================
# 6. 启动前端
# ============================================================
Write-Host "[7/7] 启动前端..."
$frontProc = Get-CimInstance Win32_Process -Filter "Name='node.exe'" 2>$null | Where-Object { $_.CommandLine -match 'vite' }
if ($frontProc) {
    Write-Host "  ✅ 前端已在运行"
} else {
    Push-Location "$RepoRoot\frontend-react"
    $p = Start-Process -WindowStyle Hidden -PassThru npx -ArgumentList "vite --host 0.0.0.0 --port 5173"
    Pop-Location
    Start-Sleep -Seconds 5
    Write-Host "  ✅ 前端已启动 (port 5173)"
}

# ============================================================
# 7. 完成
# ============================================================
Write-Host ""
Write-Host "================================================"
Write-Host "  🎉 启动完成！"
Write-Host ""
Write-Host "  前端: http://localhost:5173"
Write-Host "  后端: http://localhost:18080"
Write-Host "  所有账号密码: 123456"
Write-Host "================================================"

if (-not $NoBrowser) {
    Start-Process "http://localhost:5173"
}
