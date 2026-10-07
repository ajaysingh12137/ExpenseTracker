import { FingerprintPattern, LockKeyhole } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authenticate } from '../device/deviceServices';
import { useAppStore } from '../state/store';
import { AppBackground, Button, GradientFill } from '../ui/components';
import { alpha, spacing, type, useTheme } from '../ui/theme';

export function LockScreen() {
  const setUnlocked = useAppStore(s => s.setUnlocked);
  const [failed, setFailed] = useState(false);
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const unlock = useCallback(async () => {
    const ok = await authenticate(
      'Unlock Notch',
      'Use your fingerprint, face or phone PIN',
    );
    if (ok) {
      setUnlocked(true);
    } else {
      setFailed(true);
    }
  }, [setUnlocked]);

  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <View style={styles.root}>
      <AppBackground />
      <View
        style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <View style={styles.center}>
          <View
            style={[styles.ring, { backgroundColor: alpha(t.primary, 0.12) }]}
          >
            <View
              style={[
                styles.circle,
                { boxShadow: `0 12px 30px ${alpha(t.primary, 0.4)}` },
              ]}
            >
              <GradientFill rounded={44} />
              <LockKeyhole size={42} color="#FFFFFF" strokeWidth={2} />
            </View>
          </View>
          <Text
            accessibilityRole="header"
            style={[type.title, { color: t.text }]}
          >
            Locked
          </Text>
          <Text style={[type.body, styles.text, { color: t.textMuted }]}>
            {failed
              ? 'Not unlocked. Try again.'
              : 'Your spending is protected. Unlock to continue.'}
          </Text>
        </View>
        <Button label="Unlock" icon={FingerprintPattern} onPress={unlock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: spacing.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { textAlign: 'center', marginTop: spacing.sm },
});
