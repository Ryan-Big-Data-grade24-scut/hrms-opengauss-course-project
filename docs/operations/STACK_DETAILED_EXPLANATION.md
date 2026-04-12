# Stack Detailed Explanation

这份文档从最底层的 Docker / openGauss 开始，往上讲到后端、前端和脚本体系。

目标不是只告诉你“怎么点”，而是解释：

- 每一层是什么
- 每一层在这个仓库里负责什么
- 各层之间是怎么连接起来的

## 1. 最底层：Docker

### Docker 是什么

Docker 是一个容器平台。

在这个项目里，你可以把它理解成：

- 一个帮我们快速跑服务的环境容器工具
- 我们不用在 Windows 上手动安装 openGauss 本体
- 而是直接启动一个已经装好 openGauss 的容器

### 为什么我们要用 Docker

因为这门课的重点不是“数据库安装运维”，而是：

- 数据库设计
- SQL
- 后端接口
- 前端页面
- 演示交付

Docker 的价值在于：

- 快速起库
- 环境可复现
- CLI 操作方便
- 不容易把本机环境越装越乱

### 当前相关脚本

- `ops/startup/00_start_docker.ps1`
- `ops/db/start_opengauss.ps1`

## 2. 数据库容器层：openGauss

### openGauss 是什么

`openGauss` 是数据库管理系统。

你可以把它理解成：

- 真正存放员工、部门、请假、权限等数据的软件
- 真正执行 SQL 的底层系统

### 我们在容器里做了什么

我们创建了一个容器：

- 容器名：`opengauss-hrms`

里面跑的是：

- `openGauss`

### 启动之后数据库里有什么

数据库名：

- `hrms`

核心表包括：

- `sys_user`
- `sys_role`
- `sys_permission`
- `sys_user_role`
- `sys_role_permission`
- `department`
- `position`
- `employee`
- `leave_request`
- `audit_log`

这些表共同组成了人力管理系统的最小数据库结构。

### 当前相关文件

- `sql/10_hrms_schema.sql`
- `sql/20_sample_queries.sql`
- `master/DATABASE_SPEC.md`

### 当前相关脚本

- `ops/db/init_hrms.ps1`
- `ops/db/verify_hrms.ps1`

## 3. 数据层之上的桥：后端

### 后端是什么

后端就是：

- 接收前端请求
- 做登录和权限校验
- 查数据库
- 把结果整理成 JSON 返回

你可以把它理解成：

- 前端和数据库中间的翻译层

### 我们当前后端做了什么

后端是 Python 写的最小 HTTP 服务。

它支持：

- 登录
- 个人信息
- 员工列表 / 新增 / 修改 / 删除
- 部门列表
- 岗位列表
- 请假列表
- 审计日志

### 后端怎么访问数据库

当前这版后端不是传统数据库驱动直连，而是：

- 通过 `docker exec`
- 在容器里调用 `gsql`
- 执行 SQL

这是一个偏课程项目、偏 CLI-first 的做法。

好处：

- 简单
- 好控
- 环境一致

代价：

- 不适合生产级高并发
- 后面如果继续升级，可以再换更正规的数据库驱动方案

### 当前相关目录

- `backend/`
- `ops/backend/`

## 4. 用户能看到的界面层：前端

### 前端是什么

前端是最终展示给老师和组员看的操作界面。

它负责：

- 登录页
- 员工页
- 部门岗位页
- 请假页
- 个人中心页

### 当前前端技术栈

- `Vue 3`
- `Vite`
- `Element Plus`
- `UnoCSS`
- `Axios`
- `Vue Router`

### 为什么这么选

因为你们这个项目是典型的管理系统：

- 表格很多
- 表单很多
- 筛选分页很多

这套栈的优点是：

- CLI 友好
- 启动快
- UI 组件成熟
- 容易做出顺眼的后台页面

### 前端怎么调用后端

前端通过 `Axios` 调 `/api/...` 接口。

Vite 已经配置代理：

- `/api` -> `http://127.0.0.1:18080`

所以开发时不需要自己手动处理跨域。

### 当前相关目录

- `frontend/`
- `ops/frontend/`

## 5. 权限和会话是怎么工作的

### 登录发生了什么

1. 前端调用 `/api/auth/login`
2. 后端校验用户名密码
3. 后端返回 token 和 profile
4. 前端把 token 存到本地
5. 后续请求在请求头里带上 `Authorization: Bearer ...`

### 权限怎么决定

数据库里有：

- 用户
- 角色
- 权限

关系是：

- 用户 -> 角色
- 角色 -> 权限

后端会把当前用户的权限列表带出来，然后保护对应接口。

## 6. 审计日志层

这个项目里还有一个很有价值的层：

- `audit_log`

它记录：

- 谁做了什么操作
- 操作了哪种对象
- 操作目标 ID 是多少
- 什么时候做的

它的意义很大：

- 演示时很加分
- 方便后面加 AI 分析
- 也适合未来接备份恢复说明

## 7. 自动化层：ops

### 为什么专门有 `ops/`

因为这个仓库强调：

- 尽量用 CLI
- 减少手工点来点去
- 把重复操作固定成脚本

现在 `ops/` 分成：

- `ops/db`
- `ops/backend`
- `ops/frontend`
- `ops/startup`

### 这层解决什么问题

- 新机器上怎么启动
- 环境坏了怎么恢复
- 怎么一键拉起整套栈
- 怎么做最小验证

## 8. 文档层：docs

### 为什么统一到 `docs/`

因为之前存在多个平级文档目录，时间一长会乱。

现在统一成：

- `docs/course_requirements`
- `docs/course_materials`
- `docs/research`
- `docs/operations`
- `master/plans`

这样任何人进仓库都知道：

- 正式要求在哪
- 组内原始材料在哪
- 研究资料在哪
- 操作手册在哪
- 后续规划在哪

## 9. 一句话串起来

整个仓库的运行链路可以总结成：

1. Docker 提供容器环境
2. 容器里跑 openGauss
3. Python 后端负责调数据库并暴露 API
4. Vue 前端调用 API 展示页面
5. `ops/` 负责启动和验证
6. `docs/` 负责沉淀规范、资料、研究和手册

也就是说：

> Docker 跑数据库，后端包住数据库，前端调用后端，脚本管理启动，文档统一沉淀。
