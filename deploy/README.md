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
- `nginx/hrms.conf`

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

- [ops/deploy/build_release_bundle.ps1](../ops/deploy/build_release_bundle.ps1)
- [ops/db/backup_hrms.ps1](../ops/db/backup_hrms.ps1)
- [ops/db/restore_hrms.ps1](../ops/db/restore_hrms.ps1)
- [ops/ec2/deploy_ec2.sh](../ops/ec2/deploy_ec2.sh)

## 这部分现在主要服务什么流程

最常见的流程是：

1. 先把前端构建好
2. 准备后端代码和脚本
3. 打出一个发布包
4. 拷到另一台机器或者云服务器
5. 需要时恢复数据库数据
6. 在目标机器上把服务启动起来

## EC2 落地脚本

如果目标机器是 Linux EC2，并且你要从零部署或修复网页环境，推荐直接运行：

```bash
bash ops/ec2/deploy_ec2.sh
```

这个脚本现在负责 Linux EC2 的完整部署流程。它会做六件事：

1. 安装缺失的基础依赖并启动 `docker` / `nginx`
2. 确保 openGauss 容器运行
3. 等待 openGauss 就绪、创建业务库并应用迁移
4. 构建前端并发布到本机静态目录
5. 准备 HTTPS 证书并安装 Nginx 站点配置
6. 在本机启动后端接口服务

前提是：

- 机器可以通过 `sudo` 安装缺失的系统包
- 机器可以访问 Ubuntu 软件源以安装 `docker.io`、`nginx`、`nodejs`、`npm`、`python3`、`openssl`
- 当前用户可以执行 Docker 命令，并且可以通过 `sudo` 安装和重载 Nginx 配置

如果你只是要把已经部署好的宿主机重新拉起服务，不需要重新部署，直接运行仓库根目录的 [start_ec2_web.sh](../start_ec2_web.sh) 即可。

## EC2 部署端口建议

推荐只对外开放：

- `80`
- `443`

现在 Nginx 会把 `80` 自动重定向到 `443`，HTTPS 站点默认使用自签证书。如果你之后换成正式域名和 CA 证书，只需要替换 `/etc/ssl/certs/hrms-selfsigned.crt` 和 `/etc/ssl/private/hrms-selfsigned.key`。

建议保持内部访问或本机访问：

- `18080` 后端端口，仅本机或反向代理访问
- `5432` openGauss 端口，仅本机或 Docker 内访问
- `5173` Vite 开发端口，仅开发时使用

## 推荐部署形态

1. openGauss 跑在本机 Docker 容器里
2. 后端只监听本机 `127.0.0.1:18080`
3. Nginx 对外监听 `80/443`
4. Nginx 托管前端 `dist/`
5. Nginx 把 `/api` 反代到后端

这样安全组只要放行 `80/443` 就能让任何主机访问网页。

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

- [docs/HANDBOOK.md](../docs/HANDBOOK.md)

