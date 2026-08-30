import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../src/state/SessionContext';
import { getCarById } from '../src/data/cars';
import { ITEMS } from '../src/data/items';
import { pack } from '../src/core/packer';
import { buildInstructions, summarize } from '../src/core/instructions';
import { computeTopDownScene, computeSideScene, colorForCategory } from '../src/core/illustration';
import { SceneView, Legend } from '../src/components/TrunkIllustration';
import { colors, spacing, radius, type } from '../src/theme';
import type { PackRequest } from '../src/core/types';

export default function ResultScreen() {
  const router = useRouter();
  const session = useSession();
  const { carId, selectedItems, customItems, accessibleItemIds, seatsFolded, keepRearVisibility, allowBlockingRearView, resetItems } = session;

  const car = carId ? getCarById(carId) : undefined;

  const plan = useMemo(() => {
    if (!car) return null;
    const request: PackRequest = {
      carId: car.id,
      seatsFolded,
      items: selectedItems.map((l) => {
        const custom = customItems.find((c) => c.id === l.itemId);
        return custom ? { itemId: l.itemId, qty: l.qty, customItem: custom } : { itemId: l.itemId, qty: l.qty };
      }),
      accessibleItemIds,
      keepRearVisibility,
      allowBlockingRearView,
    };
    return pack(request, car, [...ITEMS, ...customItems]);
  }, [car, selectedItems, customItems, accessibleItemIds, seatsFolded, keepRearVisibility, allowBlockingRearView]);

  const steps = useMemo(() => (plan ? buildInstructions(plan) : []), [plan]);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!carId || selectedItems.length === 0) router.replace(carId ? '/items' : '/');
  }, [carId, selectedItems.length]);

  if (!car || !plan) return null;

  const uptoStep = plan.placements.length === 0 ? 0 : stepIdx + 1;
  const topScene = computeTopDownScene(car, plan, uptoStep);
  const sideScene = computeSideScene(car, plan, uptoStep);
  const current = steps[stepIdx];

  const legendItems = Array.from(new Set(plan.placements.slice(0, uptoStep).map((p) => p.category))).map((cat) => ({
    label: cat,
    color: colorForCategory(cat),
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 }}>
      <View>
        <Text style={type.h2}>
          {car.make} {car.model}
        </Text>
        <Text style={styles.hint}>{summarize(plan)}</Text>
      </View>

      {plan.placements.length > 0 && (
        <>
          <View style={styles.scenesRow}>
            <SceneView scene={topScene} title="Top-down" />
            <SceneView scene={sideScene} title="Side view (opening on left)" />
          </View>
          <Legend items={legendItems} />

          <View style={styles.stepCard}>
            <Text style={styles.stepCounter}>
              Step {stepIdx + 1} of {steps.length}
            </Text>
            <Text style={type.h3}>{current?.title}</Text>
            <Text style={styles.stepDetail}>{current?.detail}</Text>
            <View style={styles.stepNav}>
              <Pressable disabled={stepIdx === 0} onPress={() => setStepIdx((i) => Math.max(0, i - 1))} style={[styles.navBtn, stepIdx === 0 && styles.navBtnDisabled]}>
                <Text style={styles.navBtnText}>‹ Prev</Text>
              </Pressable>
              <Pressable
                disabled={stepIdx === steps.length - 1}
                onPress={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
                style={[styles.navBtn, stepIdx === steps.length - 1 && styles.navBtnDisabled]}
              >
                <Text style={styles.navBtnText}>Next ›</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {plan.warnings.length > 0 && (
        <View style={styles.warnBox}>
          {plan.warnings.map((w, i) => (
            <Text key={i} style={styles.warnText}>
              ⚠ {w.message}
            </Text>
          ))}
        </View>
      )}

      {plan.unplaced.length > 0 && (
        <View style={styles.unplacedBox}>
          <Text style={type.h3}>Didn't fit</Text>
          {plan.unplaced.map((u, i) => (
            <Text key={i} style={styles.unplacedText}>
              • {u.itemName}: {u.reason}
            </Text>
          ))}
        </View>
      )}

      <View>
        <Text style={type.h3}>All steps</Text>
        {steps.map((s, i) => (
          <Pressable key={i} onPress={() => setStepIdx(i)} style={[styles.listRow, i === stepIdx && styles.listRowActive]}>
            <Text style={styles.listIndex}>{i + 1}</Text>
            <Text style={styles.listText}>{s.detail}</Text>
            {s.accessible && <Text style={styles.accessBadge}>reachable</Text>}
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.restartBtn}
        onPress={() => {
          resetItems();
          router.replace('/items');
        }}
      >
        <Text style={styles.restartText}>Pack something else</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hint: { ...type.small, color: colors.textMuted, marginTop: 2 },
  scenesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  stepCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  stepCounter: { ...type.small, color: colors.textMuted },
  stepDetail: { ...type.body, marginTop: spacing.xs },
  stepNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  navBtn: { backgroundColor: colors.chip, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { color: colors.chipText, fontWeight: '700' },
  warnBox: { backgroundColor: '#fff7ed', borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: '#fed7aa' },
  warnText: { ...type.small, color: colors.warning },
  unplacedBox: { backgroundColor: '#fef2f2', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: '#fecaca', gap: spacing.xs },
  unplacedText: { ...type.small, color: colors.danger },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  listRowActive: { backgroundColor: colors.chip, borderRadius: radius.sm },
  listIndex: { width: 22, ...type.small, color: colors.textMuted },
  listText: { flex: 1, ...type.small, color: colors.text },
  accessBadge: { ...type.small, color: colors.accent, fontWeight: '700' },
  restartBtn: { alignSelf: 'center', padding: spacing.md },
  restartText: { color: colors.primary, fontWeight: '700' },
});
