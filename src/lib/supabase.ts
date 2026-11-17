import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing env. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
  );
}

// Expo web SSR renders in Node (no `window`), where AsyncStorage crashes. Native always has
// a runtime, so only the web server pass is excluded.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

const storage = {
  getItem: (key: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (isServer ? Promise.resolve() : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    // We finish the OAuth redirect ourselves (see providers/auth), so keep this off.
    detectSessionInUrl: false,
    // PKCE is required for exchangeCodeForSession and returns `?code=` on redirect.
    flowType: 'pkce',
  },
});

// Native: JS timers pause in the background, so only run the refresh ticker while the app
// is foregrounded and refresh immediately on resume (Supabase's recommended RN pattern).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
