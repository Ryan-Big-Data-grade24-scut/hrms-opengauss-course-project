$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
& (Join-Path $RepoRoot "ops\backend\start_backend.ps1")
