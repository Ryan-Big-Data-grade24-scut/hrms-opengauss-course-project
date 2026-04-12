# 部署说明

## 这个目录是干什么的

这个目录不是完整的自动化运维系统。

它现在主要是做“轻量部署基座”，也就是：

- 把环境变量模板准备好
- 让项目能被打包
- 让后面迁到别的机器或云服务器时更容易

## 这里目前有什么

- `env/backend.env.example`
- `env/frontend.env.example`

这两个文件的作用是：

- 告诉你运行后端和前端时，可能需要哪些配置

## 相关脚本

- [ops/deploy/build_release_bundle.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/deploy/build_release_bundle.ps1)
- [ops/db/backup_hrms.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/backup_hrms.ps1)
- [ops/db/restore_hrms.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/restore_hrms.ps1)

## 这个目录现在主要服务什么流程

最常见的流程是：

1. 先把前端构建好
2. 准备后端代码和脚本
3. 打出一个发布包
4. 拷到另一台机器或者云服务器
5. 需要时恢复数据库数据
6. 在目标机器上把服务启动起来

更完整的项目运行说明，统一看：

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
