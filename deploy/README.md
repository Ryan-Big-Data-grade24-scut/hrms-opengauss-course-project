# Deployment Base

这个目录是当前仓库的轻量 deployment 基座。

目标不是现在就做完整云端自动发布，而是先固定：

- 发布时需要哪些文件
- 运行时需要哪些环境变量
- 如何把本地可运行系统迁到云主机

## 当前定位

适合当前阶段的 deployment 基座应该做到：

- 可打包
- 可迁移
- 可配置
- 不强绑定某一家云厂商

## 当前推荐部署形态

### 数据库

- openGauss 容器
- 使用持久化卷
- 用 `backup / restore` 迁移数据

### 后端

- Python 直接运行
- 通过环境变量注入配置

### 前端

- 先执行 `npm run build`
- 产出静态文件
- 后续由任意静态文件服务方式承载

## 当前不做的事

- 不在本阶段做复杂 CI/CD
- 不在本阶段做 Kubernetes
- 不在本阶段做完整云厂商自动化编排

## 当前发布流程

1. 本地执行数据库备份
2. 本地构建前端静态资源
3. 生成发布包
4. 把发布包复制到云主机
5. 云主机恢复数据库
6. 云主机启动后端和前端

## 相关文件

- `deploy/env/backend.env.example`
- `deploy/env/frontend.env.example`
- `ops/deploy/build_release_bundle.ps1`
- `ops/db/backup_hrms.ps1`
- `ops/db/restore_hrms.ps1`
