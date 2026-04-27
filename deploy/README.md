# 部署说明

## 这个目录是干什么的

这个目录不是完整的自动化运维系统。

它现在主要解决的是：

- 项目要怎么打包
- 环境变量要怎么准备
- 以后迁到另一台机器或云服务器时，基础材料放哪里

## 这里目前有什么

- `env/backend.env.example`
- `env/frontend.env.example`
- `nginx/nginx.conf`

这些文件的作用就是：

- 告诉你后端和前端运行时可能需要哪些配置
- `nginx/nginx.conf` 是生产环境 Nginx 配置模板，用于静态托管前端构建产物并反向代理后端 API

## 这个目录和 `ops/` 是什么关系

可以这样理解：

- `ops/` 负责“怎么执行”
- `deploy/` 负责“部署时要带哪些模板”

也就是说：

- `ops/` 更像工具区
- `deploy/` 更像发布材料区

## 相关脚本

- [ops/deploy/build_release_bundle.ps1](../ops/deploy/build_release_bundle.ps1)
- [ops/db/backup_hrms.ps1](../ops/db/backup_hrms.ps1)
- [ops/db/restore_hrms.ps1](../ops/db/restore_hrms.ps1)

## 这部分现在主要服务什么流程

最常见的流程是：

1. 先把前端构建好
2. 准备后端代码和脚本
3. 打出一个发布包
4. 拷到另一台机器或者云服务器
5. 需要时恢复数据库数据
6. 在目标机器上把服务启动起来

## 这一层现在还没做什么

当前还没有做：

- 完整 CI/CD
- 云厂商专属自动化
- Kubernetes 这类复杂编排

因为你们现在更需要的是：

- 能打包
- 能迁移
- 能恢复
- 能在另一台机器跑起来

## Nginx 静态托管

生产环境推荐用 Nginx 托管构建后的前端，而不是跑 `npm run dev`。

流程：

1. 运行 `ops\deploy\build_release_bundle.ps1` 生成 `dist\release_bundle\frontend_dist`
2. 运行 `ops\frontend\start_frontend_nginx.ps1` 启动 Nginx（自动使用 `deploy\nginx\nginx.conf` 模板）
3. Nginx 监听 `http://127.0.0.1:80`，同时反向代理 `/api` 到后端 `http://127.0.0.1:18080`

`npm run dev`（Vite dev server）仅用于本地开发，不应在生产或演示环境直接暴露。

更完整的整体说明统一看：

- [docs/HANDBOOK.md](../docs/HANDBOOK.md)

