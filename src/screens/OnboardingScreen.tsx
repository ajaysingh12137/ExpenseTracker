import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Switch, View } from 'react-native';
import {
  isPermissionGranted,
  openPermissionSettings,
  setCaptureEnabled,
  setSmsAppsEnabled,
} from '../capture/transactionCapture';
import { setSetting, SettingKeys } from '../db/settings';
import { authenticate, canUseAppLock } from '../device/deviceServices';
import { useAppStore } from '../state/store';
import { Body, Button, Card, Screen, Title } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';
import { BatteryGuideContent } from './BatteryGuideScreen';

const STEPS = [
  'welcome',
  'privacy',
  'access',
  'sms',
  'battery',
  'lock',
] as const;
type Step = (typeof STEPS)[number];

export function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const next = useCallback(() => {
    const index = STEPS.indexOf(step);
    setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  }, [step]);
  const t = useTheme();

  return (
    <Screen safeTop>
      <View
        style={styles.progress}
        accessibilityLabel={`Step ${STEPS.indexOf(step) + 1} of ${
          STEPS.length
        }`}
      >
        {STEPS.map(s => (
          <View
            key={s}
            style={[
              styles.dot,
              {
                backgroundColor:
                  STEPS.indexOf(s) <= STEPS.indexOf(step)
                    ? t.primary
                    : t.border,
              },
            ]}
          />
        ))}
      </View>
      {step === 'welcome' && <Welcome onNext={next} />}
      {step === 'privacy' && <Privacy onNext={next} />}
      {step === 'access' && <Access onNext={next} />}
      {step === 'sms' && <SmsOptIn onNext={next} />}
      {step === 'battery' && <Battery onNext={next} />}
      {step === 'lock' && <AppLock />}
    </Screen>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <Title>Expenses, logged for you</Title>
      <Body>
        When you pay by UPI or card, your bank or payment app sends a
        notification. This app reads those notifications, turns them into
        expenses, and asks you to confirm each one with a swipe.
      </Body>
      <Body muted>
        No typing for most transactions. Cash and anything missed can be added
        by hand or by voice.
      </Body>
      <Button label="Get started" onPress={onNext} />
    </>
  );
}

/** Prominent disclosure: shown before notification access is requested (Play User Data policy). */
function Privacy({ onNext }: { onNext: () => void }) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    await setSetting(SettingKeys.consentAt, String(Date.now()));
    await setCaptureEnabled(true);
    setBusy(false);
    onNext();
  };
  return (
    <>
      <Title>What this app reads</Title>
      <Card>
        <Body>
          ✅ Notifications from the bank and payment apps on our list (for
          example Google Pay, PhonePe, Paytm, BHIM and bank apps), and only ones
          that look like a payment.
        </Body>
      </Card>
      <Card>
        <Body>
          🚫 Never stored: one-time passwords (OTPs) and verification codes, and
          notifications from any other app, including your chats. They are
          checked on your phone and immediately discarded.
        </Body>
      </Card>
      <Card>
        <Body>
          📱 Payment text is read and stored on your phone. Full account and
          card numbers are cut to their last 4 digits before anything is saved.
        </Body>
      </Card>
      <Card>
        <Body>
          ☁️ If the phone cannot understand a payment message, that message
          (with numbers masked) is sent to our server to be read by an AI
          service, and only the result comes back. Nothing else is uploaded.
        </Body>
      </Card>
      <Body muted>
        You can turn capture off at any time in Settings. Your data is not
        included in phone backups.
      </Body>
      <Button
        label="I agree, continue"
        onPress={accept}
        busy={busy}
        accessibilityHint="Turns on payment capture"
      />
    </>
  );
}

function Access({ onNext }: { onNext: () => void }) {
  const [granted, setGranted] = useState(false);
  const check = useCallback(() => {
    isPermissionGranted().then(setGranted);
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener(
      'change',
      state => state === 'active' && check(),
    );
    return () => sub.remove();
  }, [check]);

  return (
    <>
      <Title>Allow notification access</Title>
      <Body>
        Android will show a screen listing apps that can read notifications.
        Turn on "ExpenseTracker" there, then come back. Android shows a strong
        warning on that screen; this app uses the access only as described on
        the previous page.
      </Body>
      <Body muted>
        If the switch is greyed out ("Restricted setting"), open App info → ⋮
        menu → "Allow restricted settings", then try again. This happens when
        the app was not installed from Google Play.
      </Body>
      {granted ? (
        <>
          <Card>
            <Body>✅ Access granted.</Body>
          </Card>
          <Button label="Continue" onPress={onNext} />
        </>
      ) : (
        <>
          <Button
            label="Open settings"
            onPress={() => openPermissionSettings()}
          />
          <Button label="Skip for now" variant="secondary" onPress={onNext} />
        </>
      )}
    </>
  );
}

function SmsOptIn({ onNext }: { onNext: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const t = useTheme();
  const toggle = async (value: boolean) => {
    setEnabled(value);
    await setSmsAppsEnabled(value);
    if (value) {
      await setSetting(SettingKeys.smsConsentAt, String(Date.now()));
    }
  };
  return (
    <>
      <Title>Bank SMS (optional)</Title>
      <Body>
        Many banks send payment alerts by SMS rather than through their app. If
        you turn this on, the app also reads notifications from your SMS app,
        and keeps only messages that look like a payment.
      </Body>
      <Body muted>
        OTPs are still discarded. Other SMS, including personal messages, are
        checked on the phone and never stored. This is off unless you turn it
        on, and you can turn it off later in Settings.
      </Body>
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Body>Read bank SMS alerts</Body>
          </View>
          <Switch
            accessibilityLabel="Read bank SMS alerts"
            value={enabled}
            onValueChange={toggle}
            trackColor={{ true: t.primary, false: t.border }}
          />
        </View>
      </Card>
      <Button label="Continue" onPress={onNext} />
    </>
  );
}

function Battery({ onNext }: { onNext: () => void }) {
  const done = async () => {
    await setSetting(SettingKeys.batteryStepDone, '1');
    onNext();
  };
  return (
    <>
      <Title>Keep capture running</Title>
      <Body>
        Some phones stop apps in the background to save battery, and payments
        made then would be missed. Please change these settings now; it takes a
        minute.
      </Body>
      <BatteryGuideContent />
      <Button label="I've done this" onPress={done} />
    </>
  );
}

function AppLock() {
  const setOnboarded = useAppStore(s => s.setOnboarded);
  const setAppLockEnabled = useAppStore(s => s.setAppLockEnabled);
  const setUnlocked = useAppStore(s => s.setUnlocked);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    canUseAppLock().then(setAvailable);
  }, []);

  const finish = async (lock: boolean) => {
    setBusy(true);
    if (lock) {
      const ok = await authenticate('Turn on app lock', 'Confirm it is you');
      if (!ok) {
        setBusy(false);
        return;
      }
    }
    await setSetting(SettingKeys.appLock, lock ? '1' : '0');
    await setSetting(SettingKeys.onboarded, '1');
    setAppLockEnabled(lock);
    setUnlocked(true);
    setOnboarded(true);
  };

  return (
    <>
      <Title>Lock the app</Title>
      <Body>
        Your spending is private. Require your fingerprint, face or phone PIN to
        open the app.
      </Body>
      {available === false && (
        <Body muted>
          Set a screen lock on your phone first to use app lock. You can turn it
          on later in Settings.
        </Body>
      )}
      <Button
        label="Turn on app lock"
        onPress={() => finish(true)}
        disabled={!available}
        busy={busy}
      />
      <Button
        label="Not now"
        variant="secondary"
        onPress={() => finish(false)}
        disabled={busy}
      />
      <Body muted>
        Tip: make a small UPI payment to see your first expense appear in the
        Inbox.
      </Body>
    </>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
