# 后端说明

## 这部分是干什么的

这是这个项目的后端。

它的作用就是：

- 接前端请求
- 查数据库
- 把结果按统一格式返回

这版后端故意做得比较轻：

- 用 Python 标准库起 HTTP 服务
- 直接通过 `docker exec + gsql` 查 `openGauss`
- 这样依赖少，容易跑，也容易让队友和 AI 读懂

## 关键文件

- [app.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/app.py)
  - 后端启动入口
- [src/server.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py)
  - 路由和请求处理入口
- [src/common](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/common)
  - 公共工具
- [src/services](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/services)
  - 各模块业务代码

## 现在已经实现的模块

- 登录认证
- 用户和角色
- 部门
- 岗位
- 员工
- 请假
- 审计日志

## 已经先定义、后面再实现的模块

这些已经写进接口总说明里了，但代码还没完全做出来：

- 地点 `locations`
- 职位类型 `jobs`
- 请假类型 `leave-types`
- 员工扩展资料 `employee profile`
- 员工任职历史 `employee job history`

接口总说明在：

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

## 怎么启动后端

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\start_backend.ps1
```

默认地址：

- `http://127.0.0.1:18080`

## 怎么快速验证后端

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

这个脚本会自动验证：

- 能不能登录
- 能不能查员工
- 能不能查部门
- 能不能查请假
