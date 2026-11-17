import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/db';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Linking, Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const isWeb = Platform.OS === 'web';

// Must match the Supabase redirect allow-list exactly. Don't derive it with
// AuthSession.makeRedirectUri / Linking.createURL: in a dev build those embed the Metro host
// (`andlerfit://192.168.x.x:8081`), which isn't allow-listed, so Supabase silently falls back
// to the Site URL and the phone's browser never returns to the app.
const NATIVE_REDIRECT = 'andlerfit://';

function redirectParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  for (const part of [query, hash]) new URLSearchParams(part).forEach((v, k) => params.set(k, v));
  return params;
}

// The same redirect can reach us twice on Android (openAuthSessionAsync's result and the
// app-level Linking event), and a PKCE code is single-use, so share one exchange per code.
const exchanges = new Map<string, Promise<void>>();

async function completeOAuthRedirect(url: string): Promise<void> {
  if (!url.startsWith(NATIVE_REDIRECT)) return;
  const params = redirectParams(url);
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) throw new Error(oauthError);
  const code = params.get('code');
  if (!code) return;
  let pending = exchanges.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) throw error;
    });
    exchanges.set(code, pending);
  }
  await pending;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap session + subscribe to changes.
  // IMPORTANT: never await a Supabase data call inside onAuthStateChange — the auth
  // lock it holds will deadlock the query (and the UI) on web. Track the session only
  // here; the profile loads in the separate effect below, outside that lock.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isWeb && window.location.search.includes('code=')) {
          const code = new URLSearchParams(window.location.search).get('code');
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (e) {
        console.warn('[auth] OAuth code exchange failed', e);
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // Native: catch the redirect even when openAuthSessionAsync doesn't hand it back
    // (Android browser quirks, or the OS killed the app while the browser was open).
    const finish = (url: string | null | undefined) => {
      if (url) completeOAuthRedirect(url).catch((e) => console.warn('[auth] OAuth redirect failed', e));
    };
    const linkSub = isWeb ? null : Linking.addEventListener('url', ({ url }) => finish(url));
    if (!isWeb) Linking.getInitialURL().then(finish);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkSub?.remove();
    };
  }, []);

  // Load the profile whenever the signed-in user changes.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    fetchProfile(userId).then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (userId) setProfile(await fetchProfile(userId));
  }, [session?.user?.id]);

  const signInWithApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('No identity token returned from Apple');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Web: full-page redirect; the bootstrap effect above exchanges the `?code=`.
    if (isWeb) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      return;
    }

    // Native: open an auth browser session and exchange the code we get back.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');
    const result = await WebBrowser.openAuthSessionAsync(data.url, NATIVE_REDIRECT);
    if (result.type === 'success') await completeOAuthRedirect(result.url);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile,
        signInWithApple,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
