# Active Plan

## 当前阶段

阶段名：`Phase 2 - 数据库基线完成，进入接口与系统骨架阶段`

## 已完成

1. 重新核定课程正式要求，确认必须基于 `openGauss`
2. 澄清“未见必须使用华为云开发”的硬要求
3. 建立工作区总规则：
   - `AGENT.md`
   - `master/STEP_01_REQUIREMENTS_BASELINE.md`
   - `master/PROJECT_ROADMAP.md`
4. 修复本机 Docker Desktop / WSL 卡死问题
5. 跑通 Docker CLI
6. 拉起 `openGauss` 容器：
   - 容器名：`opengauss-hrms`
   - 镜像：`opengauss/opengauss:latest`
   - 端口：`5432`
7. 建立 `hrms` 数据库
8. 导入最小可交付表结构与种子数据

## 当前系统基线

### 数据库

- `hrms`

### 已落地表

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

### 已具备演示数据

- 用户：3
- 部门：3
- 员工：2
- 请假记录：2

## 下一阶段目标

把“只有数据库”推进到“可以联调的系统骨架”。

## 下一阶段任务

### A. 数据库整理

1. 输出表关系说明
2. 补业务字段解释
3. 准备典型查询 SQL
4. 准备备份恢复演示命令

### B. 后端骨架

1. 冻结后端目录结构
2. 定义统一返回格式
3. 定义登录接口
4. 定义员工、部门、岗位、请假接口
5. 定义权限校验方式

### C. 前端最小演示面

1. 登录页
2. 主后台页
3. 员工管理页
4. 部门岗位管理页
5. 查询筛选页

### D. 文档与分工

1. 写清 4 人分工
2. 写第一批 API 清单
3. 写数据库说明草稿

## 当前最优先执行顺序

1. 生成数据库说明与查询样例
2. 生成后端 API 清单
3. 生成系统目录骨架
4. 再开始具体编码

## 一句话目标

下一阶段结束时，应该达到：

`数据库、接口清单、系统骨架三者同时明确，项目进入稳定开发状态。`
