param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path -LiteralPath 'node_modules')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed.' } }
if (!(Test-Path -LiteralPath 'dist/index.html')) { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } }
$taskHealthy = $false
try { $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4310/api/health' -TimeoutSec 2; $taskHealthy = $taskHealth.app -eq 'AI Survival Society' } catch {}
if (!$taskHealthy) {
    New-Item -ItemType Directory -Force -Path '.runtime' | Out-Null
    $taskNode = (Get-Command node).Source
    # WMI creates the launcher outside the caller's process/job tree. This keeps the
    # service alive when a Codex terminal session is cleaned up after its turn.
    $taskStartup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
    $taskCommand = '"' + $env:ComSpec + '" /d /s /c ""' + $taskNode + '" "server/index.mjs" >> ".runtime/server.out.log" 2>> ".runtime/server.err.log""'
    $taskLaunch = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $taskCommand; CurrentDirectory = $PSScriptRoot; ProcessStartupInformation = $taskStartup }
    if ($taskLaunch.ReturnValue -ne 0) { throw "Independent service launch failed (Windows code $($taskLaunch.ReturnValue))." }
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4310/api/health' -TimeoutSec 1
            $taskServer = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($taskLaunch.ProcessId) AND Name='node.exe'"
            if ($taskHealth.app -eq 'AI Survival Society' -and $taskServer) {
                Set-Content -LiteralPath '.runtime/server.pid' -Value $taskServer.ProcessId
                $taskHealthy = $true
                break
            }
        } catch {}
    }
    if (!$taskHealthy) { throw 'Server failed to start. Inspect .runtime/server.err.log (port 4310 may be occupied).' }
}
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:4310' }
Write-Output 'AI Survival Society is running at http://127.0.0.1:4310'
