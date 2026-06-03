#!/bin/bash
# HRMS 一键启动脚本
# 自动检查环境 → 启动数据库 → 启动后端 → 启动前端

set -e

echo "================================================"
echo "  HRMS 一键启动"
echo "================================================"

# 1. 检查 Docker
echo ""
echo "[1/4] 检查 Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "  ❌ Docker 未运行。请先启动 Docker Desktop。"
    exit 1
fi
echo "  ✅ Docker 运行中"

# 2. 启动 openGauss
echo ""
echo "[2/4] 检查 openGauss 容器..."
if docker ps --filter name=opengauss-hrms --format "{{.Names}}" | grep -q opengauss-hrms; then
    echo "  ✅ openGauss 已在运行"
elif docker ps -a --filter name=opengauss-hrms --format "{{.Names}}" | grep -q opengauss-hrms; then
    echo "  🔄 启动已有容器..."
    docker start opengauss-hrms
    echo "  ✅ openGauss 已启动"
else
    echo "  🔄 创建新容器..."
    docker run --name opengauss-hrms --privileged=true -d \
        -e GS_PASSWORD=OpenGauss123! \
        -e GS_NODENAME=gaussdb \
        -p 5432:5432 \
        -v opengauss-hrms-data:/var/lib/opengauss \
        opengauss/opengauss:latest
    echo "  ✅ openGauss 已创建并启动"
fi

# 等待数据库就绪
echo "  ⏳ 等待数据库就绪..."
sleep 3

# 3. 应用 V10 迁移（审批流表）
echo ""
echo "[3/4] 检查 V10 审批流表..."
MSYS2_ARG_CONV_EXCL="*" docker exec opengauss-hrms sh -c '
    LD_LIBRARY_PATH=/usr/local/opengauss/lib /usr/local/opengauss/bin/gsql \
    -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123! \
    -t -A -c "SELECT count(*) FROM approval_request;"' > /dev/null 2>&1 && \
    echo "  ✅ V10 表已存在" || {
    echo "  🔄 应用 V10 迁移..."
    docker cp sql/migrations/V10__approval_workflow.sql opengauss-hrms:/tmp/V10.sql
    MSYS2_ARG_CONV_EXCL="*" docker exec opengauss-hrms sh -c '
        LD_LIBRARY_PATH=/usr/local/opengauss/lib /usr/local/opengauss/bin/gsql \
        -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123! -f /tmp/V10.sql' > /dev/null 2>&1
    echo "  ✅ V10 迁移完成"
}

# 4. 启动后端
echo ""
echo "[4/4] 启动后端..."
cd "$(dirname "$0")/backend"
if lsof -i :18080 > /dev/null 2>&1; then
    echo "  ✅ 后端已在运行 (port 18080)"
else
    python app.py &
    sleep 3
    echo "  ✅ 后端已启动 (port 18080)"
fi

# 5. 启动前端
echo ""
echo "[5/5] 启动前端..."
cd "$(dirname "$0")/frontend-react"
if lsof -i :5173 > /dev/null 2>&1; then
    echo "  ✅ 前端已在运行 (port 5173)"
else
    npx vite --host 0.0.0.0 --port 5173 &
    sleep 4
    echo "  ✅ 前端已启动 (port 5173)"
fi

echo ""
echo "================================================"
echo "  🎉 启动完成！"
echo ""
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:18080"
echo "  登录密码: 123456"
echo ""
echo "  账号: admin / ceo / vp_eng / employee ..."
echo "================================================"
