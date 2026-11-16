param([switch]$Blank)
$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Java 17 or newer is required.' }
    $null = & (Join-Path $PSScriptRoot 'bootstrap.ps1')
    $jarPath = Join-Path $PSScriptRoot 'guidancedesk.jar'
    $needsBuild = -not (Test-Path -LiteralPath $jarPath)
    if (-not $needsBuild) {
        $jarDate = (Get-Item -LiteralPath $jarPath).LastWriteTimeUtc
        $needsBuild = @((Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src/main') -File -Recurse) | Where-Object { $_.LastWriteTimeUtc -gt $jarDate }).Count -gt 0
    }
    if ($needsBuild) { & (Join-Path $PSScriptRoot 'build.ps1') }
    $arguments = @('--add-modules','jdk.httpserver','-jar',$jarPath,'--open-browser')
    if ($Blank) { $arguments += @('--data','data-blank','--empty','--port','8788') }
    & java @arguments
    if ($LASTEXITCODE -ne 0) { throw 'The app could not start. Review the message above.' }
} finally { Pop-Location }
