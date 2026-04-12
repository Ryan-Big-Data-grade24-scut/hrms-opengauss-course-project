# DB Course Project AGENT

## Purpose

This repository should stay:

- easy for teammates to read
- easy for AI agents to understand
- CLI-first for startup, testing, backup, restore, and release

The goal is not to accumulate planning files. The goal is to keep one clear working base.

## Documentation policy

### `docs/`

Only keep:

- one main handbook
- one research summary
- raw course files
- raw project input files
- archived reference material

The primary human entry point is:

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)

### `master/`

Only keep:

- one project brief
- shared contracts

The primary planning and implementation entry points are:

- [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
- [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)

Avoid creating scattered plan documents again unless there is a very strong reason.

## Engineering policy

1. Course requirements take precedence over guesses or chat history.
2. `openGauss` is the database base.
3. `sql/migrations/` is the authoritative schema evolution path.
4. `ops/` is the authoritative CLI operations path.
5. `openapi.yaml` is the authoritative shared API contract.
6. Keep runtime-safe placeholders if a route is planned but not yet implemented.
7. New docs should usually merge into existing handbook/brief files instead of spawning new files.

## Repository map

- `docs/`
  - human-facing docs and raw assets
- `master/`
  - project brief and contracts
- `ops/`
  - startup, DB, backend, deploy scripts
- `sql/`
  - migrations and SQL assets
- `backend/`
  - backend implementation
- `frontend/`
  - frontend implementation
- `deploy/`
  - deployment templates and release base

## Safety rules

- Do not run global `wsl --shutdown` just to fix Docker.
- Treat `WSL` as a sensitive runtime surface.
- Only stop or reset WSL if the user clearly allows it or it is confirmed safe.

## Workflow rules

- Prefer CLI over manual GUI steps.
- Prefer scripts over repeated manual commands.
- If a document becomes obsolete, consolidate its content into the main handbook or project brief and then remove it.
- Keep teammate comprehension and AI comprehension as first-class goals.
