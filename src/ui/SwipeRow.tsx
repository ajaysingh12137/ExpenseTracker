import React, { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { radius, spacing, useTheme } from './theme';

const THRESHOLD = 96;

/**
 * Swipe right to confirm, left to ignore, tap to open. Screen-reader users get the same three
 * actions through accessibilityActions, since swipes are not reachable with TalkBack.
 */
export function SwipeRow({
  children,
  label,
  onConfirm,
  onIgnore,
  onOpen,
  confirmLabel = 'Confirm',
}: {
  children: React.ReactNode;
  label: string;
  onConfirm: () => void;
  onIgnore: () => void;
  onOpen: () => void;
  confirmLabel?: string;
}) {
  const t = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const handlers = useRef({ onConfirm, onIgnore });
  handlers.current = { onConfirm, onIgnore };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly horizontal drags so the list still scrolls vertically.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: Animated.event([null, { dx: x }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > THRESHOLD) {
            Animated.timing(x, {
              toValue: 500,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              x.setValue(0);
              handlers.current.onConfirm();
            });
          } else if (g.dx < -THRESHOLD) {
            Animated.timing(x, {
              toValue: -500,
              duration: 150,
              useNativeDriver: false,
            }).start(() => {
              x.setValue(0);
              handlers.current.onIgnore();
            });
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
      }),
    [x],
  );

  const onAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'confirm':
        onConfirm();
        break;
      case 'ignore':
        onIgnore();
        break;
      case 'activate':
        onOpen();
        break;
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.under, { backgroundColor: t.surfaceAlt }]}>
        <Text style={[styles.underText, { color: t.credit }]}>
          ✓ {confirmLabel}
        </Text>
        <Text style={[styles.underText, { color: t.danger }]}>Ignore ✕</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX: x }] }}
        {...responder.panHandlers}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Swipe right to confirm, left to ignore, or open to edit"
          accessibilityActions={[
            { name: 'activate', label: 'Edit' },
            { name: 'confirm', label: confirmLabel },
            { name: 'ignore', label: 'Ignore' },
          ]}
          onAccessibilityAction={onAction}
          onPress={onOpen}
          style={[
            styles.front,
            { backgroundColor: t.surface, borderColor: t.border },
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  under: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  underText: { fontSize: 15, fontWeight: '700' },
  front: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
});
