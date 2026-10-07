import { Check, PencilLine, X } from 'lucide-react-native';
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
import { alpha, radius, spacing, useTheme } from './theme';

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
  confirmIsEdit = false,
}: {
  children: React.ReactNode;
  label: string;
  onConfirm: () => void;
  onIgnore: () => void;
  onOpen: () => void;
  confirmLabel?: string;
  /** When the right-swipe opens the editor instead of confirming (missing amount). */
  confirmIsEdit?: boolean;
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
              duration: 160,
              useNativeDriver: false,
            }).start(() => {
              x.setValue(0);
              handlers.current.onConfirm();
            });
          } else if (g.dx < -THRESHOLD) {
            Animated.timing(x, {
              toValue: -500,
              duration: 160,
              useNativeDriver: false,
            }).start(() => {
              x.setValue(0);
              handlers.current.onIgnore();
            });
          } else {
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: false,
              bounciness: 6,
            }).start();
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

  const confirmOpacity = x.interpolate({
    inputRange: [0, 40, THRESHOLD],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });
  const ignoreOpacity = x.interpolate({
    inputRange: [-THRESHOLD, -40, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  });
  const ConfirmIcon = confirmIsEdit ? PencilLine : Check;

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.under,
          styles.underLeft,
          { backgroundColor: alpha(t.credit, 0.18), opacity: confirmOpacity },
        ]}
      >
        <View style={[styles.actionDot, { backgroundColor: t.credit }]}>
          <ConfirmIcon size={18} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={[styles.underText, { color: t.credit }]}>
          {confirmLabel}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.under,
          styles.underRight,
          { backgroundColor: alpha(t.danger, 0.16), opacity: ignoreOpacity },
        ]}
      >
        <Text style={[styles.underText, { color: t.danger }]}>Ignore</Text>
        <View style={[styles.actionDot, { backgroundColor: t.danger }]}>
          <X size={18} color="#FFFFFF" strokeWidth={3} />
        </View>
      </Animated.View>
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
          style={({ pressed }) => [
            styles.front,
            {
              backgroundColor: t.elevated,
              borderColor: t.glassBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm + 2 },
  under: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  underLeft: { justifyContent: 'flex-start' },
  underRight: { justifyContent: 'flex-end' },
  actionDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  underText: { fontSize: 15, fontWeight: '800' },
  front: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
});
