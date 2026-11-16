# Security policy and threat model

## Supported version

The current 1.1.x local application is supported. The 1.0 demo has no owner authentication and should be replaced.

## Protections implemented

- **Owner authentication:** one account, created on first launch. No default username/password or automatic sign-in bypass is shipped. Data reads, changes, CSV exports, and SQL backups require a signed-in session.
- **Password storage:** PBKDF2-HMAC-SHA-256 with 600,000 iterations, a separate random 128-bit salt per password, and constant-time hash comparison. Passphrases must contain 15–128 Unicode characters. Passwords are never included in API state or logs.
- **Sessions:** random 256-bit opaque identifiers, server-side state, HttpOnly and SameSite=Strict host-only cookies, session and CSRF rotation on sign-in, 15-minute idle expiry, an eight-hour absolute limit, and invalidation on sign-out. Changing a passphrase invalidates every active session. Distinct cookie names avoid accidental collisions between workspace ports; browser cookies themselves are not isolated by port, so untrusted local services remain outside this app's protection boundary.
- **Login throttling:** at most five attempts within a rolling 15-minute window for the local workspace process. Failures use a generic response. Restarting the process resets this in-memory limiter.
- **CSRF and origin checks:** per-session tokens protect reads and writes, including setup/login; unexpected Host, Origin, and cross-site/same-site Fetch Metadata values are rejected. The anonymous auth-status endpoint creates a bootstrap session but returns no student data. No CORS access is enabled.
- **SQL injection defenses:** bound parameters for user values, server-side validation, foreign keys, checks, and a fixed set of operations. The HTTP server exposes no SQL console or arbitrary query endpoint.
- **XSS defenses:** escaped user content, no inline JavaScript, Content Security Policy, MIME sniffing protection, and denied framing. Inline CSS remains allowed for chart geometry. CSV export neutralizes cells beginning with spreadsheet formula characters.
- **Concurrent edits:** version checks on students, records, notes, appointments, and settings reject missing or stale versions with HTTP 409. Updates and their audit event commit together; failed operations roll back.
- **Tamper checks:** HMAC-SHA-256 chains protect audit entries. Each entry binds a SHA-256 snapshot of records, notes, students, appointments, settings, and account password hashes. The chain and current snapshot are checked at startup and before protected reads/writes. A mismatch locks access with HTTP 503. Case-note authors and audit actors come from the authenticated account.
- **Request handling:** bounded form bodies, limits on form fields, duplicate-key rejection, session-count limits, and non-cached API responses. No secrets or record contents are printed in error logs.
- **Dependency integrity:** the PowerShell build and launchers verify H2 against the pinned SHA-256 in `dependencies.lock.json`. Downloads use the fixed Maven Central HTTPS origin. GitHub workflow actions are pinned to reviewed commit SHAs.

The password and session choices follow the [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) guidance. This is an implementation reference, not a certification or external audit.

## Limits

This is a **single-owner, single-computer portfolio application**, bound to `127.0.0.1`. It is not a public server, multi-user school system, or compliant institutional records platform. Use fictional demonstration data.

The local endpoint uses HTTP. Its cookie intentionally lacks the Secure flag because this version does not serve HTTPS. Do not expose it through port forwarding, a reverse proxy, a tunnel, or a public host. A network deployment requires HTTPS, Secure cookies, appropriate authentication/authorization design, operational monitoring, and a separate review.

Database files are **not encrypted at rest**. `connection.key` and `integrity.key` live beside the database and must be protected by the OS account and file permissions. Malware or a person with access to the running process, its files, or both the data and integrity key can bypass these local protections. HMAC checks detect unauthorized changes within this model; they cannot prevent privileged local attackers, replacement of the entire app/key set, or rollback to a complete older valid database/audit snapshot. There is no external audit anchor or independent audit storage.

The owner is authorized to change all workspace records. This version has no separate viewer/counselor roles, MFA, account recovery service, or cryptographic signatures from an independent authority. A valid owner session can intentionally modify data. Sign out when leaving a shared computer.

Backups contain private records and password hashes. An SQL backup needs its **matching `integrity.key`** to restore the audit history; keep the sidecar securely with the backup. A stopped-app copy of the entire data folder is the simpler complete backup. Never upload either kind of backup or any key to GitHub.

## Reporting a vulnerability

After this project is uploaded, use the repository's **Security → Report a vulnerability** feature if the owner has enabled private vulnerability reporting. Do not put exploit details, real records, keys, or account credentials in public issues. If that feature is unavailable, ask the maintainer to enable a private reporting channel without posting sensitive details.

## Automated checks

`./test.ps1` runs Java/H2 tests and dependency-free HTTP security tests. They exercise authentication, expiry, throttling, CSRF/origin rejection, stale updates, forged author fields, deliberate database/audit corruption, transaction behavior, restart persistence, and backup restoration. The CodeQL workflow is supplied for GitHub execution; it is not represented as a completed independent security audit.
