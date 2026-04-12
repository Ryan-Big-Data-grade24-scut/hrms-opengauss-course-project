# Work Review

这份回顾文档用来沉淀当前仓库从“课设起步”推进到“具备工程底座”的过程，避免旧阶段文档继续分散在 `master/` 根目录里。

## 1. 已完成的阶段

### 阶段 1：确认课程边界

结论：

- 正式硬约束是 `openGauss`
- 没有证据表明必须上华为云开发
- 本地 Docker 路线可作为主开发环境

### 阶段 2：搭出最小闭环

结果：

- openGauss 容器可启动
- `hrms` 数据库可初始化
- 后端最小 API 可运行
- 前端最小页面可联调

### 阶段 3：补工程基础设施

结果：

- 文档统一整理到 `docs/`
- 计划和草稿统一整理到 `master/`
- 数据库已改成 migration 方式
- 数据库已支持持久化卷
- 已具备 backup / restore
- 已具备 release bundle 构建

## 2. 当前仓库的稳定结构

### `docs/`

只放正式文档资产：

- 课程要求
- 调研沉淀
- 操作手册

### `master/`

只放计划与草稿：

- 当前计划
- 共享路线图
- 设计草案
- 回顾与阶段冻结

### `ops/`

只放 CLI 自动化脚本：

- 启动
- 验证
- 备份恢复
- 发布打包

### `sql/`

只放数据库相关脚本：

- migration
- SQL 结构脚本

## 3. 当前已具备的工程能力

### 数据库

- openGauss 容器化运行
- migration 版本记录
- 命名卷持久化
- 备份恢复

### 后端

- 认证接口
- 员工、部门、岗位、请假、审计接口
- smoke test

### 前端

- 登录页
- 员工页
- 部门/岗位页
- 请假页

### 部署

- 本地一键启动
- 发布包构建
- 环境变量模板

## 4. 当前仍然缺什么

最关键的未完成项还有两类：

- 正式的 `OpenAPI` 契约
- 新数据模型对应的后端/前端联动升级

## 5. 本轮整理替代了哪些旧阶段文档

以下旧文档是早期阶段产物，现在已被更稳定的计划结构或本回顾吸收：

- `master/STEP_01_REQUIREMENTS_BASELINE.md`
- `master/PROJECT_ROADMAP.md`
- `master/MODULE_SPLIT.md`

保留但仍有效的文档：

- `master/ACTIVE_PLAN.md`
- `master/API_SPEC.md`
- `master/DATABASE_SPEC.md`
- `master/MINIMAL_VERIFICATION.md`
- `master/plans/*`

## 6. 下一步

当前建议的主线顺序：

1. 把接口契约升级成 `openapi.yaml`
2. 按 V2+ 数据模型升级后端资源接口
3. 让前端按新主体逐步对齐
4. 视精力决定是否补 AI 查询类亮点
