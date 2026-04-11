# Module Split

## 总体模块

当前项目按 4 条线推进：

1. 数据库线
2. 后端接口线
3. 前端页面线
4. 验证与文档线

## 数据库线

负责人要做的事：

- 维护 ER 关系
- 维护建表 SQL
- 维护索引
- 输出典型查询 SQL
- 输出初始化数据

当前文件：

- `sql/10_hrms_schema.sql`
- `sql/20_sample_queries.sql`

## 后端接口线

负责人要做的事：

- 建目录结构
- 做统一返回格式
- 做登录、权限、员工、部门、岗位、请假接口
- 接数据库

建议目录：

- `backend/src/controllers`
- `backend/src/services`
- `backend/src/repositories`
- `backend/src/models`
- `backend/src/common`

## 前端页面线

负责人要做的事：

- 登录页
- 主后台页
- 员工管理页
- 部门岗位管理页
- 请假管理页
- 审计日志页

建议目录：

- `frontend/src/pages`
- `frontend/src/components`
- `frontend/src/api`

## 验证与文档线

负责人要做的事：

- 跑数据库验证
- 整理接口文档
- 准备演示脚本
- 写英文版开发手册

当前文件：

- `master/DATABASE_SPEC.md`
- `master/API_SPEC.md`
- `master/MINIMAL_VERIFICATION.md`

## 当前并行方式

### 可以立即并行的部分

- 数据库负责人补查询 SQL
- 后端负责人建代码骨架
- 前端负责人画页面与接口占位
- 文档负责人整理报告结构

### 必须先统一再动手的部分

- 字段命名
- 接口路径
- 统一响应格式
- 角色权限边界
