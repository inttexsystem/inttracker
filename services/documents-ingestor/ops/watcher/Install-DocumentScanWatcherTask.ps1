[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$TaskName = 'Ravatex-DocumentScanWatcher-Staging'
$StartScript = (Resolve-Path (Join-Path $PSScriptRoot 'Start-DocumentScanWatcher.ps1')).Path
$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source

$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:UserName
$Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Starts the single staging Gmail document scan watcher at user logon.' -Force | Out-Null
Write-Output "Scheduled task '$TaskName' installed or updated."
