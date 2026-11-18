# andler-fit

Fitness app (andler-fit.com): calorie tracking with a barcode scanner, goal-based calorie and macro
targets, and intermittent fasting, with training, a dietary quiz, healthy-tips push and a health chatbot
planned. Built with Expo (React Native) and Supabase.

- Product vision and roadmap: [Miro board](https://miro.com/app/board/uXjVENT3fPY=/)
- Working in this repo (status, gotchas, conventions): [CLAUDE.md](CLAUDE.md)
- Running, OAuth and builds: [docs/SETUP.md](docs/SETUP.md)
- Database: [supabase/README.md](supabase/README.md)

## Quick start

```bash
npm install
npx expo start --go     # open in Expo Go on a phone on the same Wi-Fi
```

Needs a `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
