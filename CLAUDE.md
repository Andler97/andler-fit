# CLAUDE.md — andler-fit

Guidance for Claude (and Claude Code) working in this repo. Read before making changes.

## What this is
andler-fit is a fitness app (think Lifesum): calorie tracking, nutrition, intermittent
fasting, and — later — training, a dietary quiz, healthy-tips push, and a health chatbot.
Mobile-first: **React Native + Expo** (not web-first; web is only used for quick auth/UI checks).

## Stack
- Expo SDK 58, React Native 0.88, expo-router (file-based routing under `src/app`), TypeScript (strict).
- Backend: Supabase (Postgres + RLS, Auth, Edge Functions). Project ref `kwwmliqibpgyolehatmw`, org "Andler Test", region eu-central-1.
- Food data: Open Food Facts (free public API) for barcode lookups.
- Path alias: `@/*` -> `src/*`.

## Run it
The target is a **dev build** (`expo-dev-client`). Expo Go also runs the MVP (camera, local
notifications and Google sign-in all work there), which is the iPhone path until there's a paid
Apple Developer account. Apple sign-in does not work in Expo Go.
```
npm install
npx eas-cli build --profile development --platform android   # EAS dev build (APK); iOS needs Apple Dev account
npx expo start --dev-client   # serve JS to the dev build
npx expo start --go           # serve JS to Expo Go (iPhone without a dev build)
npx expo start --web          # quick loop for auth/onboarding/tracker UI only (no camera on web)
```
Windows dev box: no Android SDK/JDK 17 locally, so native builds go through EAS (project
`@andler97/andlerfit`). The phone must reach Metro on the LAN; if Windows Firewall blocks Node,
allow it or use `--tunnel` (needs `@expo/ngrok`).
`.env` holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (gitignored).

## Before you finish any change
- `npx tsc --noEmit` must pass (CI-worthy gate).
- Keep responses/code changes minimal and typed. No secrets in git (`.env` stays ignored).

## Auth — hard-won gotchas (don't regress these)
- **Never `await` a Supabase data query inside `onAuthStateChange`.** It holds an auth lock and deadlocks on web. Track the session in the callback; load the profile in a separate effect keyed on the user id. (See `src/providers/auth.tsx`.)
- `flowType: 'pkce'` is required (OAuth returns `?code=`, exchanged via `exchangeCodeForSession`).
- Web uses a full-page redirect (`redirectTo: window.location.origin`); native uses `WebBrowser.openAuthSessionAsync` + manual code exchange. App scheme is `andlerfit`.
- Native redirect is the fixed string `andlerfit://`. **Don't use `makeRedirectUri`/`Linking.createURL` for it** in dev builds: they embed the Metro host (`andlerfit://192.168.x.x:8081`), which isn't allow-listed, so Supabase silently falls back to the Site URL. Only Expo Go uses `Linking.createURL('/')` (`exp://<host>/--/`).
- Supabase falls back to the Site URL *silently* when `redirect_to` isn't allow-listed. To check a redirect, start `/auth/v1/authorize?provider=google&redirect_to=...&code_challenge=<marker>` and read `referrer` from `auth.flow_state` for that challenge. Allow-list edits take ~1–2 min to propagate.
- Apple Sign-In is wired but **deferred** (needs a paid Apple Developer account). Keep it iOS-only and non-blocking.
- Supabase Auth config needed for sign-in to work: Google provider keys + redirect allow-list (`andlerfit://`, `exp://**` for Expo Go, and `http://localhost:8081` for web dev).

## Native gotchas
- Android 13+ shows the notification permission prompt only after a channel exists: create the `fasting` channel before `requestPermissionsAsync` and schedule on it (`src/lib/notifications.ts`).
- `CameraView.onBarcodeScanned` fires many times per second; gate it with a ref, not state (`src/app/scan.tsx`).

## Database
- Migrations: `supabase/migrations/` (`0001_init_mvp`, `0002_harden_functions`). Apply in order (Supabase CLI `supabase db push`, or the MCP migration tool).
- Every user table has RLS: a row is visible/writable only to `auth.uid() = user_id` (profiles key on `id`).
- `foods`: public read of Open Food Facts cache rows; clients may only write their own `custom` foods. OFF cache writes should go through a service-role Edge Function (`off-lookup`, not built yet), never the client.
- Macro math lives in `src/lib/nutrition.ts` (Mifflin-St Jeor BMR x activity, goal-adjusted).
- After schema changes, run the Supabase security advisors and keep them at zero.

## Data model (tables)
profiles, goals (one active per user), weight_logs, foods, food_log_entries,
fasting_settings, fasting_logs, and stubs: exercises (training, P2), push_tokens (tips, P3).

## Project layout
```
src/app/            expo-router routes: (auth), (onboarding), (tabs), scan.tsx, _layout.tsx
src/providers/      auth.tsx (session + social sign-in)
src/lib/            supabase, nutrition, openfoodfacts, notifications, dates, theme
src/components/      kit.tsx (Screen/Button/Card/Pill)
src/types/db.ts     hand-written row types
supabase/migrations manifest + SQL
docs/SETUP.md       run / OAuth / GitHub / roadmap
```

## Roadmap (phases)
- P1 (MVP, done): goal onboarding, calorie tracker + barcode scanner, intermittent fasting.
- P2: dynamic training — curated `exercises` library + AI assembly/progression (library is source of truth; AI must not invent exercises).
- P3: dietary quiz + healthy-tips push (needs `push_tokens` + an Expo push sender).
- P4: health-scoped chatbot (answers health/nutrition/exercise only).
- Infra soon: `off-lookup` edge function for server-side OFF caching into `foods`.

## Do NOT touch
Other Supabase projects on this account (`imiu-map`, `motorcycle-joyride`) and the separate
`andler-riders` project. This repo and the `andler-fit` Supabase project only.

## Commits
Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Keep messages specific.
