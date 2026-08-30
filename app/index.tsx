import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CARS } from '../src/data/cars';
import { loadSavedCars } from '../src/state/savedCars';
import { useSession } from '../src/state/SessionContext';
import { colors, spacing, radius, type } from '../src/theme';
import type { CarProfile } from '../src/core/types';

const BODY_LABEL: Record<CarProfile['bodyStyle'], string> = {
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  suv: 'SUV',
  minivan: 'Minivan',
  pickup: 'Pickup truck',
  wagon: 'Wagon',
  coupe: 'Coupe',
};

export default function HomeScreen() {
  const router = useRouter();
  const { carId, setCar, customCars, addCustomCar } = useSession();
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<CarProfile[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSavedCars().then((cars) => {
        setSaved(cars);
        // make sure anything saved from a previous session is resolvable this session too
        cars.forEach(addCustomCar);
      });
    }, [])
  );

  const yourCars = useMemo(() => {
    const byId = new Map(saved.map((c) => [c.id, c]));
    customCars.forEach((c) => byId.set(c.id, c));
    return Array.from(byId.values());
  }, [saved, customCars]);

  const q = query.trim().toLowerCase();
  const filteredLibrary = useMemo(
    () => (q ? CARS.filter((c) => `${c.make} ${c.model} ${c.bodyStyle}`.toLowerCase().includes(q)) : CARS),
    [q]
  );
  const filteredYourCars = useMemo(
    () => (q ? yourCars.filter((c) => `${c.make} ${c.model} ${c.bodyStyle}`.toLowerCase().includes(q)) : yourCars),
    [q, yourCars]
  );

  const data = useMemo(() => [...filteredYourCars, ...filteredLibrary], [filteredYourCars, filteredLibrary]);

  return (
    <View style={styles.container}>
      <Text style={type.h1}>PackWise</Text>
      <Text style={styles.subtitle}>
        Pick your car. We model the real trunk shape — wheel-well pinch points, sloped liftgates, the height that still lets the lid close — not
        just a volume number.
      </Text>

      <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search make or model…" />

      <Pressable style={styles.addCarBtn} onPress={() => router.push('/custom-car')}>
        <Text style={styles.addCarText}>+ Add a car we don't have (any make/model, even discontinued ones)</Text>
      </Pressable>

      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}
        ListHeaderComponent={filteredYourCars.length > 0 ? <Text style={styles.sectionHeader}>Your cars</Text> : null}
        renderItem={({ item, index }) => {
          const selected = item.id === carId;
          const isFirstLibraryCar = index === filteredYourCars.length && filteredYourCars.length > 0;
          return (
            <View>
              {isFirstLibraryCar && <Text style={styles.sectionHeader}>Library</Text>}
              <Pressable
                onPress={() => {
                  if (item.isCustom) addCustomCar(item);
                  setCar(item.id);
                  router.push('/items');
                }}
                style={[styles.card, selected && styles.cardSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>
                    {item.make} {item.model}
                  </Text>
                  <Text style={styles.meta}>
                    {BODY_LABEL[item.bodyStyle]} · {item.years}
                    {item.isCustom ? ' · your measurements' : ''}
                  </Text>
                  <Text style={styles.note} numberOfLines={2}>
                    {item.notes?.[0]}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.meta}>No matches — try "Add a car we don't have" above.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    marginTop: spacing.md,
  },
  addCarBtn: { backgroundColor: colors.chip, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  addCarText: { color: colors.chipText, fontWeight: '600' },
  sectionHeader: { ...type.h3, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardSelected: { borderColor: colors.primary, borderWidth: 2 },
  meta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  note: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: spacing.sm },
});
