$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (Test-Path -LiteralPath '.runtime/server.pid') {
    $taskPid = [int](Get-Content -LiteralPath '.runtime/server.pid')
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid" -ErrorAction SilentlyContinue
    if ($taskProcess -and $taskProcess.Name -eq 'node.exe' -and $taskProcess.CommandLine -match 'server/index.mjs') {
        try { Invoke-RestMethod -Uri 'http://localhost:4310/api/save' -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 10 | Out-Null } catch {}
        Stop-Process -Id $taskPid -ErrorAction SilentlyContinue
        Write-Output 'Society stopped. The latest snapshot was saved.'
    }
    Remove-Item -LiteralPath '.runtime/server.pid' -ErrorAction SilentlyContinue
} else { Write-Output 'No launcher-managed Society process found.' }
