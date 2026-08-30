import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import type { IllustrationScene } from '../core/illustration';
import { colors, spacing, radius, type } from '../theme';

export function SceneView({ scene, title }: { scene: IllustrationScene; title: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.svgBox}>
        <Svg width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`}>
          <G>
            {scene.cavityOutline.map((r, i) => (
              <Rect key={`c${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} stroke={r.stroke} strokeWidth={1} rx={4} />
            ))}
            {scene.items.map((r, i) => (
              <Rect
                key={`i${i}`}
                x={r.x}
                y={r.y}
                width={Math.max(1, r.w)}
                height={Math.max(1, r.h)}
                fill={r.fill}
                opacity={r.opacity}
                stroke={r.stroke}
                strokeWidth={r.isCurrent ? 2.5 : 1}
                rx={3}
              />
            ))}
          </G>
        </Svg>
      </View>
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legendWrap}>
      {items.map((it, i) => (
        <View key={i} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: it.color }]} />
          <Text style={styles.legendText} numberOfLines={1}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { ...type.small, color: colors.textMuted, marginBottom: spacing.xs },
  svgBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md, marginBottom: spacing.xs, maxWidth: 180 },
  swatch: { width: 12, height: 12, borderRadius: 3, marginRight: spacing.xs },
  legendText: { ...type.small, color: colors.text },
});
