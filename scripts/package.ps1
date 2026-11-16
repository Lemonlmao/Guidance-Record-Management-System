param(
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'build/releases'),
    [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$sourceRoot = Join-Path $outputRoot 'GuidanceDesk-GitHub'
if (Test-Path -LiteralPath $sourceRoot) { throw 'The clean source folder already exists. Choose a new output directory to preserve it.' }
if (-not $SkipBuild) { & (Join-Path $projectRoot 'build.ps1') }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'guidancedesk.jar'))) { throw 'Build the app before packaging.' }
$driver = & (Join-Path $projectRoot 'bootstrap.ps1') -Offline
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
$items = @('src','scripts','docs','.github','.gitignore','.gitattributes','.editorconfig','README.md','LICENSE','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md','THIRD-PARTY-NOTICES.txt','pom.xml','dependencies.lock.json','bootstrap.ps1','build.ps1','test.ps1','start.ps1','Start GuidanceDesk.cmd','Start blank workspace.cmd','lib/H2-LICENSE.txt')
$files = @()
foreach ($item in $items) {
    $original = Join-Path $projectRoot $item
    if (-not (Test-Path -LiteralPath $original)) { throw "Required source item is missing: $item" }
    $candidates = if ((Get-Item -LiteralPath $original).PSIsContainer) { Get-ChildItem -LiteralPath $original -Recurse -File } else { Get-Item -LiteralPath $original }
    foreach ($candidate in $candidates) {
        if ($candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked files are not allowed in a release.' }
        $relative = [IO.Path]::GetRelativePath($projectRoot,$candidate.FullName)
        if ($relative.StartsWith('..') -or [IO.Path]::IsPathRooted($relative)) { throw 'A source file is outside the project.' }
        $destination = Join-Path $sourceRoot $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $candidate.FullName -Destination $destination
        $files += [pscustomobject]@{Relative=$relative;Path=$destination}
    }
}
& node (Join-Path $sourceRoot 'scripts/check-repository.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Clean source verification failed.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Write-ReleaseZip([string]$Name,[object[]]$Entries) {
    $target = Join-Path $outputRoot $Name
    $temporary = Join-Path $outputRoot ([guid]::NewGuid().ToString('N') + '.zip')
    $zip = [IO.Compression.ZipFile]::Open($temporary,[IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($entry in $Entries) {
            $archiveName = 'GuidanceDesk/' + $entry.Relative.Replace('\','/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$entry.Path,$archiveName,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $zip.Dispose() }
    if (-not ([IO.Path]::GetFullPath($target).StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))) { throw 'Invalid release destination.' }
    Move-Item -LiteralPath $temporary -Destination $target -Force
    Write-Output $target
}
$sourceZip = Write-ReleaseZip 'GuidanceDesk-GitHub-ready.zip' $files
$runtimeFiles = $files + @([pscustomobject]@{Relative='guidancedesk.jar';Path=(Join-Path $projectRoot 'guidancedesk.jar')},[pscustomobject]@{Relative=('lib/' + (Split-Path -Leaf $driver));Path=$driver})
$runtimeZip = Write-ReleaseZip 'GuidanceDesk.zip' $runtimeFiles
$lines = foreach ($archive in @($sourceZip,$runtimeZip)) { (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + (Split-Path -Leaf $archive) }
[IO.File]::WriteAllLines((Join-Path $outputRoot 'GuidanceDesk-SHA256.txt'),$lines,[Text.UTF8Encoding]::new($false))
Write-Output "Created source and runnable ZIPs from $($files.Count) source files. No working data, accounts, or keys were copied."
