# Backend Test Manual

这份手册面向当前工作区里的最小后端实现，目标是帮助你用最少步骤完成：

- 启动数据库
- 启动后端
- 登录拿到 token
- 测试核心查询接口
- 测试员工增改删
- 查看审计日志

## 1. 测试前提

先确认这几件事：

- 你在项目根目录：`E:\Ufolder\Current\ActionSys\Hgclass\DB`
- Docker 正常可用
- `opengauss-hrms` 容器已经启动
- `hrms` 数据库已经初始化

如果还没初始化数据库，可以执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\start_opengauss.ps1 -Image opengauss/opengauss:latest
powershell -ExecutionPolicy Bypass -File .\ops\db\init_hrms.ps1
```

检查数据库是否正常：

```powershell
docker ps --filter "name=^opengauss-hrms$"
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

正常情况下你会看到：

- 容器 `opengauss-hrms`
- 用户数、部门数、员工数、请假数

## 2. 启动后端

打开一个新的 PowerShell 窗口，执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\start_backend.ps1
```

默认服务地址：

```text
http://127.0.0.1:8080
```

演示账号：

```text
admin / 123456
```

## 3. 最快自检

如果你只是想先确认“后端是不是活的”，直接执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

正常输出类似：

```text
Token acquired
Employees: 2
Departments: 3
Leaves: 2
```

这说明：

- 登录成功
- 员工列表能查
- 部门列表能查
- 请假列表能查

## 4. PowerShell 里几个关键概念

### `$变量名`

表示变量，也就是装数据的小盒子。

例如：

```powershell
$token = "abc123"
```

### `@{}`

表示键值对对象，可以理解成小字典。

例如：

```powershell
$headers = @{
  Authorization = "Bearer abc123"
}
```

### `|`

表示管道，把左边的结果交给右边继续处理。

例如：

```powershell
@{ username = "admin" } | ConvertTo-Json
```

### `ConvertTo-Json`

把 PowerShell 对象转成 JSON 字符串，方便发给后端接口。

### `.data.token`

表示从返回对象里一层层取值。

例如：

```powershell
$login.data.token
```

就是：

- 先取 `$login`
- 再取里面的 `data`
- 再取里面的 `token`

## 5. 手动登录并拿 token

先执行：

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8080/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'
```

这一步的意思是：

- 用 `POST` 调登录接口
- 把用户名密码发给后端
- 把登录返回结果装进 `$login`

然后取出 token：

```powershell
$token = $login.data.token
```

再把 token 包成请求头：

```powershell
$headers = @{
  Authorization = "Bearer $token"
}
```

这一步之后，你就可以带着身份访问受保护接口了。

## 6. 查询类接口测试

### 6.1 查当前登录用户

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:8080/api/auth/profile" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在验证：

- token 是否有效
- 当前用户是谁
- 当前用户有哪些角色和权限

### 6.2 查员工列表

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:8080/api/employees?page=1&page_size=10" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在验证：

- 员工查询接口是否正常
- 分页结构是否正常
- 员工和部门、岗位关联是否正常

重点看这些字段：

- `data.list`
- `data.total`
- `department_name`
- `position_name`

### 6.3 查部门列表

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:8080/api/departments" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在验证：

- 部门接口正常
- 下拉选项类数据正常

### 6.4 查岗位列表

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:8080/api/positions" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

### 6.5 查请假列表

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:8080/api/leaves?page=1&page_size=10" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在验证：

- 请假记录接口正常
- 员工与请假关联正常
- 审批状态能否正常返回

## 7. 员工 CRUD 测试

这一部分是后端验收里最重要的部分。

### 7.1 新增员工

先准备请求体：

```powershell
$createBody = @{
  employee_no = "E2026888"
  full_name = "api_demo_user"
  gender = "M"
  hire_date = "2026-04-11"
  employment_status = "active"
  department_id = 1
  position_id = 1
} | ConvertTo-Json
```

再调用新增接口：

```powershell
$created = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8080/api/employees" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $createBody
```

这一步的意思是：

- 把一份新员工数据发给后端
- 后端写入数据库
- 返回新增后的员工记录

拿到新增员工的主键 ID：

```powershell
$employeeId = $created.data.employee_id
```

### 7.2 修改员工

准备修改数据：

```powershell
$updateBody = @{
  full_name = "api_demo_user_updated"
  phone = "13900000000"
} | ConvertTo-Json
```

调用修改接口：

```powershell
Invoke-RestMethod -Method Put `
  -Uri "http://127.0.0.1:8080/api/employees/$employeeId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $updateBody | ConvertTo-Json -Depth 6
```

这一步在验证：

- 更新接口正常
- 修改结果能回查出来

### 7.3 删除员工

```powershell
Invoke-RestMethod -Method Delete `
  -Uri "http://127.0.0.1:8080/api/employees/$employeeId" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

这一步在验证：

- 删除接口正常
- 刚创建的测试数据已经清理掉

## 8. 审计日志测试

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://127.0.0.1:8080/api/audits?page=1&page_size=10" `
  -Headers $headers | ConvertTo-Json -Depth 6
```

你应该能看到类似：

- `create employee`
- `update employee`
- `delete employee`

这一步说明：

- 后端不只是改了数据库
- 还把关键操作记进了审计日志

## 9. 你现在到底在验证什么

如果你按上面的顺序走完，实际上验证了这些东西：

1. 后端服务能启动
2. 后端能连 openGauss
3. 登录接口正常
4. token 鉴权正常
5. 员工、部门、岗位、请假查询正常
6. 员工新增、修改、删除正常
7. 审计日志正常

这已经构成一个完整的最小后端闭环。

## 10. 常见问题

### 10.1 登录失败

先确认：

- 后端已经启动
- 数据库已经初始化
- 账号密码是不是：

```text
admin / 123456
```

### 10.2 提示 token 无效

说明你没有先登录，或者 `$headers` 没准备好。

请重新执行：

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8080/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'

$token = $login.data.token
$headers = @{ Authorization = "Bearer $token" }
```

### 10.3 接口没响应

先检查后端进程是不是还在：

```powershell
Get-Process python
```

或者检查 8080 端口：

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen
```

### 10.4 怎么停掉后端

如果你是前台启动的，直接关掉那个 PowerShell 窗口。

如果要强制结束：

```powershell
Get-Process python | Stop-Process -Force
```

## 11. 推荐测试顺序

如果你是第一次测，建议按这个顺序来：

1. `ops/db/verify_hrms.ps1`
2. `ops/backend/start_backend.ps1`
3. `ops/backend/smoke_test.ps1`
4. 手动登录拿 token
5. 查员工/部门/请假
6. 新增员工
7. 修改员工
8. 删除员工
9. 查审计日志

## 12. 相关文件

- [start_backend.ps1](E:/Ufolder/Current/ActionSys/Hgclass/DB/ops/backend/start_backend.ps1)
- [smoke_test.ps1](E:/Ufolder/Current/ActionSys/Hgclass/DB/ops/backend/smoke_test.ps1)
- [verify_hrms.ps1](E:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/verify_hrms.ps1)
- [README.md](E:/Ufolder/Current/ActionSys/Hgclass/DB/backend/README.md)
