$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$output = Join-Path $PSScriptRoot 'ZadDeshLauncher.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/out:$output" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
$registry = 'HKCU:\Software\Classes\zaddesh'
New-Item -Path $registry -Force | Out-Null
Set-Item -LiteralPath $registry -Value 'URL:ZadDesh Launcher'
New-ItemProperty -Path $registry -Name 'URL Protocol' -Value '' -Force | Out-Null
New-Item -Path "$registry\shell\open\command" -Force | Out-Null
Set-Item -LiteralPath "$registry\shell\open\command" -Value ('"' + $output + '" "%1"')
Write-Output 'ZadDesh launcher registered for this Windows user. Keep this folder in place.'
