# Uploading to GitHub

For the organized Portfolio copy, upload the **contents of GuidanceDesk/GitHub/** into a dedicated repository. This is the independent Guidance Record Management System portfolio project. The source contains the Java backend, SQL schema, browser interface, tests, screenshots, and documentation, with runtime databases and keys excluded. You can also extract GuidanceDesk-GitHub-ready.zip and upload the contents of its inner GuidanceDesk folder.

## Suggested repository details

- Name: `guidance-record-management-system`
- Description: `Java and SQL application for managing student guidance records, case notes, follow-ups, appointments, and reports.`
- Topics: `java`, `sql`, `jdbc`, `h2-database`, `record-management`, `secure-coding`, `portfolio-project`
- License: MIT for the application source; H2 retains its separate license.

## Git commands

Create an empty GitHub repository. Extract the source ZIP, open a terminal in its project folder, then run:

```powershell
git init -b main
git add .
git diff --cached --check
node scripts/check-repository.mjs
git commit -m "Add GuidanceDesk Java and SQL app"
git remote add origin https://github.com/YOUR-USERNAME/guidance-record-management-system.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. Git may ask you to configure your own commit name/email and sign in. No remote or public repository has been created by this preparation.

The local `GuidanceDesk-GitHub` folder may already have a `main` repository with its source staged for review. The ZIP does not include `.git`, so the commands above work after extraction.

If you upload through GitHub's website, upload the **contents** of the project folder so `README.md`, `pom.xml`, `src/`, and `.github/` are at the repository root. Include hidden files and the `.github` directory. Do not upload an extra outer folder or the runnable ZIP.

## After the first push

1. Check the **Actions** tab. The supplied build/security workflow runs Java, SQL, and HTTP tests on Windows and Linux. These hosted runs cannot happen until the repository exists and is pushed.
2. Enable CodeQL **advanced setup** if required by the repository's Security settings, using the supplied workflow rather than a conflicting default workflow. Availability depends on repository visibility and your GitHub plan.
3. Enable Dependabot alerts and private vulnerability reporting if available. The weekly update configuration for Maven and GitHub Actions is included.
4. Enable GitHub secret scanning and push protection where available. The local repository checker is a limited safeguard, not a replacement for GitHub's scanners.
5. Protect `main` with pull requests and passing checks if desired. Do not publish database exports or keys as release assets.
6. Add the actual repository link to `docs/LINKEDIN.md` or your LinkedIn project entry.

## Included files

- Java backend and account/session/integrity code, browser interface, SQL schema and idempotent upgrades.
- Maven metadata, dependency SHA-256 lock, verified bootstrap, build/test/start scripts, Windows launchers.
- Java/H2 and HTTP security tests, repository-content checks, GitHub CI, CodeQL, and Dependabot configuration.
- README, MIT license, third-party notices, security policy, contribution guide, changelog, issue/PR templates.
- Architecture, backup/restore, GitHub upload, testing, and LinkedIn guidance.

Keep any working `data*/`, `backups/`, `*.key`, `.env`, `*.mv.db`, and backup SQL files on your computer. They are deliberately ignored and excluded from the source package.

## Source hosting and app execution

This repository publishes the source and documentation. The application itself runs locally using Java and H2 SQL. GitHub Pages serves static HTML/CSS/JavaScript and cannot run this Java backend or its SQL persistence. See the official GitHub Pages overview: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
