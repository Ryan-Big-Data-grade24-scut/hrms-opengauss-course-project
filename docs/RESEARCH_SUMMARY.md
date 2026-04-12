# Research Summary

## Why this repository looks the way it does

We researched three things:

1. course constraints
2. HR database modeling references
3. practical engineering patterns for a small multi-person team

## Course-level conclusion

The hard requirement is to build on `openGauss`.

What we did not find in the formal course requirement:

- no clear statement that deployment must be on Huawei Cloud

So the practical strategy is:

- develop locally with Docker + openGauss
- keep cloud deployment as an optional shared runtime

Raw course files are kept in:

- [docs/course_requirements](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/course_requirements)

## HR database modeling conclusion

A toy HR schema is not enough. Mature HR systems usually include:

- organization structures
- job catalogs
- employee profile extensions
- job history
- leave types and leave workflow

That is why our next-generation schema includes:

- `location`
- `job`
- `employee_profile`
- `employee_job_history`
- `leave_type`

Reference assets are archived in:

- [docs/research/docs](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/research/docs)
- [docs/research/repos](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/research/repos)

## Engineering conclusion

For this project scale, the useful engineering baseline is:

- git manages code
- migrations manage DB structure
- backup/restore manages DB data
- CLI scripts manage startup and release
- OpenAPI manages the API contract

This is enough to support:

- teamwork
- AI-assisted development
- local development
- later migration to a cloud VM

## Why backup is kept minimal

Backup is not the main business module.

We keep only:

- backup script
- restore script
- reserved backend endpoints
- documentation

That gives us enough for:

- demos
- migration
- recovery drills

without turning the project into a full backup product.

## What research remains useful

The raw downloaded assets are intentionally still kept.

They are not the first docs teammates should read, but they are useful when someone needs:

- source references
- example repos
- official `openGauss` docs
- modeling inspiration

## Recommended reading order

1. [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
2. [master/PROJECT_BRIEF.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/PROJECT_BRIEF.md)
3. [master/contracts/openapi.yaml](/e:/Ufolder/Current/ActionSys/Hgclass/DB/master/contracts/openapi.yaml)
4. raw assets only if deeper context is needed
