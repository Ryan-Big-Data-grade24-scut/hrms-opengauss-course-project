# Deployment Base Guide

这份文档说明当前仓库的 deployment 基座是什么，以及它适合做到什么程度。

## 1. 当前判断

当前阶段适合补一个**轻量 deployment 基座**，但不适合现在就做复杂的云端自动化发布系统。

原因：

- 你们已经有本地闭环
- 很快就要面临“怎么迁到云端”和“怎么给组员共享运行面”
- 但还没到值得投入完整 CI/CD 的阶段

所以当前最合理的是：

- 先把发布包结构固定
- 先把环境变量模板固定
- 先把数据库持久化、备份恢复流程固定

## 2. 当前 deployment 基座包含什么

### 数据库

- `ops/db/start_opengauss.ps1`
- `ops/db/upgrade_to_persistent_container.ps1`
- `ops/db/backup_hrms.ps1`
- `ops/db/restore_hrms.ps1`

### 应用打包

- `ops/deploy/build_release_bundle.ps1`

### 运行配置

- `deploy/env/backend.env.example`
- `deploy/env/frontend.env.example`

### 发布说明

- `deploy/README.md`

## 3. 当前推荐发布流程

1. 本地数据库完成备份
2. 前端执行构建
3. 执行发布包构建脚本
4. 将发布包放到云主机
5. 云主机恢复数据库
6. 云主机启动后端和前端

## 4. 当前不建议做的事

- 不建议现在上复杂容器编排
- 不建议现在上 Kubernetes
- 不建议现在做一整套云厂商自动化流水线

## 5. 一句话结论

当前 deployment 基座的目标不是“自动化到极致”，而是：

> 让这套仓库从本地样例工程，进化成可以被稳定打包、迁移、恢复、放到云主机上的工程。
