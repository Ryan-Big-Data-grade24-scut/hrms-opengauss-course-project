# 前端说明

## 这部分是干什么的

这是项目的前端页面层。

它的作用就是：

- 把后端接口展示成能操作的页面
- 让老师、队友一眼看懂系统在干什么

## 当前技术栈

- `Vue 3`
- `Vite`
- `Element Plus`
- `UnoCSS`
- `Axios`
- `Vue Router`

## 前端目录怎么理解

### `src/main.js`

前端启动入口。

### `src/router/index.js`

前端路由入口。

它决定：

- 访问哪个地址时显示哪个页面

### `src/views/`

这里放各个页面。

当前已经有：

- `LoginView.vue`
- `EmployeesView.vue`
- `DepartmentsView.vue`
- `LeavesView.vue`
- `ProfileView.vue`

### `src/api/` 或类似请求封装位置

这里主要负责：

- 调后端接口
- 统一处理请求头和 token

## 当前已经有的页面

- `/login`
- `/employees`
- `/departments`
- `/leaves`
- `/profile`

## 前端开发最重要的两件事

### 1. 先看接口说明

统一看：

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

这里要重点看：

- 请求路径
- 请求方式
- 请求参数
- 返回结构
- 哪些接口已经实现
- 哪些接口只是先定义了

### 2. 再看当前已经做了哪些页面

不要一上来就盲写页面，先确认：

- 这个模块后端接口有没有
- 如果接口还没做，是不是只是先保留占位

## 现在前端怎么连后端

当前已经配置好了代理：

- `/api` -> `http://127.0.0.1:18080`

所以开发时：

- 前端直接请求 `/api/...`
- 不需要自己额外处理跨域

## 怎么启动前端

先确认后端已经在运行：

- `http://127.0.0.1:18080`

然后执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB\frontend
npm install
npm run dev
```

前端地址：

- `http://127.0.0.1:5173`

## 前端下一步最值得补什么

建议优先补：

1. 组织管理页
2. 请假审批动作
3. 审计页
4. 更完整的员工资料页

这样最容易把现在的后端和新的人事主体接起来。
