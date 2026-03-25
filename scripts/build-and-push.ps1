param(
  [string]$CommitMessage = "auto: build & push",
  [switch]$SkipBuild,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$ROOT = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ROOT

function Assert-NotSensitiveChanges {
  $status = git status --porcelain
  if (-not $status) { return }

  $sensitivePatterns = @(
    '\.env($|[.-])',
    '\.env\.local',
    '\.env\.production',
    '\.env\.development',
    '\.env\.test',
    'node_modules',
    '\.next',
    '\.DS_Store'
  )

  foreach ($line in $status -split "`n") {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $path = ($line -split '\s+', 3)[2]
    if (-not $path) { continue }

    # Les fichiers de template ne sont pas des secrets (ex: `.env.local.example`).
    if ($path -like '*.example') {
      continue
    }
    foreach ($pat in $sensitivePatterns) {
      if ($path -match $pat) {
        throw "Script aborted: sensitive/artefact file detected in git status: $path"
      }
    }
  }
}

function HasUncommittedChanges {
  return -not (git diff --quiet --ignore-submodules --) -or (git status --porcelain | Out-String).Trim().Length -gt 0
}

Write-Host "=== Build & Push ==="
Write-Host "Root: $ROOT"

Assert-NotSensitiveChanges

if (-not $SkipBuild) {
  Write-Host "`n[1/4] Running build..."
  # Build Next (monorepo: build command exists in root package.json)
  npm run build:next
}

if (-not (HasUncommittedChanges)) {
  Write-Host "`n[2/4] No changes detected. Nothing to commit/push."
  exit 0
}

Write-Host "`n[2/4] Staging changes..."
git add -A

Write-Host "`n[3/4] Committing..."
# Commit only if there is something staged
$staged = git diff --cached --quiet
if ($staged -eq $true) {
  Write-Host "No staged changes. Exiting."
  exit 0
}

git commit -m $CommitMessage

if ($NoPush) {
  Write-Host "`n[4/4] Push skipped (--NoPush)."
  exit 0
}

$branch = git rev-parse --abbrev-ref HEAD
Write-Host "`n[4/4] Pushing to origin/$branch ..."
git push origin "HEAD:$branch"

Write-Host "`nDone."

