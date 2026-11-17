import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Minimal WebCrypto for native: Hermes ships no `crypto` global. supabase-js PKCE needs
 * `crypto.getRandomValues` (code verifier) and `crypto.subtle.digest` (S256 challenge);
 * without them it builds the verifier from Math.random and sends it as a "plain" challenge.
 * Must be imported before the Supabase client is created (see lib/supabase.ts).
 */
type MutableCrypto = { -readonly [K in keyof Crypto]?: Crypto[K] };

const DIGESTS = new Set<string>(Object.values(CryptoDigestAlgorithm));

if (Platform.OS !== 'web') {
  const g = globalThis as { crypto?: MutableCrypto };
  const c: MutableCrypto = g.crypto ?? {};

  if (!c.getRandomValues) {
    c.getRandomValues = getRandomValues as unknown as Crypto['getRandomValues'];
  }
  if (!c.subtle) {
    const subtle: Pick<SubtleCrypto, 'digest'> = {
      digest: async (algorithm, data) => {
        const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase();
        if (!DIGESTS.has(name)) throw new DOMException(`Unsupported digest: ${name}`, 'NotSupportedError');
        return digest(name as CryptoDigestAlgorithm, data);
      },
    };
    c.subtle = subtle as SubtleCrypto;
  }
  g.crypto = c;
}
