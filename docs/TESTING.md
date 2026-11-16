# Testing

Run `./test.ps1` with JDK 17+, PowerShell, and Node.js 20+. The first source build needs network access for the verified H2 download; subsequent builds can use the existing library.

The Java/H2 checks use disposable directories and real SQL databases. They cover:

- Owner setup, salted hashing, correct/incorrect authentication, and exclusion of secrets from state.
- Required fields, duplicate IDs, invalid dates, foreign keys, and quoted/Unicode text.
- Records, case notes, archive/restore, scheduling conflicts and adjacency, and settings.
- Stale-version rejection, server-derived authorship, and rollback of failed writes.
- Deterministic idle/absolute session expiry and login-throttle expiry using a test clock.
- Restart persistence, restored SQL data/accounts with the matching integrity key, and sample data initialized once.
- Deliberate record/audit tampering, deleted audit history, and a missing integrity key; these must lock access.
- JSON escaping and CSV formula neutralization.

The dependency-free Node test starts its own Java process on an available loopback port and closes it afterward. It tests protected reads/writes/exports, setup and login CSRF, cross-origin requests, cookie flags, rotation, throttling, input bounds, duplicate form keys, stale edits, impersonation attempts, exports, passphrase changes, and reuse of signed-out sessions.

The GitHub CI runs the same suites on Windows and Linux. CodeQL is configured separately for Java and JavaScript; a local test pass does not imply that a hosted CodeQL scan has already run.

For browser changes, also verify first-run setup, failed/successful sign-in, passphrase visibility controls, sign-out clearing private content, password changes, record/note forms, stale-edit errors, and the security/activity view on desktop and a narrow mobile viewport. No record or credential data should appear in browser localStorage or sessionStorage.

`node scripts/check-repository.mjs` checks tracked/staged source for prohibited runtime files and recognizable credential patterns. It deliberately does not claim to detect every possible secret. Review `git diff --cached` before pushing, and use GitHub secret scanning/push protection where available.
