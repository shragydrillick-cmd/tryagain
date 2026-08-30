import React, { useState } from 'react';
import { View, Text, Image, Pressable, TextInput, StyleSheet, GestureResponderEvent } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, type } from '../theme';

/**
 * Photo-assisted dimension estimator (v1, no ML model).
 *
 * The user photographs the item, then taps two points on a part whose real
 * length they already know (a strap, a logo, a ruler laid next to it — or
 * simply an edge they can measure by hand), types that length in, then taps
 * two more points on the part they want to measure. Because both distances
 * are read from the same image, the camera's scale cancels out in the
 * ratio — no need to know the camera distance or focal length:
 *
 *   estimated_cm = known_cm * (pixels_of_unknown_edge / pixels_of_known_edge)
 *
 * This only holds well when both edges are roughly the same distance from
 * the camera (i.e. both are on a near-flat face pointed at the lens) — the
 * UI says so. Swap this component's `estimate()` for a real vision-model
 * call later without touching the rest of the form.
 */

type Point = { x: number; y: number };

const IMAGE_BOX = 300;

export function PhotoMeasure({ onEstimate }: { onEstimate: (cm: number) => void }) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [knownCm, setKnownCm] = useState('');

  const stage: 'need-photo' | 'mark-known-1' | 'mark-known-2' | 'enter-known' | 'mark-target-1' | 'mark-target-2' | 'done' = !imageUri
    ? 'need-photo'
    : points.length === 0
    ? 'mark-known-1'
    : points.length === 1
    ? 'mark-known-2'
    : points.length === 2 && !knownCm
    ? 'enter-known'
    : points.length === 2
    ? 'mark-target-1'
    : points.length === 3
    ? 'mark-target-2'
    : 'done';

  async function pickImage(fromCamera: boolean) {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
      setPoints([]);
      setKnownCm('');
    }
  }

  function handleTap(e: GestureResponderEvent) {
    if (stage === 'need-photo' || stage === 'enter-known' || stage === 'done') return;
    const { locationX, locationY } = e.nativeEvent;
    setPoints((p) => [...p, { x: locationX, y: locationY }]);
  }

  function reset() {
    setPoints([]);
    setKnownCm('');
  }

  const instructions: Record<typeof stage, string> = {
    'need-photo': 'Take or choose a photo of the item.',
    'mark-known-1': 'Tap one end of a part whose real length you know (e.g. a strap, a logo, or an edge you measured by hand).',
    'mark-known-2': 'Now tap the other end of that same part.',
    'enter-known': 'How long is that, in cm?',
    'mark-target-1': 'Tap one end of the dimension you want to estimate.',
    'mark-target-2': 'Now tap the other end.',
    done: 'Estimate ready.',
  };

  return (
    <View style={styles.wrap}>
      {!imageUri ? (
        <View style={styles.row}>
          <Pressable style={styles.pickBtn} onPress={() => pickImage(true)}>
            <Text style={styles.pickBtnText}>📷 Camera</Text>
          </Pressable>
          <Pressable style={styles.pickBtn} onPress={() => pickImage(false)}>
            <Text style={styles.pickBtnText}>🖼 Choose photo</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable onPress={handleTap} style={styles.imageBox}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            {points.map((p, i) => (
              <View key={i} pointerEvents="none" style={[styles.marker, { left: p.x - 6, top: p.y - 6 }, i < 2 ? styles.markerKnown : styles.markerTarget]}>
                <Text style={styles.markerLabel}>{i + 1}</Text>
              </View>
            ))}
          </Pressable>
          <Text style={styles.instruction}>{instructions[stage]}</Text>

          {stage === 'enter-known' && (
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 12"
                value={knownCm}
                onChangeText={setKnownCm}
                autoFocus
              />
              <Text style={type.body}>cm — then tap the edge you want to measure</Text>
            </View>
          )}

          {points.length === 4 && (
            <ResultRow points={points} knownCm={knownCm} onUse={onEstimate} />
          )}

          <Pressable onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetText}>Start over / retake</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function ResultRow({ points, knownCm, onUse }: { points: Point[]; knownCm: string; onUse: (cm: number) => void }) {
  const known = parseFloat(knownCm);
  if (!known || points.length !== 4) return null;
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const knownPx = d(points[0], points[1]);
  const targetPx = d(points[2], points[3]);
  if (knownPx <= 0) return null;
  const est = Math.round(known * (targetPx / knownPx) * 10) / 10;
  return (
    <View style={styles.resultBox}>
      <Text style={type.h3}>Estimated: {est} cm</Text>
      <Pressable style={styles.useBtn} onPress={() => onUse(est)}>
        <Text style={styles.useBtnText}>Use this value</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pickBtn: { flex: 1, backgroundColor: colors.chip, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  pickBtnText: { color: colors.chipText, fontWeight: '600' },
  imageBox: { width: IMAGE_BOX, height: IMAGE_BOX, backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden', alignSelf: 'center' },
  image: { width: '100%', height: '100%' },
  marker: { position: 'absolute', width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  markerKnown: { backgroundColor: colors.accent },
  markerTarget: { backgroundColor: colors.primary },
  markerLabel: { color: '#fff', fontSize: 8, fontWeight: '700' },
  instruction: { ...type.small, color: colors.textMuted, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, width: 80, backgroundColor: colors.card },
  resultBox: { alignItems: 'center', gap: spacing.xs, backgroundColor: colors.chip, padding: spacing.md, borderRadius: radius.md },
  useBtn: { backgroundColor: colors.accent, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  useBtnText: { color: '#fff', fontWeight: '700' },
  resetBtn: { alignSelf: 'center', padding: spacing.sm },
  resetText: { color: colors.textMuted, textDecorationLine: 'underline', ...type.small },
});
