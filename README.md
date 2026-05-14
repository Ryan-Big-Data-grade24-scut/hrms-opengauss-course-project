# 数据库课程项目

这是一个基于 `openGauss + Python API + Vue 3` 的企业人事管理系统仓库。

这个仓库面向AI开发，关键在于[AGENT.md](AGENT.md)，这是给人类快速上手的指南：

## 第一次进仓库先看什么

按这个顺序看就够了：

1. [docs/HANDBOOK.md](docs/HANDBOOK.md)
2. [master/PROJECT_BRIEF.md](master/PROJECT_BRIEF.md)
3. [master/contracts/openapi.yaml](master/contracts/openapi.yaml)
4. [AGENT.md](AGENT.md)

看完这四个，基本就能知道：

- 现在已经有什么
- 怎么把整套东西跑起来
- 当前架构分成哪几层
- 后面应该继续做什么

## 现在仓库里已经有了什么

- 一个能跑的 `openGauss` 数据库
- 一套按顺序升级数据库的脚本
- 数据备份和恢复脚本
- 一个能跑的 Python 后端
- 一个能跑的 Vue 前端
- 一份接口总说明 `openapi.yaml`
- 一套命令行启动、测试、打包脚本

## 关键目录入口

### 文档和项目状态（人类只需要读懂这里就行 剩下的交给AI）

- [docs/HANDBOOK.md](docs/HANDBOOK.md)
- [docs/RESEARCH_SUMMARY.md](docs/RESEARCH_SUMMARY.md)
- [master/PROJECT_BRIEF.md](master/PROJECT_BRIEF.md)
- [master/contracts/openapi.yaml](master/contracts/openapi.yaml)

### 代码层（负责哪个模块仔细看哪个）

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [sql/README.md](sql/README.md)
- [ops/README.md](ops/README.md)
- [deploy/README.md](deploy/README.md)

## 最常用命令

**Linux EC2 已部署宿主启动网页服务**：

```bash
cd <仓库根目录>
bash ./start_ec2_web.sh
```

**Linux EC2 停掉网页服务**：

```bash
cd <仓库根目录>
bash ./stop_ec2_web.sh
```

**Linux EC2 从零部署网页环境**：

```bash
cd <仓库根目录>
bash ./ops/ec2/deploy_ec2.sh
```

**一键启动**整套环境：

```powershell
cd <仓库根目录>
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

检查数据库是不是正常：

```powershell
cd <仓库根目录>
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

检查后端是不是正常：

```powershell
cd <仓库根目录>
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

构建发布包：

```powershell
cd <仓库根目录>
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```
