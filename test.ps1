param([string]$ScratchDirectory = (Join-Path $PSScriptRoot 'build\test-data'))
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
if (-not (Test-Path -LiteralPath $ScratchDirectory)) { New-Item -ItemType Directory -Path $ScratchDirectory -Force | Out-Null }
$testClasses = Join-Path $PSScriptRoot 'build\test-classes'
New-Item -ItemType Directory -Force -Path $testClasses | Out-Null
$separator = [IO.Path]::PathSeparator
$driverPath = & (Join-Path $PSScriptRoot 'bootstrap.ps1') -Offline
$classPath = (Join-Path $PSScriptRoot 'guidancedesk.jar') + $separator + $driverPath
& javac -encoding UTF-8 --release 17 -cp $classPath -d $testClasses (Join-Path $PSScriptRoot 'src\test\java\guidance\DatabaseTest.java')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& java --add-modules jdk.httpserver -cp ($classPath + $separator + $testClasses) guidance.DatabaseTest $ScratchDirectory
if ($LASTEXITCODE -ne 0) { throw 'Integration checks failed.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ is required for the HTTP security tests (the app itself only needs Java).' }
$previousScratch = $env:GUIDANCEDESK_TEST_DIR
try {
    $env:GUIDANCEDESK_TEST_DIR = $ScratchDirectory
    & node (Join-Path $PSScriptRoot 'scripts/security-test.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'HTTP security checks failed.' }
} finally { $env:GUIDANCEDESK_TEST_DIR = $previousScratch }
