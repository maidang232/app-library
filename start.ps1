$ErrorActionPreference='Stop'
$env:ADMIN_PASSWORD = if ($env:ADMIN_PASSWORD) {$env:ADMIN_PASSWORD} else {'admin123456'}
Set-Location $PSScriptRoot
Write-Host "管理员密码: $env:ADMIN_PASSWORD"
Write-Host '请在浏览器打开 http://localhost:8787/admin'
Start-Process 'http://localhost:8787/admin'
node server.mjs
