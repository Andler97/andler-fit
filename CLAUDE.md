# CLAUDE.md — andler-fit

Guidance for Claude (and Claude Code) working in this repo. Read before making changes.

## What this is
andler-fit (andler-fit.com) is a fitness app (think Lifesum): calorie tracking, nutrition, intermittent
fasting, and — later — training, a dietary quiz, healthy-tips push, and a health chatbot.
Mobile-first: **React Native + Expo** (not web-first; web is only used for quick auth/UI checks).

## Product vision — source of truth is the Miro board
Board: https://miro.com/app/board/uXjVENT3fPY=/ (frames: Product, MVP: Phase 1, Roadmap, Architecture,
Data model, Open decisions, Andler Checklist, Azi Checklist).
**Don't invent features, phases, or design direction.** If something isn't on the board or asked for by
the owner, ask first. Re-read the board when planning; the snapshot below is from 2026-11-18.

**The 7 pillars**
| # | Pillar | Phase | Board description |
|---|---|---|---|
| 1 | Goal onboarding | MVP | Pick goal, capture body metrics, compute calorie + macro targets |
| 2 | Calorie tracker + barcode scanner | MVP | Scan packaged goods, Open Food Facts lookup, diary by meal with macros per entry |
| 3 | Intermittent fasting | MVP | Toggle + protocol; local notifications for eating-window start/end |
| 4 | Dynamic full-body training | P2 | Curated exercise library is the source of truth; AI assembles and progresses programs |
| 5 | Dietary quiz | P3 | Finds nutrition gaps, suggests supplements and foods to add through the week |
| 6 | Health chatbot | P4 | Scoped Q&A, health topics only. Concept until the rest is in place |
| 7 | Healthy tips push | P3 | Scheduled tips, e.g. sauna, hydration, sleep, recovery |

**MVP (Phase 1) as specified on the board**
- Onboarding: goal lose weight / gain muscle / recomp; sex, age, height, weight, activity; daily kcal + P/C/F targets.
- Targets: Mifflin-St Jeor BMR × activity = TDEE; goal → deficit / surplus / near-maintenance; protein 1.6–2.2 g/kg, **user can override**.
- Tracker: camera scan → OFF lookup; **cache hits in `foods` via a service-role edge function** (`off-lookup`); diary by meal, macros snapshotted per entry; daily totals vs target; **weight log and trend**.
- Fasting: protocols 16:8, 18:6, 20:4, OMAD, **custom**; local scheduled notifications; works offline, no server push.

**Goal → focus** (board scenario map): weight loss → calorie deficit + cardio/HIIT and isometric holds;
muscle gain → calorie surplus + hypertrophy; fat cut → slight deficit + mix of hypertrophy, cardio/HIIT, isometrics.
**Decided (owner, 2026-11-18):** the third goal is `recomp` at **maintenance** calories, as the code does. The
board's "fat cut / slight deficit" wording doesn't change the math.

**Andler Checklist (feature cards on the board)**: Sign-in (Apple ID / Google) + Resend emails on registration ·
Goal + Edit Goal ("current and desired weight project the most fitting program") · Calorie tracker → barcode
scanner *or* Search food, fed by the product database API · Product library by meal (Breakfast/Lunch/Dinner/Snack)
→ Search food · Intermittent fasting windows tracker · Training program builder (weekly) → dynamic personalized
training (tracks history, varies exercises over time) via pre-composed sets *or* AI assisted, exercise
illustrations (2–3 frame animations, muscle-group highlight) · Dietary quiz → AI-integrated consultant (uses quiz
answers + logged products to suggest foods/supplements for the coming week) · Tips push with random advice ·
Chatbot · AI voice assistant ("Jarvis") · Android build · iOS build.

**Design** is owned on the Azi Checklist and **not decided yet**: colors (red and grey?), fonts, misc. elements;
an interactive buffed chibi biker mascot; interface arrangement (element positions, amount and size of text);
exercise illustrations/animations. The current blue theme (`#208AEF`), app icon and splash are Expo
template placeholders. Build UI on the tokens in `src/lib/theme.ts` so the palette can be swapped later, and
don't introduce a visual direction of your own.

**Decided (owner, 2026-11-18):** sign-in is **Google + Apple only**, with no email/password or magic link,
even though the board's Architecture frame says "Auth (email)" and Open decisions still lists it.

**Open decisions (board, not blocking)**: default units metric (BG) vs imperial
toggle; languages EN now, BG/RU via i18n; monetization (Stripe subscription, when); GDPR consent + data
export/delete (health data); paid food-DB fallback if OFF coverage gaps show; who vets the exercise library.
Board recommendations (stickies): metric default and i18n keys from day 1 so BG/RU drop in later; treat GDPR
export + delete as a P1 chore before any public launch.

## Implementation status (2026-11-18)
| Area | State |
|---|---|
| Google sign-in | ✅ iPhone (Expo Go, S256 PKCE), ✅ web. Android dev build exists, never run on a device |
| Apple sign-in | ⏸ wired, deferred (needs the ~$100/yr Apple Developer account; also unlocks App Store + iOS builds) |
| Resend registration emails | ❌ not started |
| Onboarding → targets | ✅ math matches DB; ran on web, not re-run on iPhone. ❌ protein override |
| Edit goal | ✅ iPhone (Expo Go): `/edit-goal` modal prefills from profile + active goal + latest weigh-in; saves keep goal history and `onboarded_at`. Weigh-in-on-weight-change not yet exercised |
| Scan → diary entry | ✅ iPhone (Expo Go). Client calls OFF directly; ❌ `off-lookup` edge fn / `foods` cache, ❌ search food |
| Diary by meal | ⚠️ `meal_type` auto-set from time of day; no per-meal sections or picker |
| Weight log + trend | ❌ table exists, no UI |
| Fasting | ⚠️ presets only (no custom); save → local notifications not verified on any device; `fasting_logs` unused |
| i18n / units | ❌ English strings hard-coded; metric only (`profiles.locale`/`unit_system` exist, unused) |
| GDPR export/delete | ❌ not started |

**Known issues**
- Today: "Scan or add food" only scans; long-press deletes an entry with no confirmation.
- Screen loads ignore Supabase `error`s (empty state instead of an error).
- `app.json` has `userInterfaceStyle: automatic` but the theme is light-only; dark mode is untested.
- The Apple button shows on iOS and fails in Expo Go.

## Stack
- Expo SDK 58, React Native 0.88, expo-router (file-based routing under `src/app`), TypeScript (strict), React Compiler on.
- Backend: Supabase (Postgres + RLS, Auth, Edge Functions). Project ref `kwwmliqibpgyolehatmw`, org "Andler Test", region eu-central-1.
- Food data: Open Food Facts (free public API) for barcode lookups.
- Builds: EAS project `@andler97/andlerfit` (`eas.json` profiles: development / preview / production).
- Repo: github.com/Andler97/andler-fit (`main`). Path alias: `@/*` -> `src/*`.

## Run it
The target is a **dev build** (`expo-dev-client`). The owner's only device is an **iPhone** and there's no
Apple Developer account yet, so device testing is **Expo Go on iPhone** (camera, local notifications and
Google sign-in work; Apple sign-in doesn't).
```
npm install
npx expo start --go           # Expo Go on iPhone (scan the QR with the Camera app)
npx expo start --dev-client   # dev build (Android APK from EAS)
npx expo start --web          # quick loop for auth/onboarding/tracker UI only (no camera on web)
npx eas-cli build --profile development --platform android   # cloud dev build (APK)
```
- Windows dev box: no Android SDK / JDK 17 locally → native builds go through EAS. iOS dev builds need the
  Apple Developer account (`npx eas-cli device:create`, then `--platform ios`).
- Phone and PC on the same Wi-Fi. If Windows Firewall blocks Node (network is "Public"), allow it or use
  `--tunnel` (needs `@expo/ngrok`). Port 8081 is often taken on this machine → `--port 8082` is fine for
  native, but web OAuth only allow-lists `http://localhost:8081`.
- `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (gitignored). Anything
  `EXPO_PUBLIC_*` ships in the bundle — never put secrets there.

## Before you finish any change
- `npx tsc --noEmit` must pass (CI-worthy gate). For native-affecting changes also bundle:
  `npx expo export --platform ios --output-dir <tmp>` (and `android`) to catch import/runtime-only errors.
- Lint isn't configured (no ESLint config; `npx expo lint` would scaffold one).
- Keep changes minimal and typed. No secrets in git (`.env` stays ignored).
- UI work: verify on the iPhone (Expo Go), not just web; RN-web renders differently.

## Adding a feature
1. **Schema**: new `supabase/migrations/000N_<name>.sql`; own-row RLS on every user table
   (`auth.uid() = user_id`); apply via the Supabase MCP `apply_migration` (or `supabase db push`);
   run security + performance advisors and keep them at zero.
2. **Types**: update `src/types/db.ts` (hand-written).
3. **Data access**: existing screens call `supabase` inline; for new features prefer `src/lib/<feature>.ts`
   and handle `error`.
4. **Routes**: files under `src/app/`; tabs in `(tabs)/_layout.tsx`; modals registered in the root `Stack`
   (`src/app/_layout.tsx`), which also holds the auth/onboarding redirect gate. The gate sends onboarded users
   out of `(auth)`/`(onboarding)`, so screens for signed-in, onboarded users must live outside those groups
   (that's why editing a goal is `src/app/edit-goal.tsx`, not the onboarding route). Typed routes
   (`.expo/types`) regenerate only while Metro runs, so start it before `tsc` after adding a route.
5. **UI**: compose from `src/components/kit.tsx` + `src/lib/theme.ts` tokens; no hard-coded colors.
6. **Native modules**: `npx expo install <pkg>` only. A module that isn't in Expo Go needs a dev build,
   which is Android-only until there's an Apple Developer account, so iPhone testing would stop.
7. **Secrets**: server-side only (Supabase Edge Function secrets), never `EXPO_PUBLIC_*`.
8. **Verify** on the iPhone and check the rows in Supabase (MCP `execute_sql`), then commit.

## Auth — hard-won gotchas (don't regress these)
- **Never `await` a Supabase data query inside `onAuthStateChange`.** It holds an auth lock and deadlocks on web. Track the session in the callback; load the profile in a separate effect keyed on the user id. (See `src/providers/auth.tsx`.)
- `flowType: 'pkce'` is required (OAuth returns `?code=`, exchanged via `exchangeCodeForSession`).
- **Keep `import '@/lib/webcrypto'` before `createClient`** (`src/lib/supabase.ts`). Hermes has no WebCrypto; without the expo-crypto shim supabase-js silently uses a Math.random verifier and a `plain` challenge. Check: edge logs for `/auth/v1/authorize` show `code_challenge_method=s256`.
- Web uses a full-page redirect (`redirectTo: window.location.origin`); native uses `WebBrowser.openAuthSessionAsync` + manual code exchange (also caught from `Linking` events, deduped per code). App scheme is `andlerfit`.
- Native redirect is the fixed string `andlerfit://`. **Don't use `makeRedirectUri`/`Linking.createURL` for it** in dev builds: they embed the Metro host (`andlerfit://192.168.x.x:8081`), which isn't allow-listed, so Supabase silently falls back to the Site URL. Only Expo Go uses `Linking.createURL('/')` (`exp://<host>/--/`).
- Supabase falls back to the Site URL *silently* when `redirect_to` isn't allow-listed. To check a redirect, start `/auth/v1/authorize?provider=google&redirect_to=...&code_challenge=<marker>` and read `referrer` from `auth.flow_state` for that challenge. Allow-list edits take ~1–2 min to propagate.
- Apple Sign-In is wired but **deferred** (needs a paid Apple Developer account). Keep it iOS-only and non-blocking.
- Supabase Auth config needed for sign-in to work: Google provider keys + redirect allow-list (`andlerfit://`, `exp://**` for Expo Go — remove once there's a real iOS build, and `http://localhost:8081` for web dev).

## Native gotchas
- Android 13+ shows the notification permission prompt only after a channel exists: create the `fasting` channel before `requestPermissionsAsync` and schedule on it (`src/lib/notifications.ts`).
- `CameraView.onBarcodeScanned` fires many times per second; gate it with a ref, not state (`src/app/scan.tsx`).
- Fasting reminders are scheduled on **Save**, not on toggle. Remote push (tips) doesn't work in Expo Go; it needs a dev build with push credentials (iOS: APNs → Apple Developer account).
- Fast Refresh after editing provider/client modules can log a bogus `useAuth must be used within an AuthProvider` on web; reload before treating it as a bug.

## Database
- Migrations: `supabase/migrations/` (`0001_init_mvp`, `0002_harden_functions`). Apply in order.
- Every user table has RLS: a row is visible/writable only to `auth.uid() = user_id` (profiles key on `id`). A trigger creates the `profiles` row on sign-up.
- `foods`: public read of Open Food Facts cache rows; clients may only write their own `custom` foods. OFF cache writes go through a service-role Edge Function (`off-lookup`, not built yet), never the client. The app doesn't use `foods` yet (entries snapshot macros, `food_id` is null).
- `food_log_entries.logged_on` is the **local** date (`todayLocalISO`); `weight_logs.logged_on` defaults to the UTC date, so always set it from the client (`saveGoal` does).
- Goals keep history: saving retires the active row and inserts a new one (one active per user via a unique partial index), restoring the old row if the insert fails. `src/lib/goals.ts` owns this; onboarding and edit both go through it. A weigh-in is logged only when the weight changed.
- Macro math lives in `src/lib/nutrition.ts` (Mifflin-St Jeor BMR × activity; lose/gain at 0.5 kg/week, recomp at maintenance; kcal floor 1500 male / 1200 otherwise; protein 1.8 / 2.2 / 2.0 g/kg for lose / gain / recomp).
- After schema changes, run the Supabase security advisors and keep them at zero.

## Data model (tables)
profiles, goals (one active per user), weight_logs, foods, food_log_entries,
fasting_settings, fasting_logs, and stubs: exercises (training, P2), push_tokens (tips, P3).

## AI work (P2+) — engineering constraints
- Call models only from Supabase Edge Functions; the API key is a function secret, never in the app. Keep JWT
  verification on and derive the user from the JWT.
- Default model `claude-opus-5-5` unless the owner chooses otherwise; check the current Claude API docs
  before writing the call (thinking/effort, refusal handling and structured-output rules changed recently).
- Training: the curated `exercises` table is the source of truth. Re-validate every exercise ID server-side;
  never show or store an exercise the library doesn't have.

## Project layout
```
src/app/            expo-router routes: (auth), (onboarding), (tabs), scan.tsx, edit-goal.tsx, _layout.tsx (redirect gate)
src/providers/      auth.tsx (session + social sign-in)
src/lib/            supabase, webcrypto, nutrition, goals, openfoodfacts, notifications, dates, theme
src/components/     kit.tsx (Screen/Button/Card/Pill), goal-form.tsx (onboarding + edit goal)
src/types/db.ts     hand-written row types
supabase/migrations manifest + SQL
docs/SETUP.md       run / OAuth / builds
```

## Do NOT touch
Other Supabase projects on this account (`imiu-map`, `motorcycle-joyride`) and the separate
`andler-riders` project. This repo and the `andler-fit` Supabase project only.

## Commits
Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Keep messages specific.

## Food search (hybrid: USDA + Open Food Facts)
Edge function `supabase/functions/food-search/index.ts` (deployed, JWT-required). Call it with
`supabase.functions.invoke('food-search', { body })`:
- `{ q: 'egg' }` -> USDA FoodData Central (clean generic/whole foods). **Default text search.**
- `{ q: 'nutella', source: 'off' }` -> Open Food Facts text search (packaged-foods toggle).
- `{ barcode: '3017620422003' }` -> Open Food Facts product (scanner path).

Returns `{ items: Item[] }` where each item is normalized:
`{ source, externalId, foodId, name, brand, verified, per100g:{kcal,protein,carbs,fat,sugars,fiber,satFat,salt}, servingSizeG, portions:[{label,grams}], imageUrl }`.
`foodId` is a stable `foods` row (the function upserts USDA/OFF results via service role) — use it for logging and favorites.

Client rules:
- **Submit-only + debounced** search (OFF text is ~10 req/min; don't query per keystroke). Search on keyboard submit.
- Compute logged macros client-side: `per100g * grams / 100`. Store the chosen portion label in `food_log_entries.serving_label`.
- USDA key: set `USDA_FDC_API_KEY` as an edge-function secret (defaults to rate-limited DEMO_KEY).

## Data model additions (0003)
- `foods.portions` jsonb (named portions), unique `(source, external_id)` for upserts.
- `food_favorites(user_id, food_id)` with RLS.
- `food_log_entries.serving_label`.
