import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  batterySteps,
  getManufacturer,
  isIgnoringBatteryOptimizations,
  openAppDetailsSettings,
  openBatteryOptimizationSettings,
} from '../device/deviceServices';
import {
  Body,
  Button,
  Card,
  Screen,
  SectionTitle,
  Title,
} from '../ui/components';

export function BatteryGuideContent() {
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

  return (
    <>
      <Card>
        <Body>
          {unrestricted
            ? '✅ Battery optimization is off for this app.'
            : '⚠️ Battery optimization is on for this app.'}
        </Body>
        <Button
          label="Open battery settings"
          variant="secondary"
          onPress={() => openBatteryOptimizationSettings()}
        />
      </Card>
      <SectionTitle>
        {manufacturer ? `On your ${manufacturer} phone` : 'On your phone'}
      </SectionTitle>
      <Card>
        {batterySteps(manufacturer).map(step => (
          <Body key={step}>• {step}</Body>
        ))}
        <Body muted>
          Menu names vary between phone models and Android versions.
        </Body>
        <Button
          label="Open app info"
          variant="secondary"
          onPress={() => openAppDetailsSettings()}
        />
      </Card>
    </>
  );
}

export function BatteryGuideScreen() {
  return (
    <Screen>
      <Title>Keep capture running</Title>
      <BatteryGuideContent />
    </Screen>
  );
}
