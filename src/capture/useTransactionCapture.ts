import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import type {AppStateStatus} from 'react-native';
import {
  drainQueue,
  isPermissionGranted,
  isSupported,
  onCaptured,
  openPermissionSettings,
} from './transactionCapture';
import type {PersistFn} from './transactionCapture';

type Options = {
  /** Saves a batch to the app DB. Upsert on item.id so a retried batch is harmless. */
  persist: PersistFn;
  batchSize?: number;
  /** Set false to pause draining (e.g. before onboarding/consent is complete). */
  enabled?: boolean;
  onError?: (error: unknown) => void;
};

type Result = {
  supported: boolean;
  /** null until the first check completes. */
  permissionGranted: boolean | null;
  refreshPermission: () => Promise<boolean>;
  openSettings: () => Promise<boolean>;
  /** Drain now. Safe to call any time; concurrent calls share one drain. */
  drain: () => Promise<number>;
  lastDrainCount: number;
};

export function useTransactionCapture({
  persist,
  batchSize = 100,
  enabled = true,
  onError,
}: Options): Result {
  const supported = isSupported();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [lastDrainCount, setLastDrainCount] = useState(0);

  // Refs so the effects below don't resubscribe when callers pass inline functions.
  const persistRef = useRef(persist);
  const onErrorRef = useRef(onError);
  persistRef.current = persist;
  onErrorRef.current = onError;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshPermission = useCallback(async () => {
    const granted = supported ? await isPermissionGranted() : false;
    if (mounted.current) {
      setPermissionGranted(granted);
    }
    return granted;
  }, [supported]);

  const drain = useCallback(async () => {
    if (!supported) {
      return 0;
    }
    try {
      const count = await drainQueue(items => persistRef.current(items), batchSize);
      if (mounted.current) {
        setLastDrainCount(count);
      }
      return count;
    } catch (error) {
      onErrorRef.current?.(error);
      return 0;
    }
  }, [supported, batchSize]);

  useEffect(() => {
    if (!supported) {
      setPermissionGranted(false);
      return;
    }

    refreshPermission().catch(error => onErrorRef.current?.(error));
    if (!enabled) {
      return;
    }

    // Drain on mount: picks up everything captured while JS wasn't running.
    drain();

    // Live events are only a trigger; the queue is the single source of items.
    const subscription = onCaptured(() => {
      drain();
    });

    let previous: AppStateStatus | null = AppState.currentState as AppStateStatus | null;
    const appStateSub = AppState.addEventListener('change', next => {
      if (previous !== 'active' && next === 'active') {
        // The user may have just come back from the notification-access screen.
        refreshPermission().catch(error => onErrorRef.current?.(error));
        drain();
      }
      previous = next;
    });

    return () => {
      subscription?.remove();
      appStateSub.remove();
    };
  }, [supported, enabled, drain, refreshPermission]);

  const openSettings = useCallback(() => openPermissionSettings(), []);

  return {
    supported,
    permissionGranted,
    refreshPermission,
    openSettings,
    drain,
    lastDrainCount,
  };
}
