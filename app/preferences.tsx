import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../src/state/SessionContext';
import { getCarById } from '../src/data/cars';
import { ITEMS } from '../src/data/items';
import { colors, spacing, radius, type } from '../src/theme';

export default function PreferencesScreen() {
  const router = useRouter();
  const {
    carId,
    selectedItems,
    customItems,
    accessibleItemIds,
    toggleAccessible,
    seatsFolded,
    setSeatsFolded,
    keepRearVisibility,
    setKeepRearVisibility,
    allowBlockingRearView,
    setAllowBlockingRearView,
  } = useSession();

  const car = carId ? getCarById(carId) : undefined;

  useEffect(() => {
    if (!carId || selectedItems.length === 0) router.replace(carId ? '/items' : '/');
  }, [carId, selectedItems.length]);

  const lines = useMemo(() => {
    const byId = new Map([...ITEMS, ...customItems].map((i) => [i.id, i]));
    return selectedItems.map((l) => ({ ...l, def: byId.get(l.itemId) })).filter((l) => l.def);
  }, [selectedItems, customItems]);

  if (!car) return null;

  const canFoldSeats = !!car.seatsFoldedExtraRegions;
  const canTrackRearView = !!car.rearVisibility;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.lg }}>
      <View>
        <Text style={type.h2}>Who needs to grab what?</Text>
        <Text style={styles.hint}>Mark anything you'll want mid-trip without unpacking everything else — it'll be kept near the top/opening.</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {lines.map((l) => (
            <View key={l.itemId} style={styles.row}>
              <Text style={type.body}>
                {l.def!.name}
                {l.qty > 1 ? ` ×${l.qty}` : ''}
              </Text>
              <Switch value={accessibleItemIds.includes(l.itemId)} onValueChange={() => toggleAccessible(l.itemId)} />
            </View>
          ))}
        </View>
      </View>

      {canFoldSeats && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Fold rear seats down</Text>
            <Text style={styles.hint}>Frees up significantly more room.</Text>
          </View>
          <Switch value={seatsFolded} onValueChange={setSeatsFolded} />
        </View>
      )}

      {canTrackRearView ? (
        <View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>Keep rear visibility</Text>
              <Text style={styles.hint}>This car's cargo area is open to the back window, so a tall stack can block your view.</Text>
            </View>
            <Switch value={keepRearVisibility} onValueChange={setKeepRearVisibility} />
          </View>
          {keepRearVisibility && (
            <View style={styles.segmented}>
              {(['never', 'ifNeeded'] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.segment, allowBlockingRearView === opt && styles.segmentActive]}
                  onPress={() => setAllowBlockingRearView(opt)}
                >
                  <Text style={[styles.segmentText, allowBlockingRearView === opt && styles.segmentTextActive]}>
                    {opt === 'never' ? "Never block it" : 'Block it only if there\'s no other way'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.infoBox}>
          <Text style={styles.hint}>{car.bodyStyle === 'sedan' ? 'Enclosed trunk — packing here never affects your rear-view.' : 'No rear window to worry about here.'}</Text>
        </View>
      )}

      <Pressable style={styles.continueBtn} onPress={() => router.push('/result')}>
        <Text style={styles.continueText}>Build my pack plan</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hint: { ...type.small, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  segmented: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  segment: { flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...type.small, color: colors.chipText, textAlign: 'center' },
  segmentTextActive: { color: colors.primaryText, fontWeight: '700' },
  infoBox: { backgroundColor: colors.chip, borderRadius: radius.md, padding: spacing.md },
  continueBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  continueText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
});
