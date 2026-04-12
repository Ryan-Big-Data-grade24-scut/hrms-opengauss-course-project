# Minimal Verification

## 目标

先跑出一个“最小可验证闭环”，不是等全部写完才验证。

## 当前闭环定义

### 1. 数据库闭环

必须验证：

- openGauss 容器可启动
- `hrms` 数据库存在
- 关键表存在
- 种子数据存在

### 2. 业务闭环

最小要能证明：

- 有用户角色权限模型
- 有员工管理模型
- 有请假记录模型
- 有查询筛选能力

### 3. 系统闭环

最小要能说明：

- 前端会调用哪些接口
- 后端会访问哪些表
- 每个模块由谁负责

## 当前可执行验证

### 启动数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\start_opengauss.ps1 -Image opengauss/opengauss:latest
```

### 初始化数据库

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\init_hrms.ps1
```

### 连库

```powershell
docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib -it opengauss-hrms /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123!
```

### 跑验证脚本

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

## 当前成功标准

验证脚本执行后，至少应确认：

- 用户数量 > 0
- 部门数量 > 0
- 员工数量 > 0
- 请假记录数量 > 0

## 下一轮最小验证

数据库层跑通之后，下一轮要验证的是：

1. 登录接口是否返回 token
2. 员工列表接口是否返回分页数据
3. 新增员工接口是否能成功写库
4. 请假记录查询接口是否能按状态筛选
