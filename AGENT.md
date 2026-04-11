# DB 课设总接管 AGENT

本工作区只做一件事：把这次数据库课程设计从“同学讨论里的模糊方向”，收束成一个能按要求交付的 openGauss 项目。

## 当前边界

- 这里优先处理课程要求、技术落地、数据库设计与最小实现
- 同学群聊、灵感讨论、公司产品类比都只作为参考，不作为硬依据
- `course_requirements/` 是本轮判定要求的第一来源
- 本工作区是当前唯一主落点，所有新结论优先沉淀到这里

## 当前目标

1. 锁定课程硬要求与非硬要求
2. 锁定项目主线与技术边界
3. 跑通 openGauss 本地环境
4. 建出最小可交付数据库
5. 逐步补齐后端、前端、文档与演示材料

## 当前硬约束

- 一切以 `course_requirements/Database Course Design Requirements.docx` 为准
- 先确认“必须交什么”，再扩展亮点
- 必须基于 `openGauss`
- 不能把“华为云”默认等同于“必须上云部署”
- 先做可演示闭环，再做 AI/备份恢复等增强项
- 新增脚本、SQL、计划文档优先放在本工作区

## 当前判断

- 当前最稳主线是：`企业人力资源管理系统（openGauss）`
- 当前最稳亮点是：`备份恢复 / 审计 / AI 查询助手` 三选一或分阶段加入
- 当前最适合的环境路径是：`本地 Docker + openGauss + CLI`

## 来源对象

- 课程正式要求：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\course_requirements\Database Course Design Requirements.docx`
- 课程配套资料：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\course_requirements`
- 当前背景记录：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\memory.md`
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\企业人力管理系统.docx`
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\Backup_Recovery_System_Architecture.md`
- 当前研究与沉淀：
  - `E:\Ufolder\Current\ActionSys\Hgclass\DB\research`

## 本轮产物优先级

- `master/`：总计划、步骤清单、需求判定、任务推进记录
- `sql/`：建库 SQL、初始化数据、查询样例
- `scripts/`：环境启动、数据库初始化、备份恢复脚本
- `research/`：官方资料、参考仓库、检索结论
- 根目录：项目级规则文件与核心说明

## 当前执行顺序

1. 先把课程要求翻译成“必须做 / 可选做 / 不要求做”
2. 再把项目主线收束成最小可交付方案
3. 然后跑通 openGauss 与最小建库
4. 再推进后端接口、前端页面、查询与权限
5. 最后加亮点模块与收尾材料
