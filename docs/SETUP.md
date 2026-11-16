# andler-fit — setup & next steps

## Run the app
Native modules (camera, notifications, Apple sign-in) mean this needs a **dev build**, not Expo Go.

```bash
npm install
npx expo run:ios      # or: npx expo run:android   (or an EAS dev build)
```

`.env` already holds the Supabase URL and publishable key (gitignored).

## Supabase
- Project: `kwwmliqibpgyolehatmw` (org "Andler Test", eu-central-1).
- Schema is applied. Migrations live in `supabase/migrations/` (`0001_init_mvp`, `0002_harden_functions`).
  Re-apply elsewhere with the Supabase CLI: `supabase db push`.
- Security advisors: clean.

## Social sign-in (required before auth works)
In the Supabase dashboard -> Authentication:
1. **Providers -> Apple**: add your Apple Service ID + key. App bundle id is `com.andler.fit`; `usesAppleSignIn` is on.
2. **Providers -> Google**: add a Google OAuth client (iOS/Android/Web) + secret.
3. **URL configuration**: add the redirect URL `andlerfit://` (the app's scheme) to the allow-list.

Apple requires "Sign in with Apple" on iOS if any social login is offered (App Store rule) — already wired.

## Push to GitHub (from your Windows machine, where git is signed in)
1. Create an empty repo on github.com (e.g. `andler-fit`), with no README/.gitignore.
2. In `C:\Andler\Andler-fit`:
```bash
git remote add origin https://github.com/<your-username>/andler-fit.git
git push -u origin main
```

## Roadmap after MVP
- P2 — dynamic training: `exercises` library + AI program assembly/progression.
- P3 — dietary quiz + healthy-tips push (needs `push_tokens` + an Expo push sender).
- P4 — health-scoped chatbot.
- `off-lookup` edge function for server-side Open Food Facts caching into `foods`.
