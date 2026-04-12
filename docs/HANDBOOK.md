# Project Handbook

## This repository in one sentence

This is a course project workspace for an `openGauss`-based HR management system with:

- a persistent database
- a runnable Python backend API
- a runnable Vue frontend
- CLI-first startup, testing, backup, restore, and release scripts

If a teammate only reads one document, read this one first.

## What already exists

### Database

- Database name: `hrms`
- Runtime: `openGauss` in Docker
- Persistence: named volume `opengauss-hrms-data`
- Schema is versioned through `sql/migrations/`
- Current migrations:
  - `V1__baseline.sql`
  - `V2__org_and_job.sql`
  - `V3__employee_profile_and_history.sql`
  - `V4__leave_type_and_leave_upgrade.sql`

The current schema already includes:

- auth and RBAC tables
- department / position / employee
- location / job
- employee profile
- employee job history
- leave type / leave request
- audit log

### Backend

Backend entry:

- [backend/app.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/app.py)
- [backend/src/server.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py)

Already implemented modules:

- auth
- users and roles
- departments
- positions
- employees
- leaves
- audits
- backup/restore placeholders

### Frontend

Frontend entry:

- [frontend/src/main.js](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/main.js)
- [frontend/src/router/index.js](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/router/index.js)

Current pages:

- login
- employees
- departments
- leaves
- profile

### Contracts and release

- Shared API contract: [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
- Release bundle builder: [ops/deploy/build_release_bundle.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/deploy/build_release_bundle.ps1)

## Folder guide

### `docs/`

Only keep human-facing docs and raw input assets here.

- `HANDBOOK.md`: the main manual
- `RESEARCH_SUMMARY.md`: what we researched and what we decided
- `course_requirements/`: official course files
- `course_materials/project_inputs/`: group-provided raw materials
- `research/docs/`: downloaded reference pages
- `research/repos/`: downloaded reference repos

### `master/`

Only keep the current project brief and shared contracts here.

- `PROJECT_BRIEF.md`: plain-language current state, architecture, next steps
- `contracts/openapi.yaml`: the API contract

### `sql/`

- `migrations/`: versioned schema changes
- legacy SQL files may still exist for reference, but migrations are authoritative

### `ops/`

CLI-first operational scripts.

- `startup/`: start Docker, DB, backend, frontend
- `db/`: init, migrate, verify, backup, restore
- `backend/`: backend start and smoke test
- `deploy/`: release bundle build

## Architecture in plain language

The stack has 4 practical layers:

1. Database layer
   - `openGauss`
   - stores HR data
   - evolves through migrations

2. API layer
   - Python backend
   - exposes `/api/...`
   - handles auth, validation, DB calls, audit writes

3. UI layer
   - Vue 3 frontend
   - calls backend APIs
   - gives a usable demo interface

4. Operations layer
   - PowerShell scripts
   - starts services
   - verifies the stack
   - backs up data
   - builds a release bundle

## How to start the project

Run everything from the repository root.

### One-command startup

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\start_stack.ps1
```

What this does:

1. starts Docker Desktop if needed
2. starts or creates the `openGauss` container
3. ensures `hrms` exists and applies migrations
4. starts the backend on `http://127.0.0.1:18080`
5. starts the frontend on `http://127.0.0.1:5173`

### Step-by-step startup

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\startup\00_start_docker.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\01_start_db.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\02_start_backend.ps1
powershell -ExecutionPolicy Bypass -File .\ops\startup\03_start_frontend.ps1
```

What each step means:

- `00_start_docker.ps1`
  - makes sure Docker Desktop and its engine are alive
- `01_start_db.ps1`
  - prepares the `openGauss` container and applies migrations
- `02_start_backend.ps1`
  - launches the Python API server
- `03_start_frontend.ps1`
  - launches the Vite frontend dev server

## How to test the project

### 1. Verify the database

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\verify_hrms.ps1
```

This checks that:

- the DB is reachable
- core tables exist
- seed data still exists

### 2. Smoke test the backend

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\backend\smoke_test.ps1
```

This script:

1. logs in as `admin`
2. gets a token
3. requests employee data
4. requests department data
5. requests leave data

If it passes, the backend and DB are talking correctly.

### 3. Manual DB inspection

```powershell
docker exec -e LD_LIBRARY_PATH=/usr/local/opengauss/lib -it opengauss-hrms /usr/local/opengauss/bin/gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W OpenGauss123!
```

Inside `gsql`, useful commands:

```sql
\dt
select version, filename, applied_at from schema_migration_history order by applied_at;
select employee_no, full_name, employment_status from employee;
\q
```

What this means:

- `\dt`: list tables
- `schema_migration_history`: show which migrations ran
- employee query: quick business-data sanity check

## Backup and restore

### Backup

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\backup_hrms.ps1
```

This exports the current database to `backups/`.

### Restore

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\db\restore_hrms.ps1 -BackupFile .\backups\your_backup.sql
```

Important behavior:

- restore clears the `public` schema first
- then replays the backup SQL
- this avoids "table already exists" errors

## Release bundle

```powershell
cd E:\Ufolder\Current\ActionSys\Hgclass\DB
powershell -ExecutionPolicy Bypass -File .\ops\deploy\build_release_bundle.ps1
```

This builds `dist/release_bundle`, which is a deployment package, not a development workspace.

## Accounts and default addresses

- backend: `http://127.0.0.1:18080`
- frontend: `http://127.0.0.1:5173`
- demo account: `admin / 123456`
- DB user: `omm / OpenGauss123!`

## What to read next

- For current project status and next tasks:
  - [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
- For API definitions:
  - [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
- For backend details:
  - [backend/README.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/README.md)
- For frontend details:
  - [frontend/README.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/README.md)
