import {
  ArrowRight,
  BatteryCharging,
  BellRing,
  CircleCheck,
  CloudUpload,
  EyeOff,
  FingerprintPattern,
  Hand,
  Landmark,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {
  isPermissionGranted,
  openPermissionSettings,
  setCaptureEnabled,
  setSmsAppsEnabled,
} from '../capture/transactionCapture';
import { setSetting, SettingKeys } from '../db/settings';
import { authenticate, canUseAppLock } from '../device/deviceServices';
import { useAppStore } from '../state/store';
import {
  Body,
  Button,
  GlassCard,
  GradientFill,
  ListRow,
  Screen,
  ToggleRow,
  Divider,
} from '../ui/components';
import { alpha, radius, spacing, type, useTheme } from '../ui/theme';
import { BrandMark } from '../ui/BrandMark';
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
  const index = STEPS.indexOf(step);
  const next = useCallback(() => {
    setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  }, [index]);
  const back =
    index > 0 && step !== 'access'
      ? () => setStep(STEPS[index - 1])
      : undefined;
  const t = useTheme();

  return (
    <Screen onBack={back}>
      <View
        style={styles.progress}
        accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}
      >
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i <= index ? t.primary : alpha(t.textSubtle, 0.25),
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

function StepHero({
  icon: Icon,
  brand,
  title,
  text,
}: {
  icon?: LucideIcon;
  /** Show the app logo instead of an icon (welcome step). */
  brand?: boolean;
  title: string;
  text: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.hero}>
      <View
        style={[styles.heroRing, { backgroundColor: alpha(t.primary, 0.12) }]}
      >
        {brand ? (
          <View style={{ boxShadow: `0 14px 32px ${alpha(t.primary, 0.42)}` }}>
            <BrandMark size={104} />
          </View>
        ) : (
          <View
            style={[
              styles.heroCircle,
              { boxShadow: `0 12px 30px ${alpha(t.primary, 0.4)}` },
            ]}
          >
            <GradientFill rounded={44} />
            {Icon ? <Icon size={44} color="#FFFFFF" strokeWidth={2} /> : null}
          </View>
        )}
      </View>
      <Text
        accessibilityRole="header"
        style={[type.title, styles.heroTitle, { color: t.text }]}
      >
        {title}
      </Text>
      <Text style={[type.body, styles.heroText, { color: t.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const t = useTheme();
  return (
    <>
      <StepHero
        brand
        title="Expenses, logged for you"
        text="Pay by UPI or card as usual. We turn the payment alert into an expense, and you confirm it with a swipe."
      />
      <GlassCard>
        <ListRow
          icon={Zap}
          iconColor={t.primary}
          title="Automatic"
          subtitle="No typing for most payments"
        />
        <Divider />
        <ListRow
          icon={Hand}
          iconColor="#14B8A6"
          title="One swipe"
          subtitle="Check and confirm in seconds"
        />
        <Divider />
        <ListRow
          icon={ShieldCheck}
          iconColor="#EC4899"
          title="Private"
          subtitle="Your data stays on your phone"
        />
      </GlassCard>
      <Button label="Get started" icon={ArrowRight} onPress={onNext} />
    </>
  );
}

/** Prominent disclosure: shown before notification access is requested (Play User Data policy). */
function Privacy({ onNext }: { onNext: () => void }) {
  const t = useTheme();
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
      <StepHero
        icon={ShieldCheck}
        title="What this app reads"
        text="Please read this before giving access."
      />
      <GlassCard>
        <ListRow
          icon={Landmark}
          iconColor={t.credit}
          title="Payment alerts only"
          subtitle="From bank and payment apps on our list (Google Pay, PhonePe, Paytm, BHIM, bank apps), and only ones that look like a payment."
        />
        <Divider />
        <ListRow
          icon={EyeOff}
          iconColor={t.danger}
          title="Never stored"
          subtitle="OTPs, verification codes, and notifications from any other app, including your chats. They are checked on the phone and discarded."
        />
        <Divider />
        <ListRow
          icon={Smartphone}
          iconColor="#0EA5E9"
          title="Kept on your phone"
          subtitle="Account and card numbers are cut to their last 4 digits before saving. Not included in phone backups."
        />
        <Divider />
        <ListRow
          icon={CloudUpload}
          iconColor="#8B5CF6"
          title="AI help for unclear messages"
          subtitle="If the phone cannot read a payment message, that message (numbers masked) is sent to our server to be read by an AI service. Nothing else is uploaded."
        />
      </GlassCard>
      <Body muted center>
        You can turn capture off at any time in Settings.
      </Body>
      <Button
        label="I agree, continue"
        icon={CircleCheck}
        onPress={accept}
        busy={busy}
        accessibilityHint="Turns on payment capture"
      />
    </>
  );
}

function Access({ onNext }: { onNext: () => void }) {
  const t = useTheme();
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
      <StepHero
        icon={BellRing}
        title="Allow notification access"
        text='Android shows a list of apps that can read notifications. Turn on "ExpenseTracker", then come back here.'
      />
      {granted ? (
        <>
          <GlassCard strong>
            <ListRow
              icon={CircleCheck}
              iconColor={t.credit}
              title="Access granted"
              subtitle="Payments will now be captured."
            />
          </GlassCard>
          <Button label="Continue" icon={ArrowRight} onPress={onNext} />
        </>
      ) : (
        <>
          <GlassCard>
            <ListRow
              icon={TriangleAlert}
              iconColor={t.warning}
              title="Switch greyed out?"
              subtitle='Open App info → ⋮ menu → "Allow restricted settings", then try again. This happens when the app was not installed from Google Play.'
            />
          </GlassCard>
          <Body muted center>
            Android shows a strong warning on that screen. This app uses the
            access only as described on the previous page.
          </Body>
          <Button
            label="Open settings"
            icon={ArrowRight}
            onPress={() => openPermissionSettings()}
          />
          <Button label="Skip for now" variant="ghost" onPress={onNext} />
        </>
      )}
    </>
  );
}

function SmsOptIn({ onNext }: { onNext: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const toggle = async (value: boolean) => {
    setEnabled(value);
    await setSmsAppsEnabled(value);
    if (value) {
      await setSetting(SettingKeys.smsConsentAt, String(Date.now()));
    }
  };
  return (
    <>
      <StepHero
        icon={MessageSquareText}
        title="Bank SMS (optional)"
        text="Many banks send payment alerts by SMS. Turn this on to also read your SMS app's notifications, keeping only payment messages."
      />
      <GlassCard>
        <ToggleRow
          icon={MessageSquareText}
          iconColor="#0EA5E9"
          title="Read bank SMS alerts"
          subtitle="OTPs and personal messages are never stored."
          value={enabled}
          onChange={toggle}
        />
      </GlassCard>
      <Body muted center>
        Off unless you turn it on. You can change this later in Settings.
      </Body>
      <Button label="Continue" icon={ArrowRight} onPress={onNext} />
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
      <StepHero
        icon={BatteryCharging}
        title="Keep capture running"
        text="Some phones stop apps in the background to save battery, and payments made then would be missed. This takes a minute."
      />
      <BatteryGuideContent />
      <Button label="I've done this" icon={CircleCheck} onPress={done} />
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
      <StepHero
        icon={FingerprintPattern}
        title="Lock the app"
        text="Your spending is private. Require your fingerprint, face or phone PIN to open the app."
      />
      {available === false && (
        <Body muted center>
          Set a screen lock on your phone first to use app lock. You can turn it
          on later in Settings.
        </Body>
      )}
      <Button
        label="Turn on app lock"
        icon={FingerprintPattern}
        onPress={() => finish(true)}
        disabled={!available}
        busy={busy}
      />
      <Button
        label="Not now"
        variant="ghost"
        onPress={() => finish(false)}
        disabled={busy}
      />
      <Body muted center>
        Tip: make a small UPI payment to see your first expense appear in the
        Inbox.
      </Body>
    </>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  dot: { flex: 1, height: 5, borderRadius: radius.pill },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  heroRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroTitle: { textAlign: 'center', marginBottom: spacing.sm },
  heroText: { textAlign: 'center', paddingHorizontal: spacing.md },
});
