[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$TaskName = 'Ravatex-DocumentScanWatcher-Staging'
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task -and $Task.State -eq 'Running') { Stop-ScheduledTask -TaskName $TaskName }

$Processes = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -match 'watch:scan-requests' -and $_.CommandLine -match '--source\s+gmail'
}
foreach ($Process in $Processes) {
  Stop-Process -Id $Process.ProcessId -ErrorAction Stop
}
Write-Output 'Document scan watcher stopped.'
