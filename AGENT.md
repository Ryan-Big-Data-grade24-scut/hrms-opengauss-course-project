# DB Course Project AGENT

本工作区只做一件事：把这次数据库课程设计收敛成一个可交付、可演示、可复现、对 AI 协作友好的 `openGauss` 项目。

## 当前边界

- 这里优先处理课程要求、技术落地、数据库设计、前后端实现与演示材料
- 同学群聊、灵感讨论、竞品类比只能作参考，不能直接当硬依据
- 课程正式要求的第一来源是：
  - `docs/course_requirements/Database Course Design Requirements.docx`
- `docs/` 只存：
  - 课程要求
  - 调研资产
  - 操作手册
- `master/` 只存：
  - 计划
  - 草稿
  - 规范草案
  - 讨论中的阶段性设计
- 自动化脚本统一沉淀到 `ops/`

## 当前目标

1. 锁定课程硬要求与提交物
2. 维持并完善 `openGauss` 课设主线
3. 保持数据库、后端、前端三层都可启动、可验证
4. 让项目尽可能通过 CLI 工具完成开发、启动、测试
5. 在主系统稳定的前提下，再推进亮点扩展
6. 让接口层、数据库层、前端层之间的协作边界足够清晰，适合 AI 和多人并行开发

## 当前硬约束

- 一切以 `docs/course_requirements/Database Course Design Requirements.docx` 为准
- 必须基于 `openGauss`
- 不默认把“华为云”理解成必须上云部署
- 先保证可演示闭环，再做 AI / 备份恢复等增强项
- 文档目录只认 `docs/`
- 计划目录只认 `master/`
- 脚本目录只认 `ops/`
- `master/drafts/` 用于本地草稿，默认不纳入版本控制
- 尽可能优先使用 CLI 工具完成开发、启动、调试、验证
- 不得为了修 Docker 随意执行全局 `wsl --shutdown`
- 将 `WSL` 视为高敏运行面；除非用户明确允许，否则不要关闭或重置

## 当前判断

- 当前最稳主线是：`企业人力资源管理系统（openGauss）`
- 当前最稳亮点方向是：
  - `备份恢复`
  - `审计分析`
  - `AI 查询助手`
- 当前最适合的开发路径是：
  - `本地 Docker + openGauss + CLI`
  - `Python 后端`
  - `Vue 3 + Vite` 前端
- 如果评估云端部署，也应优先选择：
  - CLI 友好
  - 文档清晰
  - 低成本或免费
  - 能支撑数据库和 AI 助手稳定在线

## 来源对象

- 课程正式要求：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\docs\course_requirements\Database Course Design Requirements.docx`
- 课程配套材料：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\docs\course_requirements`
- 组内已有项目输入：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\docs\course_materials\project_inputs`
- 研究与资料沉淀：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\docs\research`
- 项目计划与草稿：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\master`

## 产物优先级

- `master/`：计划、路线图、规范草案、讨论稿
- `sql/`：数据库 schema、样例查询、初始化 SQL
- `backend/`：后端实现
- `frontend/`：前端实现
- `ops/`：启动、验证、联调脚本
- `docs/`：课程材料、研究资料、操作手册

## 执行顺序

1. 先确认课程要求和当前目标是否一致
2. 再确认数据库、后端、前端是否都能启动
3. 然后在 `master/` 里冻结计划、边界和模块职责
4. 再推进最小可演示闭环
5. 再完善模块和页面
6. 最后增加亮点功能与交付材料
