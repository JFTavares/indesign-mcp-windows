param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [string]$ProgId = 'InDesign.Application'
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$application = $null
try {
    if ($ProgId -notmatch '^InDesign\.Application(?:\.\d+)?$') {
        throw 'Invalid InDesign ProgID.'
    }
    $source = [System.IO.File]::ReadAllText($ScriptPath, [System.Text.Encoding]::UTF8)
    try {
        $application = [System.Runtime.InteropServices.Marshal]::GetActiveObject($ProgId)
    } catch {
        $application = New-Object -ComObject $ProgId
    }
    # Adobe ScriptLanguage.JAVASCRIPT. DoScript receives source, not a shell command.
    $null = $application.DoScript($source, 1246973031)
} catch {
    [Console]::Error.WriteLine('COM automation failed: ' + $_.Exception.Message + ' Open InDesign, dismiss dialogs, and run the MCP under the same Windows user and elevation level.')
    exit 1
} finally {
    if ($null -ne $application -and [System.Runtime.InteropServices.Marshal]::IsComObject($application)) {
        $null = [System.Runtime.InteropServices.Marshal]::ReleaseComObject($application)
    }
}
