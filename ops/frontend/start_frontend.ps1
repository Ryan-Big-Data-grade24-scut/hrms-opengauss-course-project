$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$FrontendRoot = Join-Path $RepoRoot "frontend"
Set-Location $FrontendRoot
npm run dev
