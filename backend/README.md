# Backend

## What this backend is

This is a lightweight Python HTTP backend for the HR project.

It is intentionally simple:

- Python standard library server
- direct DB access through `docker exec + gsql`
- in-process bearer token auth

The goal is to keep it easy to run and easy to extend during the course project.

## Key files

- [app.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/app.py): process entry
- [src/server.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py): route registration and HTTP handling
- [src/common](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/common): shared helpers
- [src/services](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/services): business modules

## Implemented runtime modules

- auth
- users and roles
- departments
- positions
- employees
- leaves
- audits

## Planned modules already frozen in the contract

See:

- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

Planned but not fully implemented:

- locations
- jobs
- leave types
- employee profile
- employee job history

## How to run

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\start_backend.ps1
```

Default address:

- `http://127.0.0.1:18080`

## How to smoke test

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

This verifies:

- login
- employee list
- department list
- leave list
