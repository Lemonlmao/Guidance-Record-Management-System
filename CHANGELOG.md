# Changelog

## 1.1.0 — 2026-11-16

- Added first-run owner setup, salted password hashing, sign-in/out, session expiry, login throttling, and passphrase changes.
- Required authenticated sessions and per-session CSRF tokens for data access, edits, and exports.
- Added optimistic version checks, server-derived case-note authorship, transactional signed audit events, and tamper detection that locks access on a mismatch.
- Added a security/activity view, security regression tests, dependency hash verification, and GitHub workflows.
- Prepared a clean source distribution, MIT license, security/contribution documents, upload instructions, and LinkedIn project copy.

## 1.0.0 — 2026-11-16

- Reconstructed the local Java/SQL guidance record app with students, cases, notes, appointments, reports, exports, and fictional sample data.
