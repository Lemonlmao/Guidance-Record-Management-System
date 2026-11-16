# Backup and restore

## Complete backup — recommended

Stop the app and copy its **entire active data folder** to a private backup location. Include:

- `guidance.mv.db`
- `connection.key`
- `integrity.key`

The default folder is `data/`; the blank-workspace launcher uses `data-blank/`. Close the app before copying files. Restore all files from the **same backup** into a separate folder, then launch with `--data` pointing to that folder. Keep the original backup unchanged.

```powershell
java --add-modules jdk.httpserver -jar ./guidancedesk.jar --data ./my-restored-workspace --port 8790 --open-browser
```

Use the owner username/passphrase that existed when the backup was made. All old in-memory browser sessions are invalid after restart.

## SQL backup

Workspace settings can export a full SQL script after sign-in. Copy the matching `integrity.key` from that workspace separately and keep it securely with the export. The script contains private records, account password hashes, and audit history, so never commit it or its key.

For an SQL restore into a **new, empty folder**, run the following from the app folder with H2 available. Replace the example filenames with your private backup paths. Restore only an SQL script you created and trust; an SQL script is executable database input.

```powershell
$restoreFolder = Join-Path $PWD 'data-restored'
if (Test-Path -LiteralPath $restoreFolder) { throw 'Choose a new empty restore folder.' }
New-Item -ItemType Directory -Path $restoreFolder | Out-Null
Copy-Item -LiteralPath './my-backup-integrity.key' -Destination (Join-Path $restoreFolder 'integrity.key')
$databasePassword = [guid]::NewGuid().ToString()
java -cp ./lib/h2-2.5.252.jar org.h2.tools.RunScript -url 'jdbc:h2:./data-restored/guidance' -user guidance -password $databasePassword -script './guidancedesk-backup.sql'
if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Keep the original backup and review the error.' }
[IO.File]::WriteAllText((Join-Path $restoreFolder 'connection.key'), $databasePassword)
java --add-modules jdk.httpserver -jar ./guidancedesk.jar --data ./data-restored --port 8790 --open-browser
```

The app verifies the restored audit history and data before serving records. If verification fails, stop and restore a complete trusted backup. Do not delete audit rows, reinitialize the integrity key, or change rows to make the check pass.

The local connection password in this manual command is a newly generated database connection credential, not your owner sign-in passphrase. For the simplest recovery without command-line credentials, use the complete-folder method above.
