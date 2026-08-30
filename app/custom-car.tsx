import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../src/state/SessionContext';
import { saveCar } from '../src/state/savedCars';
import { buildGenericCarProfile, type GenericCarInput } from '../src/core/carTemplates';
import { colors, spacing, radius, type } from '../src/theme';
import type { CarProfile } from '../src/core/types';

const BODY_STYLES: { value: CarProfile['bodyStyle']; label: string }[] = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'coupe', label: 'Coupe' },
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'wagon', label: 'Wagon' },
  { value: 'suv', label: 'SUV' },
  { value: 'minivan', label: 'Minivan' },
  { value: 'pickup', label: 'Pickup' },
];

export default function CustomCarScreen() {
  const router = useRouter();
  const { addCustomCar, setCar } = useSession();

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [years, setYears] = useState('');
  const [bodyStyle, setBodyStyle] = useState<CarProfile['bodyStyle']>('sedan');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');
  const [wheelArchPinch, setWheelArchPinch] = useState(true);
  const [slopedOpening, setSlopedOpening] = useState(true);

  const showWheelArchToggle = bodyStyle === 'suv' || bodyStyle === 'minivan';
  const showSlopeToggle = bodyStyle === 'hatchback' || bodyStyle === 'wagon';

  const canSave = make.trim().length > 0 && model.trim().length > 0 && numOk(width) && numOk(depth) && numOk(height);

  function handleSave() {
    if (!canSave) return;
    const input: GenericCarInput = {
      id: `custom-car-${Date.now()}`,
      make: make.trim(),
      model: model.trim(),
      years: years.trim() || undefined,
      bodyStyle,
      width: parseFloat(width),
      depth: parseFloat(depth),
      height: parseFloat(height),
      hasWheelArchPinch: showWheelArchToggle ? wheelArchPinch : undefined,
      hasSlopedOpening: showSlopeToggle ? slopedOpening : undefined,
    };
    const car = buildGenericCarProfile(input);
    saveCar(car);
    addCustomCar(car);
    setCar(car.id);
    router.push('/items');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Text style={styles.hint}>
        Don't see your car? Enter a few measurements and we'll still model it with the right shape for its body style — wheel-arch pinch,
        sloped opening, closed-lid height — instead of treating it as a plain box.
      </Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Make</Text>
          <TextInput style={styles.input} value={make} onChangeText={setMake} placeholder="e.g. Mazda" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Model</Text>
          <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="e.g. CX-5" />
        </View>
      </View>
      <View>
        <Text style={styles.label}>Years (optional)</Text>
        <TextInput style={styles.input} value={years} onChangeText={setYears} placeholder="e.g. 2017–2021, or leave blank" />
      </View>

      <View>
        <Text style={type.h3}>Body style</Text>
        <View style={styles.chipsRow}>
          {BODY_STYLES.map((b) => (
            <Pressable key={b.value} style={[styles.chip, bodyStyle === b.value && styles.chipActive]} onPress={() => setBodyStyle(b.value)}>
              <Text style={[styles.chipText, bodyStyle === b.value && styles.chipTextActive]}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text style={type.h3}>Cargo area size (cm)</Text>
        <Text style={styles.hint}>
          Open the trunk/hatch and measure roughly: the widest point across, the depth from the seatback (or tailgate for a pickup) to the
          latch, and the height from the floor to the roof or parcel shelf.
        </Text>
        <View style={styles.dimsRow}>
          <DimField label="Width" value={width} onChangeText={setWidth} />
          <DimField label="Depth" value={depth} onChangeText={setDepth} />
          <DimField label="Height" value={height} onChangeText={setHeight} />
        </View>
      </View>

      {showWheelArchToggle && (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Wheel arches narrow the floor</Text>
            <Text style={styles.hint}>Common on SUVs — the rear wheel housings bulge into the load floor.</Text>
          </View>
          <Switch value={wheelArchPinch} onValueChange={setWheelArchPinch} />
        </View>
      )}
      {showSlopeToggle && (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Liftgate/roofline slopes near the opening</Text>
            <Text style={styles.hint}>Full height is only available once you're past the first bit of depth.</Text>
          </View>
          <Switch value={slopedOpening} onValueChange={setSlopedOpening} />
        </View>
      )}

      <Pressable style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} disabled={!canSave} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save car</Text>
      </Pressable>
    </ScrollView>
  );
}

function DimField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={styles.dimField}>
      <Text style={styles.dimLabel}>{label}</Text>
      <TextInput style={styles.dimInput} keyboardType="numeric" value={value} onChangeText={onChangeText} placeholder="0" />
    </View>
  );
}

function numOk(v: string) {
  const n = parseFloat(v);
  return !!v && Number.isFinite(n) && n > 0;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  label: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  hint: { ...type.small, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card, ...type.body },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.chipText, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
  dimsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  dimField: { flex: 1 },
  dimLabel: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  dimInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  saveBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
});
