$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
if (-not (Get-Command javac -ErrorAction SilentlyContinue)) {
    throw 'Java JDK 17 or newer is required to build. Install a JDK and add its bin folder to PATH.'
}
$driverPath = & (Join-Path $PSScriptRoot 'bootstrap.ps1')
$classDir = Join-Path $PSScriptRoot 'build/classes'
New-Item -ItemType Directory -Force -Path $classDir | Out-Null
$javaFiles = Get-ChildItem -LiteralPath 'src\main\java\guidance' -Filter '*.java' | Select-Object -ExpandProperty FullName
& javac -encoding UTF-8 --release 17 --add-modules jdk.httpserver -cp $driverPath -d $classDir $javaFiles
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed.' }
Copy-Item -Path 'src\main\resources\*' -Destination $classDir -Recurse -Force
$driverName = Split-Path -Leaf $driverPath
$manifest = "Manifest-Version: 1.0`nMain-Class: guidance.Main`nClass-Path: lib/$driverName`n`n"
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'build\MANIFEST.MF'), $manifest, [System.Text.UTF8Encoding]::new($false))
& jar --create --file 'guidancedesk.jar' --manifest 'build\MANIFEST.MF' -C $classDir .
if ($LASTEXITCODE -ne 0) { throw 'JAR packaging failed.' }
Write-Output 'Built guidancedesk.jar for Java 17. Run Start GuidanceDesk.cmd to open the app.'
} finally { Pop-Location }
