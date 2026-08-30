import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ITEMS } from '../src/data/items';
import { useSession } from '../src/state/SessionContext';
import { loadSavedItems } from '../src/state/savedItems';
import { colors, spacing, radius, type } from '../src/theme';
import type { ItemDef } from '../src/core/types';

function titleCase(s: string) {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ItemsScreen() {
  const router = useRouter();
  const { carId, selectedItems, customItems, setQty } = useSession();
  const [saved, setSaved] = useState<ItemDef[]>([]);

  useEffect(() => {
    if (!carId) router.replace('/');
  }, [carId]);

  useFocusEffect(
    useCallback(() => {
      loadSavedItems().then(setSaved);
    }, [])
  );

  const library = useMemo(() => {
    const byCat = new Map<string, ItemDef[]>();
    const savedIds = new Set(saved.map((s) => s.id));
    for (const item of ITEMS) {
      if (!byCat.has(item.category)) byCat.set(item.category, []);
      byCat.get(item.category)!.push(item);
    }
    const sections = Array.from(byCat.entries()).map(([category, data]) => ({ title: titleCase(category), data }));
    const savedCustom = [...saved, ...customItems.filter((c) => !savedIds.has(c.id))];
    if (savedCustom.length) sections.unshift({ title: 'Your saved items', data: savedCustom });
    return sections;
  }, [saved, customItems]);

  const qtyOf = (id: string) => selectedItems.find((l) => l.itemId === id)?.qty ?? 0;
  const totalSelected = selectedItems.reduce((s, l) => s + l.qty, 0);

  return (
    <View style={styles.container}>
      <SectionList
        sections={library}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        ListHeaderComponent={
          <Pressable style={styles.addCustomBtn} onPress={() => router.push('/custom-item')}>
            <Text style={styles.addCustomText}>+ Add your own item (measure or enter dimensions)</Text>
          </Pressable>
        }
        renderItem={({ item }) => {
          const qty = qtyOf(item.id);
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{item.name}</Text>
                <Text style={styles.meta}>
                  {dims(item)}
                  {!item.rigid ? ' · squeezes to fit' : ''}
                  {item.shape.kind === 'compound' ? ' · irregular shape' : ''}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={() => setQty(item.id, Math.max(0, qty - 1))}>
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>{qty}</Text>
                <Pressable style={styles.stepBtn} onPress={() => setQty(item.id, qty + 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.footer}>
        <Text style={styles.footerText}>{totalSelected} item{totalSelected === 1 ? '' : 's'} selected</Text>
        <Pressable
          style={[styles.continueBtn, totalSelected === 0 && styles.continueBtnDisabled]}
          disabled={totalSelected === 0}
          onPress={() => router.push('/preferences')}
        >
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function dims(item: ItemDef): string {
  if (item.shape.kind === 'box') {
    const { w, d, h } = item.shape;
    return `${Math.round(w)}×${Math.round(d)}×${Math.round(h)} cm`;
  }
  return 'multi-part shape';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionHeader: { ...type.h3, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  addCustomBtn: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  addCustomText: { color: colors.chipText, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  meta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 18, color: colors.chipText, fontWeight: '700' },
  qtyText: { width: 24, textAlign: 'center', ...type.h3 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { ...type.body, color: colors.textMuted },
  continueBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.pill },
  continueBtnDisabled: { opacity: 0.4 },
  continueText: { color: colors.primaryText, fontWeight: '700' },
});
