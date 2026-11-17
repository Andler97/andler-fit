# andler-fit — setup & next steps

## Run the app
The target is a **dev build** (`expo-dev-client`, `eas.json` profile `development`).

```bash
npm install
npx eas-cli login
npx eas-cli build --profile development --platform android   # cloud build -> APK install link/QR
npx expo start --dev-client                                  # then open the app on the phone
```

iPhone: an EAS iOS dev build needs a paid Apple Developer account (register the device with
`npx eas-cli device:create`). Until then use **Expo Go** from the App Store with
`npx expo start --go` (camera, local notifications and Google sign-in work; Apple sign-in doesn't).

The phone must reach this PC on the same Wi-Fi. On Windows, allow Node.js through the firewall, or use
`npx expo start --tunnel` (install `@expo/ngrok` first).

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
3. **URL configuration**: add `andlerfit://` (dev/standalone builds), `exp://**` (Expo Go) and
   `http://localhost:8081` (web dev) to the redirect allow-list. Unlisted redirects silently fall
   back to the Site URL.

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
