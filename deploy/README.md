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

这些文件的作用就是：

- 告诉你后端和前端运行时可能需要哪些配置

## 这个目录和 `ops/` 是什么关系

可以这样理解：

- `ops/` 负责“怎么执行”
- `deploy/` 负责“部署时要带哪些模板”

也就是说：

- `ops/` 更像工具区
- `deploy/` 更像发布材料区

## 相关脚本

- [ops/deploy/build_release_bundle.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/deploy/build_release_bundle.ps1)
- [ops/db/backup_hrms.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/backup_hrms.ps1)
- [ops/db/restore_hrms.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/restore_hrms.ps1)

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

更完整的整体说明统一看：

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
