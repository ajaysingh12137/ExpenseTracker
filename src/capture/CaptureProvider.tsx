import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { persistCaptures } from '../db/repository';
import { processCaptures } from '../pipeline/processCaptures';
import {
  getCaptureConfig,
  getCaptureHealth,
  rebindListener,
} from './transactionCapture';
import type { PendingTransactionNotification } from './transactionCapture';
import { useTransactionCapture } from './useTransactionCapture';

type CaptureStatus = {
  permissionGranted: boolean | null;
  captureEnabled: boolean | null;
  /** False when Android (or an OEM battery manager) has unbound the listener. */
  listenerConnected: boolean | null;
  openSettings: () => void;
  refresh: () => void;
  /** Asks Android to reconnect the listener; refreshes status shortly after. */
  reconnect: () => Promise<void>;
};

const CaptureContext = createContext<CaptureStatus>({
  permissionGranted: null,
  captureEnabled: null,
  listenerConnected: null,
  openSettings: () => {},
  refresh: () => {},
  reconnect: async () => {},
});

/** How long Android usually takes to rebind after requestRebind (observed, not documented). */
const REBIND_SETTLE_MS = 1500;

export const useCaptureStatus = (): CaptureStatus => useContext(CaptureContext);

/**
 * Wires the native queue into the app: drain -> persist raw captures (durable, upsert on id,
 * unique dedup_key) -> acknowledge -> turn raw captures into drafts. Mounted only after
 * onboarding, so nothing is drained before the user has seen the disclosure.
 */
export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [captureEnabled, setCaptureEnabledState] = useState<boolean | null>(
    null,
  );
  const [listenerConnected, setListenerConnected] = useState<boolean | null>(
    null,
  );

  const persist = useCallback(
    async (items: ReadonlyArray<PendingTransactionNotification>) => {
      const config = await getCaptureConfig();
      await persistCaptures(items, new Set(config?.smsPackages ?? []));
      // Parsing runs after the batch is safely stored; errors here never block acknowledgement.
      processCaptures().catch(() => {});
    },
    [],
  );

  const capture = useTransactionCapture({ persist });

  const refresh = useCallback(() => {
    capture.refreshPermission().catch(() => {});
    getCaptureConfig()
      .then(config => setCaptureEnabledState(config?.captureEnabled ?? false))
      .catch(() => {});
    getCaptureHealth()
      .then(health => {
        if (!health) {
          return;
        }
        setListenerConnected(health.listenerConnected);
        // Silent self-heal: access granted but the listener was unbound behind our back.
        if (health.permissionGranted && !health.listenerConnected) {
          rebindListener()
            .then(
              () =>
                new Promise<void>(r => setTimeout(() => r(), REBIND_SETTLE_MS)),
            )
            .then(() => getCaptureHealth())
            .then(h => h && setListenerConnected(h.listenerConnected))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [capture]);

  const reconnect = useCallback(async () => {
    await rebindListener();
    await new Promise<void>(r => setTimeout(() => r(), REBIND_SETTLE_MS));
    const health = await getCaptureHealth();
    setListenerConnected(health?.listenerConnected ?? null);
  }, []);

  useEffect(() => {
    refresh();
    // Retries AI-pending captures and finishes any interrupted run.
    processCaptures().catch(() => {});
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
        processCaptures().catch(() => {});
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<CaptureStatus>(
    () => ({
      permissionGranted: capture.permissionGranted,
      captureEnabled,
      listenerConnected,
      openSettings: () => {
        capture.openSettings();
      },
      refresh,
      reconnect,
    }),
    [capture, captureEnabled, listenerConnected, refresh, reconnect],
  );

  return (
    <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>
  );
}
