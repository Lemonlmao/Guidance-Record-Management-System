# Contributing

Use fictional data and a disposable workspace for development. Never attach a database, key, CSV/SQL export, or a real student record to an issue or pull request.

## Development

1. Install JDK 17+, PowerShell 7+ for a cross-platform shell, and Node.js 20+ for HTTP tests.
2. Run `./build.ps1`. The first source build downloads H2 from Maven Central and verifies its pinned SHA-256.
3. Run `./test.ps1` before opening a pull request.
4. Check `node --check src/main/resources/public/app.js` and relevant browser workflows.
5. Run `node scripts/check-repository.mjs` against staged/tracked source files.

The Java app itself needs only Java 17+. PowerShell and Node are build/test tools. Windows launchers use the existing Windows PowerShell installation; a JDK is needed if the JAR has not yet been built.

All HTTP mutations must go through `Database.apply`, which validates integrity, performs a transaction, and signs its audit entry. Do not call individual persistence helpers from HTTP routes. Use server-derived account identity for authorship. New editable entities need concurrency version checks and must be included in the canonical integrity snapshot.

## Dependency changes

Review the release and obtain the exact artifact from Maven Central. Update the Maven `h2.version` property and `dependencies.lock.json` together, calculate the SHA-256 from the verified artifact, update notices, then run all checks and a backup/restore test. Never bypass a checksum failure. A Dependabot Maven update intentionally needs this review before the PowerShell build will accept it.

Workflow action upgrades should remain pinned to full commit SHAs. Keep CI permissions restricted. Do not introduce `pull_request_target` execution of untrusted pull-request code.

## Pull requests

Explain the concrete behavior changed, relevant security implications, and checks run. Report vulnerabilities privately as described in SECURITY.md. Preserve the existing visual design for changes unrelated to UI design.
