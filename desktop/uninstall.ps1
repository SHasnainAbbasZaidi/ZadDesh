$ErrorActionPreference = 'Stop'
$registry = 'HKCU:\Software\Classes\zaddesh'
if (Test-Path -LiteralPath $registry) { Remove-Item -LiteralPath $registry -Recurse -Force }
Write-Output 'ZadDesh protocol registration removed. Project files retained.'
