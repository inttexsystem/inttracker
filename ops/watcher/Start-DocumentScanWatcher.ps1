[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ExpectedProjectRef = 'ucrjtfswnfdlxwtmxnoo'
$EnvPath = Join-Path $ProjectRoot '.env'

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "Missing .env in $ProjectRoot. The watcher will not start without its local configuration."
}

$ProjectRefLine = Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*SUPABASE_PROJECT_REF\s*=' } | Select-Object -First 1
$ProjectRef = if ($ProjectRefLine) { ($ProjectRefLine -split '=', 2)[1].Trim() } else { '' }
if ($ProjectRef -ne $ExpectedProjectRef) {
  throw 'Refusing to start: SUPABASE_PROJECT_REF is not the authorized staging project.'
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
