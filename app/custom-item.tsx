import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../src/state/SessionContext';
import { saveItem } from '../src/state/savedItems';
import { PhotoMeasure } from '../src/components/PhotoMeasure';
import { buildItemShape, type ProtrusionSpec } from '../src/core/shapeBuilders';
import { colors, spacing, radius, type } from '../src/theme';
import type { ItemDef } from '../src/core/types';

type ProtrusionType = 'corners4' | 'edge2' | 'topHandle';
interface ProtrusionRow {
  id: string;
  label: string;
  type: ProtrusionType;
  size: string;
}

const PROTRUSION_TYPES: { value: ProtrusionType; label: string; hint: string }[] = [
  { value: 'corners4', label: '4 wheels (corners)', hint: 'A spinner suitcase — wheels at all four bottom corners.' },
  { value: 'edge2', label: '2 wheels (one edge)', hint: 'A roller bag or cooler — wheels along just one bottom edge.' },
  { value: 'topHandle', label: 'Handle on top', hint: 'A telescoping handle housing sticking up from the top back edge.' },
];

const PHOTO_ANGLE_HINT: Record<'w' | 'd' | 'h', string> = {
  w: 'Photograph the item from straight on (the front) — this shot gives you Width and Height together.',
  h: 'Photograph the item from straight on (the front) — this shot gives you Width and Height together.',
  d: 'Photograph the item from the side — this shot gives you Depth (and Height again, to cross-check).',
};

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
  const [protrusions, setProtrusions] = useState<ProtrusionRow[]>([]);
  const [addingProtrusion, setAddingProtrusion] = useState(false);

  const canSave = name.trim().length > 0 && numOk(w) && numOk(d) && numOk(h);

  function onEstimate(cm: number) {
    const setter = activeField === 'w' ? setW : activeField === 'd' ? setD : setH;
    setter(String(cm));
  }

  function addProtrusion(row: Omit<ProtrusionRow, 'id'>) {
    setProtrusions((p) => [...p, { ...row, id: `p${Date.now()}` }]);
    setAddingProtrusion(false);
  }

  function removeProtrusion(id: string) {
    setProtrusions((p) => p.filter((r) => r.id !== id));
  }

  function handleSave() {
    if (!canSave) return;
    const specs: ProtrusionSpec[] = protrusions
      .filter((p) => numOk(p.size))
      .map((p) => ({ kind: p.type, label: p.label, size: parseFloat(p.size) }));
    const shape = buildItemShape(parseFloat(w), parseFloat(d), parseFloat(h), specs);
    const item: ItemDef = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      category,
      shape,
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
        <Text style={type.h3}>Overall size (cm)</Text>
        <Text style={styles.hint}>
          Measure the whole item top to bottom, side to side — wheels, handle, and anything else sticking out included. You'll separate those
          parts out below, so this should be the full outer size.
        </Text>
        <View style={styles.dimsRow}>
          <DimField label="Width" value={w} onChangeText={setW} active={activeField === 'w'} onFocus={() => setActiveField('w')} />
          <DimField label="Depth" value={d} onChangeText={setD} active={activeField === 'd'} onFocus={() => setActiveField('d')} />
          <DimField label="Height" value={h} onChangeText={setH} active={activeField === 'h'} onFocus={() => setActiveField('h')} />
        </View>
      </View>

      <View>
        <Text style={type.h3}>Estimate from a photo</Text>
        <Text style={styles.hint}>
          Fills the highlighted field above ({fieldLabel(activeField)}). {PHOTO_ANGLE_HINT[activeField]}
        </Text>
        <PhotoMeasure onEstimate={onEstimate} />
      </View>

      <View>
        <Text style={type.h3}>What sticks out?</Text>
        <Text style={styles.hint}>
          Wheels, a handle housing, anything that isn't just the main body — this is what makes the shape realistic instead of a plain box, and
          lets other items tuck into the gaps around it.
        </Text>
        {protrusions.map((p) => (
          <View key={p.id} style={styles.protrusionRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{p.label || PROTRUSION_TYPES.find((t) => t.value === p.type)?.label}</Text>
              <Text style={styles.hint}>{PROTRUSION_TYPES.find((t) => t.value === p.type)?.label} · {p.size || '?'} cm</Text>
            </View>
            <Pressable onPress={() => removeProtrusion(p.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {addingProtrusion ? (
          <AddProtrusionForm onAdd={addProtrusion} onCancel={() => setAddingProtrusion(false)} />
        ) : (
          <Pressable style={styles.addProtrusionBtn} onPress={() => setAddingProtrusion(true)}>
            <Text style={styles.addProtrusionText}>+ Add a sticking-out part</Text>
          </Pressable>
        )}
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

function AddProtrusionForm({ onAdd, onCancel }: { onAdd: (row: Omit<ProtrusionRow, 'id'>) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ProtrusionType>('corners4');
  const [size, setSize] = useState('');
  const canAdd = numOk(size);
  const selected = PROTRUSION_TYPES.find((t) => t.value === kind)!;

  return (
    <View style={styles.protrusionForm}>
      <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Label, e.g. Wheels" />
      <View style={styles.chipsRow}>
        {PROTRUSION_TYPES.map((t) => (
          <Pressable key={t.value} style={[styles.chip, kind === t.value && styles.chipActive]} onPress={() => setKind(t.value)}>
            <Text style={[styles.chipText, kind === t.value && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{selected.hint}</Text>
      <Text style={styles.dimLabel}>How far it sticks out (cm)</Text>
      <TextInput style={[styles.input, { width: 100 }]} keyboardType="numeric" value={size} onChangeText={setSize} placeholder="e.g. 4" />
      <View style={styles.row}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.confirmBtn, !canAdd && styles.saveBtnDisabled]}
          disabled={!canAdd}
          onPress={() => onAdd({ label: label.trim(), type: kind, size })}
        >
          <Text style={styles.confirmText}>Add</Text>
        </Pressable>
      </View>
    </View>
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
  protrusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  removeText: { color: colors.danger, fontWeight: '600' },
  addProtrusionBtn: { backgroundColor: colors.chip, borderRadius: radius.md, padding: spacing.md },
  addProtrusionText: { color: colors.chipText, fontWeight: '600' },
  protrusionForm: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.chip },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.chipText, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.primaryText },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cancelBtn: { padding: spacing.sm },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  confirmBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  confirmText: { color: colors.primaryText, fontWeight: '700' },
});
