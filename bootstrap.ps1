param([switch]$Offline)
$ErrorActionPreference = 'Stop'
$dependency = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'dependencies.lock.json') -Raw | ConvertFrom-Json).h2
if ($dependency.version -notmatch '^\d+\.\d+\.\d+$' -or $dependency.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid dependency lock file.' }
[xml]$pom = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pom.xml') -Raw
if ($pom.project.properties.'h2.version' -ne $dependency.version) { throw 'pom.xml and dependencies.lock.json disagree. Review and update both before building.' }
$lib = Join-Path $PSScriptRoot 'lib'
$driver = Join-Path $lib ('h2-' + $dependency.version + '.jar')
if (-not (Test-Path -LiteralPath $driver)) {
    if ($Offline) { throw 'The SQL library is missing. Run bootstrap.ps1 once with network access.' }
    New-Item -ItemType Directory -Path $lib -Force | Out-Null
    $temporary = Join-Path $lib ('h2-' + [guid]::NewGuid().ToString('N') + '.download')
    $url = 'https://repo.maven.apache.org/maven2/com/h2database/h2/' + $dependency.version + '/h2-' + $dependency.version + '.jar'
    Invoke-WebRequest -Uri $url -OutFile $temporary -MaximumRedirection 0 -UseBasicParsing
    if ((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash -ine $dependency.sha256) { throw 'SQL library checksum mismatch. The downloaded file was not installed.' }
    Move-Item -LiteralPath $temporary -Destination $driver
}
if ((Get-FileHash -LiteralPath $driver -Algorithm SHA256).Hash -ine $dependency.sha256) { throw 'SQL library checksum mismatch. Do not run this dependency.' }
Write-Host ('Verified H2 ' + $dependency.version + ' (SHA-256).')
return $driver
