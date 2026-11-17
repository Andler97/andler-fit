import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Button, Card, Screen } from '@/components/kit';
import { lookupBarcode, scaleMacros, type OffFood } from '@/lib/openfoodfacts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { mealForNow, todayLocalISO } from '@/lib/dates';
import { colors, space } from '@/lib/theme';

export default function Scan() {
  const { session } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [food, setFood] = useState<OffFood | null>(null);
  const [grams, setGrams] = useState('100');
  const [loading, setLoading] = useState(false);
  // The native scanner fires many callbacks per second while a code is in view; a ref
  // closes the gate synchronously, before the state update re-renders the camera.
  const locked = useRef(false);
  const resume = () => {
    locked.current = false;
    setScanning(true);
  };

  const onScanned = async ({ data }: { data: string }) => {
    if (locked.current) return;
    locked.current = true;
    setScanning(false);
    setLoading(true);
    try {
      const f = await lookupBarcode(data);
      if (!f) {
        Alert.alert('Not found', `No product for barcode ${data}.`, [
          { text: 'Scan again', onPress: resume },
        ]);
        return;
      }
      setFood(f);
      if (f.servingSizeG) setGrams(String(f.servingSizeG));
    } catch {
      Alert.alert('Lookup failed', 'Could not reach the food database. Try again.', [
        { text: 'OK', onPress: resume },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    const uid = session?.user.id;
    if (!uid || !food) return;
    const g = parseFloat(grams) || 0;
    const m = scaleMacros(food, g);
    const { error } = await supabase.from('food_log_entries').insert({
      user_id: uid,
      logged_on: todayLocalISO(),
      meal_type: mealForNow(),
      food_name: food.brand ? `${food.name} (${food.brand})` : food.name,
      quantity_g: g,
      kcal: m.kcal,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
    });
    if (error) {
      Alert.alert('Could not add', error.message);
      return;
    }
    router.back();
  };

  if (!permission) {
    return (
      <Screen>
        <Text style={{ color: colors.text }}>Checking camera…</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, color: colors.text, marginBottom: space.md }}>
          Camera access is needed to scan barcodes.
        </Text>
        {permission.canAskAgain ? (
          <Button title="Grant camera access" onPress={requestPermission} />
        ) : (
          // Denied with "don't ask again": the OS won't prompt any more, only Settings can fix it.
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        )}
        <View style={{ height: space.sm }} />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {!food && (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={scanning ? onScanned : undefined}
        />
      )}
      <View style={styles.sheet}>
        {loading && <Text style={{ color: colors.muted, marginBottom: space.sm }}>Looking up…</Text>}
        {food ? (
          <Card>
            <Text style={styles.name}>{food.name}</Text>
            {food.brand ? <Text style={styles.sub}>{food.brand}</Text> : null}
            <Text style={styles.sub}>{food.kcal100 ?? '—'} kcal / 100 g</Text>
            <Text style={[styles.sub, { marginTop: 8 }]}>Amount (g)</Text>
            <TextInput value={grams} onChangeText={setGrams} keyboardType="numeric" style={styles.input} />
            <View style={{ height: space.sm }} />
            <Button title={`Add ${scaleMacros(food, parseFloat(grams) || 0).kcal} kcal`} onPress={add} />
            <View style={{ height: space.xs }} />
            <Button
              title="Scan another"
              variant="secondary"
              onPress={() => {
                setFood(null);
                resume();
              }}
            />
          </Card>
        ) : (
          <Text style={{ color: colors.white, textAlign: 'center' }}>Point the camera at a product barcode.</Text>
        )}
        <Pressable onPress={() => router.back()} style={{ marginTop: space.md }}>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: space.lg, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, backgroundColor: colors.card },
});
