# 基础服务与脚本说明

## 这部分是干什么的

这里放的是命令行脚本。

这些脚本负责的不是业务功能，而是：

- 启动项目
- 初始化数据库
- 检查环境
- 备份恢复
- 打包发布

你可以把这里理解成：

- “让整套系统真正跑起来”的工具箱

## 目录怎么分

### `startup/`

负责启动整套环境。

包括：

- 启动 Docker
- 启动数据库
- 启动后端
- 启动前端

### `db/`

负责数据库相关动作。

包括：

- 初始化数据库
- 执行迁移
- 验证数据库
- 备份
- 恢复

### `backend/`

负责后端相关脚本。

包括：

- 启动后端
- 运行最小 smoke test

### `deploy/`

负责发布包相关脚本。

目前最重要的是：

- `build_release_bundle.ps1`

## 最常用脚本

### 一键启动整套项目

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

### 检查数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

### 检查后端

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

### 备份数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\backup_hrms.ps1
```

### 恢复数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\restore_hrms.ps1 -BackupFile .\backups\你的备份.sql
```

### 生成发布包

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```

## 这层和业务代码的关系

可以这样理解：

- `backend/` 和 `frontend/` 决定系统“做什么”
- `ops/` 决定系统“怎么跑起来”

如果没有这层，队友就会很难复现环境，也很难稳定测试。
