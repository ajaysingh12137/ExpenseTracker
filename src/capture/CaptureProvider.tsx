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
import { getCaptureConfig } from './transactionCapture';
import type { PendingTransactionNotification } from './transactionCapture';
import { useTransactionCapture } from './useTransactionCapture';

type CaptureStatus = {
  permissionGranted: boolean | null;
  captureEnabled: boolean | null;
  openSettings: () => void;
  refresh: () => void;
};

const CaptureContext = createContext<CaptureStatus>({
  permissionGranted: null,
  captureEnabled: null,
  openSettings: () => {},
  refresh: () => {},
});

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
  }, [capture]);

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
      openSettings: () => {
        capture.openSettings();
      },
      refresh,
    }),
    [capture, captureEnabled, refresh],
  );

  return (
    <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>
  );
}
