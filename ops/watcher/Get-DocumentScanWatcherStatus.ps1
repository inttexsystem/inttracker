[CmdletBinding()]
param()

$TaskName = 'Ravatex-DocumentScanWatcher-Staging'
$Processes = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -match 'watch:scan-requests' -and $_.CommandLine -match '--source\s+gmail'
} | Select-Object ProcessId, Name, CommandLine
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

[pscustomobject]@{
  task_name = $TaskName
  task_state = if ($Task) { [string]$Task.State } else { 'not_installed' }
  watcher_processes = @($Processes).Count
  duplicate_prevention = 'Task Scheduler IgnoreNew + source-scoped CLI lock'
}
