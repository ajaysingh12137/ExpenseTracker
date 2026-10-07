import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authenticate } from '../device/deviceServices';
import { useAppStore } from '../state/store';
import { Body, Button, Title } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

export function LockScreen() {
  const setUnlocked = useAppStore(s => s.setUnlocked);
  const [failed, setFailed] = useState(false);
  const t = useTheme();

  const unlock = useCallback(async () => {
    const ok = await authenticate(
      'Unlock ExpenseTracker',
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
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Title>🔒 Locked</Title>
      {failed && <Body muted>Not unlocked. Try again.</Body>}
      <Button label="Unlock" onPress={unlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.xl },
});
