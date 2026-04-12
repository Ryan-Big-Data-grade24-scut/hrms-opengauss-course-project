# 项目简报

## 这个文档是给谁看的

这份文档主要给两类人看：

- 新加入的队友
- 新接手的 AI

它的目标不是讲所有细节，而是用最短时间说清：

- 项目现在做到哪了
- 各模块是谁来接着做最顺
- 下一步最值得做什么

## 项目目标

做一个基于 `openGauss` 的企业人事管理系统，要求：

- 课程可以交付
- 小组可以分工
- 后续可以继续扩展
- AI 能快速接手

## 当前已经完成的部分

### 数据库

已经有：

- 能跑的 `openGauss`
- 数据不会轻易丢的容器方案
- 一套按顺序升级数据库结构的脚本
- 备份和恢复脚本

### 后端

已经能跑的功能有：

- 登录 / 个人信息 / 登出
- 用户管理
- 角色分配
- 部门管理
- 岗位管理
- 员工管理
- 请假管理
- 审计日志查询

### 前端

已经有页面：

- 登录页
- 员工页
- 部门页
- 请假页
- 个人信息页

### 接口总说明

已经有：

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

里面已经把：

- 已经做好的接口
- 先定义但还没实现的接口

区分清楚了。

## 当前架构怎么理解

### 数据库层

负责：

- 存数据
- 维护表结构
- 让后端能查到业务数据

最重要的位置：

- [sql/migrations](/e:/Ufolder/Current/ActionSys/Hgclass/DB/sql/migrations)

### 后端层

负责：

- 提供接口
- 处理登录和权限
- 连接数据库
- 返回前端需要的数据

最重要的位置：

- [backend/app.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/app.py)
- [backend/src/server.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py)
- [backend/src/services](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/services)

### 前端层

负责：

- 展示页面
- 调接口
- 让老师能看到完整操作流程

最重要的位置：

- [frontend/src/router/index.js](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/router/index.js)
- [frontend/src/views](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/views)

### 运维脚本层

负责：

- 启动项目
- 检查项目
- 备份恢复
- 打包发布

最重要的位置：

- [ops/startup](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/startup)
- [ops/db](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db)
- [ops/backend](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/backend)
- [ops/deploy](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/deploy)

## 推荐分工

### 基础设施 / 接口负责人

建议负责：

- 数据库结构继续升级
- 迁移脚本
- 共享接口契约
- 数据库脚本
- 后端接口骨架

这个角色最重要的任务不是永远亲自写所有业务，而是：

- 把底座搭稳
- 让别人能接着写

### 业务后端同学

建议接着做：

- `location`
- `job`
- `leave_type`
- `employee_profile`
- `employee_job_history`

### 前端同学

建议按 `openapi.yaml` 和当前后端已实现接口继续做页面和联调。

## 当前最值得做的下一步

### 后端优先

优先补这些资源：

- `locations`
- `jobs`
- `leave-types`
- `employee profile`
- `employee job history`

### 前端优先

优先补这些页面或能力：

- 组织管理页
- 请假审批动作
- 审计页
- 更完整的员工资料表单

### 数据优先

优先补：

- 更真实的种子数据
- 更完整的人事字段

## 后续规则

1. 新接口先写进 `openapi.yaml`
2. 新数据库结构先写成 migration
3. 启动、备份、恢复、打包的改动统一进 `ops/`
4. 不要再把计划拆成一堆零散文档

## 最重要的两个入口

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
