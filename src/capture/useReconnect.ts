import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useCaptureStatus } from './CaptureProvider';

/**
 * Reconnect with user-facing feedback. The automatic reconnect is silent; when the user taps
 * "Reconnect" they always get an answer: success, or the exact next step that fixes it.
 */
export function useReconnectWithFeedback(
  options: {
    onOpenBatterySettings?: () => void;
  } = {},
) {
  const status = useCaptureStatus();
  const { onOpenBatterySettings } = options;

  const reconnect = useCallback(async () => {
    const result = await status.reconnect();
    if (result.connected) {
      Alert.alert(
        'Capture is back on',
        'Notch is listening for payments again.',
      );
      return;
    }
    if (result.reason === 'no_access') {
      Alert.alert(
        'Notification access is off',
        'Notch needs notification access to read payment alerts. Turn on "Notch" in the next screen.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: status.openSettings },
        ],
      );
      return;
    }
    const manualFix =
      'Open Notification access, turn "Notch" off, then on again. This always restarts capture.';
    if (result.reason === 'power_save') {
      Alert.alert(
        'Battery Saver is blocking capture',
        `Your phone is in Battery Saver mode, which stops apps in the background (common when the battery is low). Charge your phone or turn Battery Saver off, then try again.\n\n${manualFix}`,
        [
          { text: 'Close', style: 'cancel' },
          ...(onOpenBatterySettings
            ? [{ text: 'Battery settings', onPress: onOpenBatterySettings }]
            : []),
          { text: 'Notification access', onPress: status.openSettings },
        ],
      );
      return;
    }
    Alert.alert("Android didn't reconnect", manualFix, [
      { text: 'Close', style: 'cancel' },
      { text: 'Notification access', onPress: status.openSettings },
    ]);
  }, [status, onOpenBatterySettings]);

  return { reconnect, reconnecting: status.reconnecting };
}
