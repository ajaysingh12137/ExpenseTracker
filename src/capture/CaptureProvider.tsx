import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

export type ReconnectResult = {
  connected: boolean;
  /** Why it failed, so the UI can suggest the right next step. */
  reason?: 'no_access' | 'power_save' | 'unknown';
};

type CaptureStatus = {
  permissionGranted: boolean | null;
  captureEnabled: boolean | null;
  /** False when Android (or an OEM battery manager) has unbound the listener. */
  listenerConnected: boolean | null;
  /** True while a reconnect attempt is in progress. */
  reconnecting: boolean;
  openSettings: () => void;
  refresh: () => void;
  /**
   * Asks Android to rebind the listener and waits (up to RECONNECT_TIMEOUT_MS) for it to come
   * back. Resolves with the outcome so callers can tell the user what happened.
   */
  reconnect: () => Promise<ReconnectResult>;
};

const CaptureContext = createContext<CaptureStatus>({
  permissionGranted: null,
  captureEnabled: null,
  listenerConnected: null,
  reconnecting: false,
  openSettings: () => {},
  refresh: () => {},
  reconnect: async () => ({ connected: false, reason: 'unknown' }),
});

/** Android usually rebinds within a second or two; give slow/OEM devices more room. */
const RECONNECT_TIMEOUT_MS = 8000;
const POLL_MS = 500;
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), ms));

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
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectingRef = useRef(false);

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

  /** Rebind, then poll until the listener reports connected or we time out. */
  const reconnect = useCallback(async (): Promise<ReconnectResult> => {
    if (reconnectingRef.current) {
      return { connected: false, reason: 'unknown' };
    }
    reconnectingRef.current = true;
    setReconnecting(true);
    try {
      const before = await getCaptureHealth();
      if (!before?.permissionGranted) {
        setListenerConnected(false);
        return { connected: false, reason: 'no_access' };
      }
      if (before.listenerConnected) {
        setListenerConnected(true);
        return { connected: true };
      }
      await rebindListener();
      const deadline = Date.now() + RECONNECT_TIMEOUT_MS;
      let last = before;
      while (Date.now() < deadline) {
        await sleep(POLL_MS);
        last = (await getCaptureHealth()) ?? last;
        if (last.listenerConnected) {
          setListenerConnected(true);
          return { connected: true };
        }
      }
      setListenerConnected(false);
      return {
        connected: false,
        reason: last.powerSaveMode ? 'power_save' : 'unknown',
      };
    } catch {
      return { connected: false, reason: 'unknown' };
    } finally {
      reconnectingRef.current = false;
      setReconnecting(false);
    }
  }, []);

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
        // Silent self-heal: access granted but the listener was unbound behind our back.
        // The banner only appears if this attempt fails, so it doesn't flash on every launch.
        if (health.permissionGranted && !health.listenerConnected) {
          reconnect().catch(() => {});
        } else {
          setListenerConnected(health.listenerConnected);
        }
      })
      .catch(() => {});
  }, [capture, reconnect]);

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
      reconnecting,
      openSettings: () => {
        capture.openSettings();
      },
      refresh,
      reconnect,
    }),
    [
      capture,
      captureEnabled,
      listenerConnected,
      reconnecting,
      refresh,
      reconnect,
    ],
  );

  return (
    <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>
  );
}
