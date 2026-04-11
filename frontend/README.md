# Frontend

当前前端采用：

- `Vue 3`
- `Vite`
- `Element Plus`
- `UnoCSS`
- `Axios`
- `Vue Router`

目标是：

- 全程支持 CLI 启动
- 快速做出管理系统风格页面
- 直接对接当前后端接口

## 启动方式

先确保后端已启动在：

```text
http://127.0.0.1:8080
```

然后执行：

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB\frontend
npm install
npm run dev
```

默认前端开发地址：

```text
http://127.0.0.1:5173
```

Vite 已经配置了代理：

- `/api` -> `http://127.0.0.1:8080`

所以前端请求后端时不需要手动改跨域。

## 当前页面

- `/login`
- `/employees`
- `/departments`
- `/leaves`
- `/profile`

## 演示账号

- `admin / 123456`
