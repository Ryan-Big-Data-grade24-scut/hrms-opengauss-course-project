#!/bin/bash
# HRMS 一键启动脚本（Linux / macOS / Git Bash）
# 用法: bash start.sh
# 自动完成: 依赖安装 → Docker → 数据库初始化 → 迁移 → 后端 → 前端

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo "  HRMS 一键启动"
echo "================================================"

# [1/7] 安装 Python 依赖
echo ""
echo "[1/7] 检查 Python 依赖..."
PY=$(command -v python3 || command -v python)
PIP=$(command -v pip3 || command -v pip)
if $PY -c "import psycopg2" 2>/dev/null; then
    echo "  ✅ Python 依赖已安装"
else
    echo "  🔄 安装 psycopg2-binary..."
    $PIP install psycopg2-binary 2>/dev/null
    echo "  ✅ 完成"
fi

# [2/7] 安装 Node 依赖
echo ""
echo "[2/7] 检查 Node 依赖..."
if [ -d "$REPO_ROOT/frontend-react/node_modules" ]; then
    echo "  ✅ 前端依赖已安装"
else
    echo "  🔄 安装前端依赖..."
    cd "$REPO_ROOT/frontend-react" && npm install && cd "$REPO_ROOT"
    echo "  ✅ 完成"
fi

# [3/7] 检查 Docker
echo ""
echo "[3/7] 检查 Docker..."
docker info > /dev/null 2>&1 || { echo "  ❌ Docker 未运行"; exit 1; }
echo "  ✅ Docker 运行中"

# [4/7] 启动 openGauss
echo ""
echo "[4/7] 启动 openGauss..."
if docker ps --filter name=opengauss-hrms --format "{{.Names}}" 2>/dev/null | grep -q .; then
    echo "  ✅ 容器已在运行"
elif docker ps -a --filter name=opengauss-hrms --format "{{.Names}}" 2>/dev/null | grep -q .; then
    echo "  🔄 启动已有容器..." && docker start opengauss-hrms
else
    echo "  🔄 拉取并创建新容器..."
    docker pull opengauss/opengauss:latest 2>/dev/null || echo "  ⚠️ 拉取超时可手动: docker pull opengauss/opengauss:latest"
    docker run --name opengauss-hrms --privileged=true -d \
        -e GS_PASSWORD=OpenGauss123! -e GS_NODENAME=gaussdb \
        -p 5432:5432 -v opengauss-hrms-data:/var/lib/opengauss \
        opengauss/opengauss:latest
fi

echo "  ⏳ 等待数据库就绪..."
for i in $(seq 1 60); do
    result=$(MSYS2_ARG_CONV_EXCL="*" docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib opengauss-hrms \
        sh -c '/usr/local/opengauss/bin/gsql -d postgres -U omm -W OpenGauss123! -t -A -c "SELECT 1;"' 2>/dev/null)
    [ "$result" = "1" ] && break
    sleep 2
done
[ "$result" != "1" ] && { echo "  ❌ 数据库未就绪"; exit 1; }
echo "  ✅ 数据库就绪"

# [5/7] 初始化数据库
echo ""
echo "[5/7] 初始化数据库..."
GE() { MSYS2_ARG_CONV_EXCL="*" docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib opengauss-hrms sh -c "$1"; }
GS() { GE "/usr/local/opengauss/bin/gsql -d ${2:-postgres} -U omm -W OpenGauss123! -t -A -c \"$1\""; }

# 创建用户
[ "$(GS "SELECT 1 FROM pg_roles WHERE rolname='hrms_app'" 2>/dev/null)" != "1" ] && \
    GS "CREATE USER hrms_app WITH PASSWORD 'HRMS_App_2026!' SYSADMIN;" postgres 2>/dev/null && echo "  ✅ 创建 hrms_app" || echo "  ✅ hrms_app 已存在"

# 创建数据库
[ "$(GS "SELECT 1 FROM pg_database WHERE datname='hrms'" 2>/dev/null)" != "1" ] && \
    GS "CREATE DATABASE hrms;" postgres 2>/dev/null && echo "  ✅ 创建 hrms" || echo "  ✅ hrms 已存在"

# 应用迁移
MIGS="V1__baseline.sql V2__org_and_job.sql V3__employee_profile_and_history.sql V4__leave_type_and_leave_upgrade.sql V5__discover.sql V6__company_seed.sql V7__attrition_hybrid.sql V8__analytics_attendance_performance.sql V9__schema_enhance.sql V9__permissions_seed.sql V10__approval_workflow.sql V11__fix_approval_schema.sql V12__complete_fix.sql"
echo "  🔄 应用迁移..."
for f in $MIGS; do
    v="${f%%__*}"
    d=$(GS "SELECT 1 FROM schema_migration_history WHERE version='$v'" hrms 2>/dev/null)
    [ "$d" = "1" ] && echo "  ⏭️ 跳过 $v" && continue
    echo "  🔄 应用 $v..."
    docker cp "$REPO_ROOT/sql/migrations/$f" opengauss-hrms:/tmp/$f 2>/dev/null
    GE "/usr/local/opengauss/bin/gsql -d hrms -U omm -W OpenGauss123! -f /tmp/$f" 2>/dev/null
    GS "INSERT INTO schema_migration_history (version,filename) SELECT '$v','$f' WHERE NOT EXISTS (SELECT 1 FROM schema_migration_history WHERE version='$v')" hrms 2>/dev/null
done
echo "  ✅ 数据库初始化完成"

echo "  🔄 修复数据..."
cd "$REPO_ROOT/backend" && $PY data_fix.py 2>/dev/null && cd "$REPO_ROOT"
echo "  ✅ 数据修复完成"

# [6/7] 启动后端
echo ""
echo "[6/7] 启动后端..."
if lsof -i :18080 2>/dev/null || ss -tlnp 2>/dev/null | grep -q 18080; then
    echo "  ✅ 后端已在运行"
else
    cd "$REPO_ROOT/backend" && nohup $PY app.py > /dev/null 2>&1 & cd "$REPO_ROOT"
    sleep 3 && echo "  ✅ 后端已启动 (port 18080)"
fi

# [7/7] 启动前端
echo ""
echo "[7/7] 启动前端..."
if lsof -i :5173 2>/dev/null || ss -tlnp 2>/dev/null | grep -q 5173; then
    echo "  ✅ 前端已在运行"
else
    cd "$REPO_ROOT/frontend-react" && nohup npx vite --host 0.0.0.0 --port 5173 > /dev/null 2>&1 & cd "$REPO_ROOT"
    sleep 4 && echo "  ✅ 前端已启动 (port 5173)"
fi

echo ""
echo "================================================"
echo "  🎉 启动完成！"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:18080"
echo "  所有账号密码: 123456"
echo "================================================"
