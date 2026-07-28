[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

# INTTRACKER-PRODUCTION-CUTOVER-R1: ucrjtfswnfdlxwtmxnoo is the DEFINITIVE
# production project and the only sanctioned writer target. gqmpsxkxynrjvidfmojk
# is RETIRED from every runtime role (not production, not staging, not
# development, not a fallback) and bhgifjrfagkzubpyqpew is PROHIBITED. Starting
# this watcher is a PRODUCTION WRITE operation.
$ExpectedProjectRef = 'ucrjtfswnfdlxwtmxnoo'
$EnvPath = Join-Path $ProjectRoot '.env'

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "Missing .env in $ProjectRoot. The watcher will not start without its local configuration."
}

$ProjectRefLines = @(Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*SUPABASE_PROJECT_REF\s*=' })
if ($ProjectRefLines.Count -ne 1) {
  throw 'Refusing to start: .env must declare SUPABASE_PROJECT_REF exactly once.'
}
$ProjectRef = ($ProjectRefLines[0] -split '=', 2)[1].Trim()
if ($ProjectRef -cne $ExpectedProjectRef) {
  throw 'Refusing to start: SUPABASE_PROJECT_REF is not the authorized production project ucrjtfswnfdlxwtmxnoo. There is no fallback target.'
}

$Existing = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -match 'watch:scan-requests' -and $_.CommandLine -match '--source\s+gmail'
}
if ($Existing) {
  Write-Output 'Document scan watcher is already running; no second process was started.'
  exit 0
}

$Arguments = @(
  'run', 'watch:scan-requests', '--', '--source', 'gmail', '--poll-seconds', '5', '--no-once',
  '--recover-stale', '--confirm-real-google', '--confirm-supabase-write'
)
$Process = Start-Process -FilePath 'npm.cmd' -ArgumentList $Arguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
Write-Output "Document scan watcher started (pid=$($Process.Id))."
