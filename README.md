# StudyDeck

A free, local-first flashcard and study platform. Guest use requires no account. Study sets are stored in browser IndexedDB and are not sent to the backend. Discord sign-in is optional and allows a user to move up to three sets into an owner-only SQLite cloud library.

## Features

- Guest-first dashboard and set editor. New sets are saved to IndexedDB automatically, and edits autosave locally without a manual Save step.
- IndexedDB persistence for study sets, starred cards, and learning progress.
- Manual creation, copy/paste import, and browser-side file parsing.
- DOCX, TXT, RTF, PDF, XLSX, XLS, CSV, and ODS import support. Google Drive `.gdoc` / `.gsheet` shortcut files show export instructions. Legacy `.doc` files show conversion instructions because they are not parsed directly.
- Editable import review, spreadsheet worksheet/column selection, header-row detection, and an in-place format selector when auto-detection misses a document’s card structure.
- A set overview inspired by familiar digital flashcard study hubs, with a separate Edit page, study progress, preview cards, and direct study-mode launchers.
- Memorization has Basic and Advanced levels. Both combine multiple choice with seven-question flashcard checkpoints; Advanced alternates multiple choice and written recall.
- Cram for a test supports quick multiple-choice review with optional flashcard checkpoints. Practice tests let users choose question count and multiple-choice or written response before starting. Matching remains a separate game.
- A dedicated flashcard study page at `/sets/[id]/flashcards`, with animated 3D flips, keyboard controls, shuffle/restart, and known/review tracking.
- Categories, tags, search, sort, local JSON/CSV export, single-set JSON import, and library JSON backup/restore.
- Optional Discord OAuth with server-side sessions and up to three account-owned cloud sets. Moving a local set to cloud removes its browser copy after the server confirms the upload. Cloud sets are fetched only for their owner and are never cached in IndexedDB.
- Separate Terms of Service, Privacy Policy, and Cookie Policy pages with operator, contact, and effective-date configuration values.

## Requirements

- Node.js 20.9 or newer (Node 22 recommended).
- npm.
- A host that can run a persistent Node.js process and keep a writable persistent disk for SQLite.
- A Discord application only if you want optional Discord cloud storage.

## Install and run

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Guest mode works without Discord credentials. You can create and study sets, import supported files, and export local backups without signing in.

Production:

```bash
npm install
npm run build
npm start
```

The service listens on the port provided by the host (Next.js defaults to 3000). Keep the `data` directory or configured database directory on persistent storage.

## Discord OAuth configuration

1. Create an application in the Discord Developer Portal.
2. Open OAuth2 settings and add an exact redirect URI such as `https://study.example.com/api/auth/callback`.
3. Copy the Discord client ID and client secret into the server environment.
4. Set the following server-side variables:

```dotenv
APP_URL=https://study.example.com
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_REDIRECT_URI=https://study.example.com/api/auth/callback
COOKIE_SECURE=true
DATABASE_PATH=/var/lib/studydeck/studydeck.sqlite
```

The only requested Discord OAuth scope is `identify`. The OAuth state value is checked during callback. Session cookies are HTTP-only, SameSite=Lax, and configured for a 30-day maximum lifetime. The short-lived OAuth state cookie is configured for 10 minutes. Set `COOKIE_SECURE=true` when served over HTTPS. Never expose `DISCORD_CLIENT_SECRET` to a `NEXT_PUBLIC_` variable or client component.

## Database and cloud storage

The application uses `better-sqlite3`, SQLite WAL mode, foreign-key enforcement, prepared statements, indexes, and SQL migration files under `db/migrations/`. The application applies migrations at runtime. The schema stores users, hashed session tokens, study sets, normalized flashcard records, and cloud learning progress. Account deletion cascades through sessions, sets, and cards. Migrations add category/tag metadata and persisted progress fields.

The API validates content on the server, checks ownership for reads/updates/deletes, and enforces the three-cloud-set limit inside an immediate SQLite transaction. Each cloud set is limited to 500 cards. Basic request throttles are held in the Node process memory, so they reset when the process restarts; this single-instance design is not a distributed rate limiter. Guest sets never call cloud APIs. A local set is sent to the cloud only after the user explicitly chooses Move to cloud. After a successful upload, its IndexedDB entry is deleted. Editing a cloud set saves it back to the same owner-scoped SQLite record when Save is pressed. Study progress is sent to an owner-checked progress endpoint and stored in SQLite so it follows the cloud set between devices. Cloud reads return the same not-found response for guests and users who do not own the requested ID.

### Important deployment note

Do not deploy this SQLite-backed version to a serverless platform or a hosting environment with ephemeral filesystems, multiple independent application instances, or read-only deployments. SQLite storage must persist across restarts. Run one application instance with a persistent disk/volume, or redesign the storage layer before using multi-instance/serverless deployment. Back up the SQLite database and its WAL safely using your hosting platform's supported backup procedure.

The SQLite database is not encrypted by this application at the field level. Protect it with host access controls, file permissions, encrypted disks/volumes and encrypted backups where available. Use HTTPS in production.

## File import behavior

Imported files are read in the browser. The source document is not posted to the StudyDeck API for parsing. Extracted content is shown in an editable card preview before the set is saved. Spreadsheet imports allow selection of the sheet, term column, definition column, and whether the first row is a header. The parsers may not preserve complex document formatting, images, formulas, or every table layout.

- `.docx`: Mammoth extracts raw document text.
- `.pdf`: PDF.js extracts selectable text. Image-only scans do not produce OCR text.
- `.xlsx`, `.xls`, `.csv`, `.ods`: SheetJS reads worksheets and rows.
- `.txt`, `.rtf`: Browser text parsing with lightweight RTF text cleanup.
- `.doc`: Convert to `.docx` or PDF first.
- `.gdoc`, `.gsheet`: Download/export the actual document from Google Docs or Sheets first.

File size is limited to 20 MB and a saved set is limited to 500 cards. Review the preview before saving. Password-protected, corrupted, image-only, or unusual files may fail with an explanation.

## Local data and backups

Guest sets, category/tag information, starred status, and study progress live in IndexedDB. The application does not use localStorage for set contents; localStorage is used only for the display theme. Clearing browser site data can permanently remove guest sets. Use Settings to export all local sets as a JSON library backup, import a backup, or clear local data. Each set can also be exported as JSON or CSV. A single-set JSON export can be imported from the file import screen.

## Legal pages

The legal pages display the configured application operator, contact email, and effective date. These values can be set with `APPLICATION_OPERATOR`, `CONTACT_EMAIL`, and `LEGAL_EFFECTIVE_DATE`. The footer's `(r) Eventrigger Byproduct` credit uses `PRODUCT_LINK_URL` for its destination.

## Interface and motion

The study interface uses short entrance transitions, feedback animations, and a 3D flashcard flip. Motion respects the operating system’s `prefers-reduced-motion` preference. The dedicated flashcard view is accessible from the set overview. The set editor is available through the **Edit set** action.

## Verification

Run:

```bash
npm test
npm run lint
npm run build
```

The included Node test suite covers import parsing (including PDF line-break handling), generated multiple-choice distractors, export/restore behavior, and server-side set validation. Browser workflows, Discord OAuth, SQLite account isolation, the cloud-slot limit, and production persistence should also be tested in a configured deployment before launch.

## Configuration reference

| Variable | Purpose |
|---|---|
| `APP_URL` | Public base URL, also used for same-origin checks and post-OAuth redirects |
| `DISCORD_CLIENT_ID` | Discord OAuth application ID |
| `DISCORD_CLIENT_SECRET` | Server-only Discord OAuth secret |
| `DISCORD_REDIRECT_URI` | Exact Discord OAuth callback URL |
| `COOKIE_SECURE` | Set `true` in HTTPS production deployments |
| `DATABASE_PATH` | SQLite file path, preferably on persistent storage |
| `APPLICATION_OPERATOR` | Operator name shown on legal pages |
| `CONTACT_EMAIL` | Contact address shown on legal pages |
| `LEGAL_EFFECTIVE_DATE` | Effective date shown on legal pages |
| `PRODUCT_LINK_URL` | Destination for the footer `(r) Eventrigger Byproduct` credit link |

## Study direction and test variation

Memorization, Cram for a test, Practice test, and Matching sessions let the learner choose to recall the definition (show the term), recall the term (show the definition), or mix both directions at random. Multiple-choice options and typed-answer checking use the selected answer side. Matching presents prompt and answer columns in the selected direction; random mode chooses the direction separately for each pair. Memorization flashcard checkpoints follow the same direction choice.

Practice tests draw the requested number of questions from the full eligible card pool. Retrying first selects cards that were not in the immediately previous test, avoiding repeated five-question sets while enough unseen cards remain. Once the unused pool is smaller than the selected question count, the test mixes the remaining unseen cards with earlier questions. Memorization and Cram also randomize their selected subset when a limited question count is chosen.
