# Local release verification — 2026-11-16

The security update passed these local checks:

| Suite | Passed checks | Main evidence |
| --- | ---: | --- |
| Java/H2/security integration | 63 | Data/audit tampering locks access; stale versions fail; session clocks expire; SQL backups restore with the matching key. |
| Running-server HTTP security | 68 | Anonymous access is rejected; session/CSRF/origin checks work; forged note authors are ignored; password changes invalidate sessions. |
| Browser workflows and layouts | 56 | Owner setup/sign-in/out, cross-tab clearing, password change, stale-form recovery, existing record workflows, and desktop/mobile layouts. |
| **Total** | **187** | Tests use isolated fictional workspaces. |

The local environment used Java 17, H2 2.5.252, and an isolated headless Microsoft Edge browser. The normal app database was not used for these attack fixtures. Test passphrases were generated for disposable test accounts; they are not application defaults.

Source JavaScript syntax and release contents are also checked. The GitHub source package includes no runtime database, owner account, generated JAR, export, or private key. The runnable package adds only the compiled JAR and verified H2 library to the same source set.

The GitHub Actions/CodeQL configurations are supplied for execution after upload. No hosted scan, independent penetration test, certification, or institutional deployment is claimed. See SECURITY.md for remaining limits.
