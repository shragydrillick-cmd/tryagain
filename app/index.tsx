import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { CARS } from '../src/data/cars';
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
};

export default function HomeScreen() {
  const router = useRouter();
  const { carId, setCar } = useSession();

  return (
    <View style={styles.container}>
      <Text style={type.h1}>PackWise</Text>
      <Text style={styles.subtitle}>
        Pick your car. We model the real trunk shape — wheel-well pinch points, sloped liftgates, the height that still lets the lid close — not
        just a volume number.
      </Text>

      <FlatList
        data={CARS}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => {
          const selected = item.id === carId;
          return (
            <Pressable
              onPress={() => {
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
                </Text>
                <Text style={styles.note} numberOfLines={2}>
                  {item.notes?.[0]}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
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
