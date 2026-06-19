# MY FOOTBALL ARCHIVE - PROJECT HANDOFF

## Start Here

This is the continuity document for future Codex sessions.

Canonical local folder:

`C:\Users\maroblue\Desktop\성호\개발\bbinge_efootball`

GitHub repository:

`BBINGE/bbinge-efootball-archive`

Supabase project:

`bbinge-efootball` in the `BBINGE LAB` organization, Northeast Asia (Seoul)

Project URL:

`https://grdcypicgtknhgrtmwnp.supabase.co`

Before changing code, read this document and inspect the current files. Never replace the user's data with seed data.

## Current Status

- Static HTML/CSS/JavaScript app deployed through GitHub Pages.
- Supabase database, private Storage bucket, RLS policies, and one owner account are configured.
- New public signups are disabled. Email login remains enabled.
- Historical checkpoint only: the first-sync screen once showed 81 unique players, 84 cards, 7 leagues, and 20 clubs. These counts are expected to increase and must never be treated as the current target count.
- Determine current counts from the live app, the newest JSON backup, and the authenticated Supabase archive row. When they differ, stop before overwriting anything and identify which copy is newest.
- Confirm whether the owner clicked `현재 PC 데이터 업로드` and reached `SYNCED`. Do not assume the first migration is complete.
- A current JSON backup should exist outside the browser.

## Data Ownership

Browser legacy/cache key:

`my-football-archive-v2`

Supabase is the primary cross-device source after first sync:

- `public.football_archives`: one JSON archive row per authenticated user
- `public.football_archive_versions`: up to 50 pre-update snapshots per user
- `player-photos`: private Storage bucket
- Photo object path: `<auth-user-id>/<card-id>.webp`

The publishable Supabase key is intentionally present in `cloud.js`; it is a browser-safe public key. Never put a secret key, `service_role` key, database password, or account password in the repository or chat.

## Important Files

- `index.html`: app markup, Supabase CDN, cloud UI, cache-version query strings
- `app.js`: archive behavior, CRUD, sorting, calculations, local persistence
- `cloud.js`: authentication, first migration, photo upload, cloud loading and saving, revision conflict detection
- `styles.css`: base app styling
- `dense-table.css`: desktop density, table and archive presentation
- `cloud.css`: login and cloud-status styling
- `supabase-schema.sql`: database, RLS, history trigger, and Storage reconstruction script
- `README.md`: public repository overview

## Sync Behavior

1. The app renders the existing local archive without changing it.
2. On GitHub Pages, the owner must log in with the Supabase account.
3. If no cloud archive row exists, the first-sync dialog shows the current local counts dynamically.
4. Upload only when those counts match the latest archive visible immediately before migration. Never compare against the historical numbers in this document.
5. Base64 player photos are uploaded to private Storage.
6. Archive JSON is inserted into `football_archives`.
7. Later edits save automatically after a short debounce.
8. The database trigger increments `revision` and stores the previous JSON in `football_archive_versions`.
9. An optimistic revision check prevents a stale device from silently overwriting a newer edit.
10. On another browser or after cookie deletion, login loads the cloud archive. The first-sync dialog must not reappear after a successful migration.

## Safety Rules

- Never change or clear `my-football-archive-v2` during migration or ordinary updates.
- Never run `localStorage.clear()` or introduce automatic seed resets.
- Never upload a local archive if the cloud is expected to contain data but the first-sync dialog reappears.
- Before risky changes, use the in-app `BACKUP` button and keep the JSON file. Use the counts inside the current app or newest backup, not a hard-coded count from this document.
- Keep manual BACKUP/RESTORE available even after cloud migration.
- Do not delete the Supabase project, owner auth user, archive row, Storage bucket, or GitHub repository.
- Do not disable Email Provider. New signups should remain disabled.
- Do not grant archive tables to `anon`; only `authenticated` receives table privileges.
- Preserve RLS policies and the private Storage bucket.
- Test with a copy or mocked cloud before touching production data.

## Deployment

GitHub Pages remains the frontend host. Supabase stores data and photos.

For a normal update:

1. Modify the canonical local files.
2. Run syntax and browser regression tests.
3. Increase the `?v=` cache version in `index.html` for changed JS/CSS files.
4. Upload only the changed files to the root of the GitHub repository.
5. Wait for the GitHub Pages deployment.
6. Open the deployed URL, log in, and confirm `SYNCED`. Compare the live count with the count observed immediately before deployment; player and card counts naturally grow over time.

Deploying frontend files must not delete Supabase data.

## Troubleshooting

### First-sync dialog appears again

Do not upload. Check:

- Is the correct Supabase account logged in?
- Does `football_archives` contain a row for that user's UID?
- Did the previous migration actually reach `SYNCED`?
- Are the project URL and publishable key in `cloud.js` unchanged?

### Cookie/cache deletion

The session may be removed. Log in again. The cloud archive should load without a first-sync prompt.

### `SYNC ERROR` or revision conflict

Another device saved first. Open the CLOUD status dialog and choose `클라우드에서 다시 불러오기`. Do not force an overwrite.

### Photos missing

Check the `player-photos` bucket, the user's UID folder, Storage RLS policies, and each card's `photoPath`. The app creates signed URLs when loading.

### GitHub update not visible

Check the repository commit time and Pages deployment, then verify the cache-version query strings in `index.html`.

### Supabase free project paused

Resume the project in Supabase, wait until it is Healthy, then reload and log in.

## Suggested Prompt For A New Codex Session

Use this exact prompt:

> `C:\Users\maroblue\Desktop\성호\개발\bbinge_efootball\PROJECT_HANDOFF.md`를 먼저 읽고 현재 프로젝트 구조와 데이터 안전 규칙을 파악해줘. 기존 선수 데이터는 절대 초기화하거나 덮어쓰지 말고, 문제를 진단한 뒤 수정과 테스트까지 진행해줘.
