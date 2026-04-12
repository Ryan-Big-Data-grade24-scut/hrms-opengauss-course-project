# Deploy

This directory is the lightweight deployment base for the project.

It is not a full CI/CD system.
Its job is much simpler:

- keep environment templates
- support release bundle packaging
- make later cloud migration easier

## What lives here

- `env/backend.env.example`
- `env/frontend.env.example`

These files are templates for runtime configuration.

## Related scripts

- [ops/deploy/build_release_bundle.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/deploy/build_release_bundle.ps1)
- [ops/db/backup_hrms.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/backup_hrms.ps1)
- [ops/db/restore_hrms.ps1](/e:/Ufolder/Current/ActionSys/Hgclass/DB/ops/db/restore_hrms.ps1)

## What this is used for

Typical flow:

1. build frontend assets
2. prepare backend code and scripts
3. package a release bundle
4. copy the bundle to another machine or cloud VM
5. restore database data if needed
6. start services there

For the full operator view, read:

- [docs/HANDBOOK.md](/e:/Ufolder/Current/ActionSys/Hgclass/DB/docs/HANDBOOK.md)
