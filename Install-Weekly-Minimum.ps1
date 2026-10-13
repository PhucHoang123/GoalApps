$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Weekly Minimum.exe'
if (-not (Test-Path -LiteralPath $source)) { throw 'Keep this script beside Weekly Minimum.exe.' }
$destination = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\Weekly Minimum'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$executable = Join-Path $destination 'Weekly Minimum.exe'
Copy-Item -LiteralPath $source -Destination $executable -Force
$shell = New-Object -ComObject WScript.Shell
$programs = [Environment]::GetFolderPath('Programs')
$shortcut = $shell.CreateShortcut((Join-Path $programs 'Weekly Minimum.lnk'))
$shortcut.TargetPath = $executable
$shortcut.WorkingDirectory = $destination
$shortcut.IconLocation = "$executable,0"
$shortcut.Save()
Write-Host "Installed Weekly Minimum to $destination. Open it from the Start menu."
Write-Host 'Requires Microsoft Edge WebView2 (included with Windows 11).'
Write-Host 'To uninstall, remove that application folder and the Weekly Minimum Start menu shortcut. Your goal data is kept separately.'
