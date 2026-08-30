import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../src/state/SessionContext';
import { saveItem } from '../src/state/savedItems';
import { PhotoMeasure } from '../src/components/PhotoMeasure';
import { colors, spacing, radius, type } from '../src/theme';
import type { ItemDef } from '../src/core/types';

export default function CustomItemScreen() {
  const router = useRouter();
  const { addCustomItem } = useSession();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('custom');
  const [w, setW] = useState('');
  const [d, setD] = useState('');
  const [h, setH] = useState('');
  const [rigid, setRigid] = useState(true);
  const [canStandOnEnd, setCanStandOnEnd] = useState(true);
  const [activeField, setActiveField] = useState<'w' | 'd' | 'h'>('w');

  const canSave = name.trim().length > 0 && numOk(w) && numOk(d) && numOk(h);

  function onEstimate(cm: number) {
    const setter = activeField === 'w' ? setW : activeField === 'd' ? setD : setH;
    setter(String(cm));
  }

  function handleSave() {
    if (!canSave) return;
    const item: ItemDef = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      category,
      shape: { kind: 'box', w: parseFloat(w), d: parseFloat(d), h: parseFloat(h) },
      rigid,
      compressibility: rigid ? undefined : 0.25,
      canStandOnEnd,
      canTiltForClosing: true,
      orientationsAllowed: 'any',
    };
    saveItem(item);
    addCustomItem(item);
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. My hiking backpack" />
      </View>
      <View>
        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. gear" />
      </View>

      <View>
        <Text style={type.h3}>Dimensions (cm)</Text>
        <Text style={styles.hint}>Tap a field below, then use the photo tool to fill it — or just type the number.</Text>
        <View style={styles.dimsRow}>
          <DimField label="Width" value={w} onChangeText={setW} active={activeField === 'w'} onFocus={() => setActiveField('w')} />
          <DimField label="Depth" value={d} onChangeText={setD} active={activeField === 'd'} onFocus={() => setActiveField('d')} />
          <DimField label="Height" value={h} onChangeText={setH} active={activeField === 'h'} onFocus={() => setActiveField('h')} />
        </View>
      </View>

      <View>
        <Text style={type.h3}>Estimate from a photo</Text>
        <Text style={styles.hint}>
          Fills the highlighted field above ({fieldLabel(activeField)}). Tap a field first to choose which one.
        </Text>
        <PhotoMeasure onEstimate={onEstimate} />
      </View>

      <View style={styles.switchRow}>
        <Text style={type.body}>Rigid (keeps its shape)</Text>
        <Switch value={rigid} onValueChange={setRigid} />
      </View>
      <View style={styles.switchRow}>
        <Text style={type.body}>Can stand on end</Text>
        <Switch value={canStandOnEnd} onValueChange={setCanStandOnEnd} />
      </View>

      <Pressable style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} disabled={!canSave} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save item</Text>
      </Pressable>
    </ScrollView>
  );
}

function DimField({
  label,
  value,
  onChangeText,
  active,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  active: boolean;
  onFocus: () => void;
}) {
  return (
    <View style={styles.dimField}>
      <Text style={styles.dimLabel}>{label}</Text>
      <TextInput
        style={[styles.dimInput, active && styles.dimInputActive]}
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder="0"
      />
    </View>
  );
}

function fieldLabel(f: 'w' | 'd' | 'h') {
  return f === 'w' ? 'Width' : f === 'd' ? 'Depth' : 'Height';
}

function numOk(v: string) {
  const n = parseFloat(v);
  return !!v && Number.isFinite(n) && n > 0;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  label: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  hint: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card, ...type.body },
  dimsRow: { flexDirection: 'row', gap: spacing.sm },
  dimField: { flex: 1 },
  dimLabel: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  dimInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    textAlign: 'center',
  },
  dimInputActive: { borderColor: colors.primary, borderWidth: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
});
