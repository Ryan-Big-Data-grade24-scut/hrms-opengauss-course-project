# Frontend

## Stack

- `Vue 3`
- `Vite`
- `Element Plus`
- `UnoCSS`
- `Axios`
- `Vue Router`

## Purpose

The frontend is a lightweight admin console for demoing the HR system.

Current pages:

- `/login`
- `/employees`
- `/departments`
- `/leaves`
- `/profile`

## How to run

Make sure the backend is already running on:

- `http://127.0.0.1:18080`

Then run:

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB\frontend
npm install
npm run dev
```

Frontend address:

- `http://127.0.0.1:5173`

## API behavior

Vite already proxies:

- `/api` -> `http://127.0.0.1:18080`

So frontend code can call `/api/...` directly during development.

## Contract source

The shared API definition is:

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
