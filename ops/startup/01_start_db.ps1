$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
& (Join-Path $RepoRoot "ops\db\start_opengauss.ps1")
& (Join-Path $RepoRoot "ops\db\init_hrms.ps1")
& (Join-Path $RepoRoot "ops\db\verify_hrms.ps1")
