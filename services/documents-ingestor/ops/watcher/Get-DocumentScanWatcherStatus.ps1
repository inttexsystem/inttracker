[CmdletBinding()]
param()

$TaskName = 'Ravatex-DocumentScanWatcher-Staging'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$DatabasePath = Join-Path $ProjectRoot 'data\app.db'
$EnvPath = Join-Path $ProjectRoot '.env'
if (Test-Path -LiteralPath $EnvPath) {
  $DbLine = Get-Content -LiteralPath $EnvPath | Where-Object { $_ -match '^\s*DATABASE_PATH\s*=' } | Select-Object -First 1
  if ($DbLine) {
    $Configured = ($DbLine -split '=', 2)[1].Trim()
    $DatabasePath = if ([IO.Path]::IsPathRooted($Configured)) { $Configured } else { Join-Path $ProjectRoot $Configured }
  }
}
$LockPath = Join-Path (Split-Path -Parent $DatabasePath) '.watch-scan-requests-gmail.lock'
$LockPid = $null
if (Test-Path -LiteralPath $LockPath) {
  try { $LockPid = (Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json).pid } catch { $LockPid = $null }
}
$Worker = if ($LockPid) { Get-Process -Id $LockPid -ErrorAction SilentlyContinue } else { $null }
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

[pscustomobject]@{
  task_name = $TaskName
  task_state = if ($Task) { [string]$Task.State } else { 'not_installed' }
  task_enabled = if ($Task) { [bool]$Task.Settings.Enabled } else { $false }
  task_uses_start_script = if ($Task) { [bool](($Task.Actions | Select-Object -First 1).Arguments -match 'Start-DocumentScanWatcher\.ps1') } else { $false }
  watcher_instances = if ($Worker) { 1 } else { 0 }
  worker_pid = if ($Worker) { $Worker.Id } else { $null }
  lock_present = Test-Path -LiteralPath $LockPath
  duplicate_prevention = 'Task Scheduler IgnoreNew + source-scoped CLI lock'
}
