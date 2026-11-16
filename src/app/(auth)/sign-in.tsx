import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Button, Screen } from '@/components/kit';
import { useAuth } from '@/providers/auth';
import { colors, space } from '@/lib/theme';

export default function SignIn() {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    try {
      setBusy(true);
      await fn();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED' && e?.code !== 'ERR_CANCELED') {
        Alert.alert('Sign in failed', e?.message ?? 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={{ marginBottom: space.xl }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text }}>andler-fit</Text>
        <Text style={{ fontSize: 16, color: colors.muted, marginTop: 8 }}>
          Track calories, nutrition and fasting. Reach your goal.
        </Text>
      </View>
      {Platform.OS === 'ios' && (
        <View style={{ marginBottom: space.md }}>
          <Button title="Continue with Apple" variant="dark" loading={busy} onPress={() => run(signInWithApple)} />
        </View>
      )}
      <Button title="Continue with Google" variant="secondary" loading={busy} onPress={() => run(signInWithGoogle)} />
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: space.lg, textAlign: 'center' }}>
        By continuing you agree to the Terms and Privacy Policy.
      </Text>
    </Screen>
  );
}
