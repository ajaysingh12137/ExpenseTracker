import { useNavigation } from '@react-navigation/native';
import {
  BatteryCharging,
  BatteryWarning,
  Settings2,
  Smartphone,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {
  batterySteps,
  getManufacturer,
  isIgnoringBatteryOptimizations,
  openAppDetailsSettings,
  openBatteryOptimizationSettings,
} from '../device/deviceServices';
import {
  Button,
  Divider,
  GlassCard,
  ListRow,
  Screen,
  SectionTitle,
} from '../ui/components';
import { alpha, spacing, type, useTheme } from '../ui/theme';

export function BatteryGuideContent() {
  const t = useTheme();
  const [manufacturer, setManufacturer] = useState('');
  const [unrestricted, setUnrestricted] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    isIgnoringBatteryOptimizations().then(setUnrestricted);
  }, []);

  useEffect(() => {
    getManufacturer().then(setManufacturer);
    refresh();
    const sub = AppState.addEventListener(
      'change',
      state => state === 'active' && refresh(),
    );
    return () => sub.remove();
  }, [refresh]);

  const steps = batterySteps(manufacturer);
  const brand = manufacturer
    ? manufacturer[0].toUpperCase() + manufacturer.slice(1)
    : '';

  return (
    <>
      <GlassCard strong>
        <ListRow
          icon={unrestricted ? BatteryCharging : BatteryWarning}
          iconColor={unrestricted ? t.credit : t.warning}
          title={
            unrestricted
              ? 'Battery optimization is off'
              : 'Battery optimization is on'
          }
          subtitle={
            unrestricted
              ? 'Android will not pause capture for battery.'
              : 'Android may pause capture in the background.'
          }
        />
        {!unrestricted && (
          <Button
            label="Open battery settings"
            icon={Settings2}
            variant="secondary"
            compact
            onPress={() => openBatteryOptimizationSettings()}
          />
        )}
      </GlassCard>

      <SectionTitle>
        {brand ? `On your ${brand} phone` : 'On your phone'}
      </SectionTitle>
      <GlassCard>
        {steps.map((step, index) => (
          <View key={step}>
            {index > 0 && <Divider />}
            <View style={styles.step}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: alpha(t.primary, 0.14) },
                ]}
              >
                <Text style={[type.label, { color: t.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[type.body, styles.flex, { color: t.text }]}>
                {step}
              </Text>
            </View>
          </View>
        ))}
        <Text style={[type.caption, styles.note, { color: t.textSubtle }]}>
          Menu names vary between phone models and Android versions.
        </Text>
        <Button
          label="Open app info"
          icon={Smartphone}
          variant="secondary"
          compact
          onPress={() => openAppDetailsSettings()}
        />
      </GlassCard>
    </>
  );
}

export function BatteryGuideScreen() {
  const navigation = useNavigation();
  return (
    <Screen
      onBack={navigation.goBack}
      title="Battery settings"
      subtitle="Keep capture running"
    >
      <BatteryGuideContent />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { marginTop: spacing.sm },
});
