$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $null = Get-Command node.exe -ErrorAction Stop
    $null = Get-Command npm.cmd -ErrorAction Stop
    & npm.cmd ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    & node.exe scripts/configure.js
    if ($LASTEXITCODE -ne 0) { throw 'Configuration generation failed' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
    Write-Host 'Ready. Read README.md and use the files in config/ to connect your MCP client.'
} finally {
    Pop-Location
}
