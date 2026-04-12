# 前端说明

## 这部分是干什么的

这是这个项目的前端页面。

它的作用就是：

- 把后端接口展示成能操作的页面
- 让老师和队友能一眼看懂系统在干什么

## 当前技术栈

- `Vue 3`
- `Vite`
- `Element Plus`
- `UnoCSS`
- `Axios`
- `Vue Router`

## 现在已经有的页面

- `/login`
- `/employees`
- `/departments`
- `/leaves`
- `/profile`

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

## 前端怎么连后端

现在已经配置好了代理：

- `/api` -> `http://127.0.0.1:18080`

所以开发时前端直接请求 `/api/...` 就行，不用自己折腾跨域。

## 接口说明看哪里

统一看：

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
