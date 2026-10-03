$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$taskBlender = if ($env:BLENDER_PATH) { $env:BLENDER_PATH } else { 'C:\Program Files\Blender Foundation\Blender 3.1\blender.exe' }
if (!(Test-Path -LiteralPath $taskBlender)) { throw 'Set BLENDER_PATH to your blender.exe path.' }
& $taskBlender --background --python 'Art/Blender/generate_assets.py'
if ($LASTEXITCODE -ne 0) { throw 'Asset generation failed.' }
& $taskBlender --background --python 'Art/Blender/generate_world_assets.py'
if ($LASTEXITCODE -ne 0) { throw 'Physical world asset generation failed.' }
& $taskBlender --background --python 'Art/Blender/generate_collision_data.py'
if ($LASTEXITCODE -ne 0) { throw 'Authoritative collision export failed.' }
