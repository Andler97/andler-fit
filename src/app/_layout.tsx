import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/auth';
import { colors } from '@/lib/theme';
// Registers the foreground notification handler at startup.
import '@/lib/notifications';

function InitialLayout() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';
    if (!session) {
      if (!inAuth) router.replace('/(auth)/sign-in');
    } else if (!profile?.onboarded_at) {
      if (!inOnboarding) router.replace('/(onboarding)/goal');
    } else if (inAuth || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, profile, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
