# API Owner Delivery Target

这份文档回答 3 个问题：

1. 接口负责人最终应该交付什么
2. 当前仓库的终极目标应该定义成什么
3. 每个模块的接口设计边界应该怎么划

## 1. 建议的终极目标

建议把本项目的可讨论终极目标定义为：

> 交付一套基于 openGauss 的企业人力资源管理系统最小可演示闭环，具备完整的数据模型、稳定的后端 API、可运行的前端页面、基础权限控制、审计日志，以及一个可选亮点模块。

这里的关键词不是“大而全”，而是：

- 可演示
- 可联调
- 可重复启动
- 可验证
- 可分工维护

## 2. 你作为接口负责人需要交付的内容

你不需要对整个项目负责到底，但你需要交付“别人能接得住”的后端接口层。

建议你的交付边界是：

- 一份冻结的接口契约
- 一套按模块拆分的 API
- 一套统一的响应与错误格式
- 一套本地可启动的后端服务
- 一套最小联调脚本
- 一份接口测试手册
- 一份给前端和数据库同学能看懂的接口说明

更具体地说，你的交付物至少应该包括：

- `backend/` 可运行
- `ops/backend/start_backend.ps1` 可启动
- `ops/backend/smoke_test.ps1` 可自检
- `master/API_SPEC.md` 或后续 OpenAPI 文件可作为接口契约
- 接口和数据库关系有明确映射
- 每个写接口至少写审计日志

## 3. 你最适合交付到什么程度

对课程项目来说，最合理的接口交付标准不是“工业级微服务”，而是下面这个等级：

### P0：必须交付

- 登录 / 登出 / 当前用户信息
- 用户列表、角色列表、用户角色分配
- 部门 CRUD
- 岗位 CRUD
- 员工 CRUD + 分页筛选
- 请假申请、请假列表、请假审批
- 审计日志列表

### P1：建议交付

- 更完整的参数校验
- 更明确的错误码
- 更一致的分页和筛选行为
- 审计日志筛选
- 更清晰的权限拒绝提示

### P2：可选亮点

- 备份恢复接口的真实实现
- AI 查询助手接口
- AI 审计解释接口

## 4. 每个模块的详细设计

## 4.1 认证模块

目标：

- 让前端能完成登录、身份保持、退出

接口：

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `POST /api/auth/logout`

输入：

- 用户名
- 密码

输出：

- token
- 当前用户基本信息
- 角色列表
- 权限列表

依赖表：

- `sys_user`
- `sys_user_role`
- `sys_role`
- `sys_role_permission`
- `sys_permission`

前端依赖：

- 登录页
- 个人中心页
- 路由守卫
- 权限控制

## 4.2 用户与角色模块

目标：

- 让管理员管理系统登录用户和角色分配

接口：

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{user_id}`
- `DELETE /api/users/{user_id}`
- `GET /api/roles`
- `PUT /api/users/{user_id}/roles`

依赖表：

- `sys_user`
- `sys_role`
- `sys_user_role`

关键设计点：

- 用户列表要支持分页
- 用户状态要可筛选
- 分配角色接口只负责替换角色，不负责修改用户其他字段

## 4.3 组织目录模块

目标：

- 为员工信息提供部门和岗位字典

接口：

- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments/{department_id}`
- `DELETE /api/departments/{department_id}`
- `GET /api/positions`
- `POST /api/positions`
- `PUT /api/positions/{position_id}`
- `DELETE /api/positions/{position_id}`

依赖表：

- `department`
- `position`

关键设计点：

- 删除前要考虑是否已有员工引用
- 这些接口既是管理接口，也是前端表单下拉框的数据源

## 4.4 员工模块

目标：

- 提供系统最核心的业务接口

接口：

- `GET /api/employees`
- `GET /api/employees/{employee_id}`
- `POST /api/employees`
- `PUT /api/employees/{employee_id}`
- `DELETE /api/employees/{employee_id}`

依赖表：

- `employee`
- `department`
- `position`

查询需求：

- 分页
- 关键字
- 部门筛选
- 岗位筛选
- 状态筛选
- 入职日期范围

关键设计点：

- 列表接口要返回部门名和岗位名，不能只返回 ID
- 写接口要保证关键外键存在
- 删除和修改必须记审计日志

## 4.5 请假模块

目标：

- 提供最小审批流演示

接口：

- `GET /api/leaves`
- `POST /api/leaves`
- `PUT /api/leaves/{leave_id}/approve`
- `PUT /api/leaves/{leave_id}/reject`

依赖表：

- `leave_request`
- `employee`

关键设计点：

- 列表要支持分页和状态筛选
- 审批动作要写入状态变化
- 后续建议补字段：
  - `approver_username`
  - `approved_at`
  - `approval_comment`

## 4.6 审计模块

目标：

- 让系统的关键操作可追踪、可演示

接口：

- `GET /api/audits`

依赖表：

- `audit_log`

建议的记录范围：

- 登录成功
- 用户创建 / 修改 / 删除
- 部门创建 / 修改 / 删除
- 岗位创建 / 修改 / 删除
- 员工创建 / 修改 / 删除
- 请假审批

## 4.7 亮点模块

这里不要提前重投入，只做“预留接口 + 清晰边界”。

### 备份恢复

接口：

- `GET /api/backups`
- `POST /api/backups`
- `POST /api/restores`

当前定位：

- 可以先占位
- 等主功能稳定后再接真实逻辑

### AI 查询

建议形式：

- 新增只读接口，例如 `POST /api/ai/query`
- 输入自然语言
- 输出受控 SQL 和查询结果

约束：

- 只允许白名单表
- 只允许只读查询
- 必须展示生成 SQL

## 5. 你现在这套架构是不是最优

结论分两层：

### 对“本周交作业”来说

当前架构是可接受的，而且不建议大改。

原因：

- openGauss 已经跑通
- 后端已可运行
- 前端已能联调
- CLI 启动链路已经建立

### 对“更像长期维护项目”来说

当前架构不是最优，只是最务实的第一版。

主要短板：

- 后端直接用 `http.server`，扩展性一般
- 数据访问通过 `docker exec + gsql`，不是标准应用连接方式
- 还没有正式的 OpenAPI 契约文件
- 还没有数据库迁移机制
- 自动化测试还停留在 smoke test

## 6. 我建议的现实升级路线

不是重写，而是逐步升级：

1. 先冻结接口契约
2. 再补参数校验和错误码
3. 再把数据库脚本改造成版本化迁移
4. 最后才考虑把数据库访问从 `gsql` 升级到驱动直连

## 7. 模块协作范式建议

最适合你们这种 3 到 5 人小组的协作方式是：

- 数据库同学维护 `sql/` 与数据字典
- 接口同学维护 `backend/` 与 API 契约
- 前端同学维护 `frontend/`
- 文档/整合同学维护 `docs/`、测试、演示路径

协作顺序建议：

1. 先在文档里冻结字段和接口
2. 再按模块分支开发
3. 每个模块完成后用 smoke 或手工脚本联调
4. 合并前做一次页面级验收

## 8. 你现在最适合对外说的话

如果组员问你“你这个接口部分到底要交付到什么程度”，你可以直接回答：

> 我负责把 HR 系统的认证、用户角色、部门岗位、员工、请假、审计这 6 类接口做成可联调、可测试、可演示的一整层，并把接口契约和测试方式固定下来，保证前端和数据库同学都能对接。

这句话就很像一个成熟的接口负责人交付边界。
