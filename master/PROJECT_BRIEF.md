# Project Brief

## Goal

Build a course-ready HR management system on `openGauss` that is:

- understandable to teammates
- friendly to AI-assisted development
- runnable from CLI
- easy to extend without breaking the base

## Current state

### Already implemented

- persistent `openGauss` database in Docker
- versioned migrations
- backup and restore scripts
- Python backend with working APIs
- Vue frontend with working demo pages
- release bundle builder
- first OpenAPI contract draft

### Backend features that already run

- auth login/profile/logout
- user CRUD
- role list and role assignment
- department CRUD
- position CRUD
- employee CRUD and list/detail
- leave list/create/approve/reject
- audit list

### Contract-first planned resources

These are already defined in `openapi.yaml` but not fully implemented yet:

- locations
- jobs
- leave types
- employee profile
- employee job history
- some missing detail endpoints

## Architecture

### Database

- authoritative schema location:
  - [sql/migrations](/e:/Ufolder/Current/ActionSys/Hgclass/DB/sql/migrations)
- migration runner:
  - [ops/db/apply_migrations.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/apply_migrations.ps1)

### Backend

- HTTP entry:
  - [backend/app.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/app.py)
- routing:
  - [backend/src/server.py](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/server.py)
- business modules:
  - [backend/src/services](/e:/Ufolder/Current/ActionSys/Hgclass/DB/backend/src/services)

### Frontend

- router:
  - [frontend/src/router/index.js](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/router/index.js)
- views:
  - [frontend/src/views](/e:/Ufolder/Current/ActionSys/Hgclass/DB/frontend/src/views)

### Operations

- startup:
  - [ops/startup](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/startup)
- DB scripts:
  - [ops/db](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db)
- backend test:
  - [ops/backend/smoke_test.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/backend/smoke_test.ps1)
- release bundle:
  - [ops/deploy/build_release_bundle.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/deploy/build_release_bundle.ps1)

## Team-facing module split

### Infrastructure and API owner

Should own:

- schema evolution
- migrations
- OpenAPI contract
- DB scripts
- shared backend API patterns

This role should not keep owning every business feature forever.
Its job is to make the base stable so others can build on top.

### Business backend contributors

Should own concrete modules after the contract is frozen:

- employee extensions
- leave workflow
- job and location resources
- profile and history resources

### Frontend contributors

Should build against `openapi.yaml` and current implemented endpoints, then add support for newly implemented resources.

## What teammates should do next

### Highest priority

1. implement planned backend resources from the OpenAPI contract
2. extend frontend pages to match the upgraded HR model
3. enrich seed data and demo workflows

### Practical next backend slices

- `locations`
- `jobs`
- `leave-types`
- `employee profile`
- `employee job history`

### Practical next frontend slices

- organization management page
- leave approval actions
- audit page
- forms for richer employee data

## Rules for future changes

1. New API resources must be added to `openapi.yaml` first.
2. DB structure changes must go into `sql/migrations/`.
3. Startup, backup, restore, and release changes must go through `ops/`.
4. Avoid creating scattered planning docs again. Keep current state here unless a document truly needs to exist on its own.

## The two most important files after this one

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
