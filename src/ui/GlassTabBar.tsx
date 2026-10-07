import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ChartPie, House, Inbox, Plus, Settings } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientFill } from './components';
import { alpha, radius, spacing, useTheme } from './theme';

const ICONS: Record<string, LucideIcon> = {
  Home: House,
  Inbox,
  Overview: ChartPie,
  Settings,
};

/**
 * Floating glass tab bar with a centre "add" button. Tabs are split two and two around it.
 */
export function GlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (index: number) => {
    const route = state.routes[index];
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const Icon = ICONS[route.name] ?? House;
    const label =
      typeof options.title === 'string' ? options.title : route.name;
    const badge = options.tabBarBadge;
    const color = focused ? t.primary : t.textSubtle;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge ? `${label}, ${badge} new` : label}
        onPress={onPress}
        style={styles.tab}
      >
        <View
          style={[
            styles.iconPill,
            focused && {
              backgroundColor: alpha(t.primary, t.dark ? 0.22 : 0.12),
            },
          ]}
        >
          <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          {badge !== undefined ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: t.danger, borderColor: t.bg },
              ]}
            >
              <Text style={styles.badgeText}>
                {typeof badge === 'number' && badge > 99 ? '99+' : badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, focused && styles.labelActive, { color }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const half = Math.ceil(state.routes.length / 2);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: t.elevated,
            borderColor: t.glassBorder,
            boxShadow: `0 10px 30px ${alpha(t.shadow, t.dark ? 0.5 : 0.14)}`,
          },
        ]}
      >
        {state.routes.slice(0, half).map((_, i) => renderTab(i))}
        <View style={styles.fabSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add expense"
            onPress={() => navigation.getParent()?.navigate('AddTransaction')}
            style={({ pressed }) => [
              styles.fab,
              {
                boxShadow: `0 8px 18px ${alpha(t.primary, 0.45)}`,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            <GradientFill rounded={22} />
            <Plus size={26} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>
        </View>
        {state.routes.slice(half).map((_, i) => renderTab(i + half))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minHeight: 52,
    justifyContent: 'center',
  },
  iconPill: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  fabSlot: { width: 64, alignItems: 'center' },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: -26,
  },
});
