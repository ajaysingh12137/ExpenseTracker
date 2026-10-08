import { Platform } from 'react-native';
import type { EventSubscription } from 'react-native';
import type {
  CaptureConfig,
  CaptureHealth,
  CaptureSourceStat,
  PendingTransactionNotification,
  Spec,
} from '../../specs/NativeTransactionCapture';

export type {
  CaptureConfig,
  CaptureHealth,
  CaptureSourceStat,
  PendingTransactionNotification,
};

/** Saves items to the app's own DB. Must resolve only after the write is durable. */
export type PersistFn = (
  items: ReadonlyArray<PendingTransactionNotification>,
) => Promise<void>;

// Android-only module: load lazily so importing this file on iOS does not throw.
let nativeModule: Spec | null | undefined;
function native(): Spec | null {
  if (nativeModule === undefined) {
    nativeModule =
      Platform.OS === 'android'
        ? require('../../specs/NativeTransactionCapture').default
        : null;
  }
  return nativeModule ?? null;
}

export const isSupported = (): boolean => native() !== null;

export async function isPermissionGranted(): Promise<boolean> {
  return (await native()?.isPermissionGranted()) ?? false;
}

export async function openPermissionSettings(): Promise<boolean> {
  return (await native()?.openPermissionSettings()) ?? false;
}

export async function getPending(
  limit = 100,
): Promise<ReadonlyArray<PendingTransactionNotification>> {
  return (await native()?.getPending(limit)) ?? [];
}

export async function acknowledge(ids: ReadonlyArray<number>): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  return (await native()?.acknowledge(ids)) ?? 0;
}

export async function setAllowedPackages(
  packages: ReadonlyArray<string>,
): Promise<void> {
  await native()?.setAllowedPackages(packages);
}

export async function setSmsPackages(
  packages: ReadonlyArray<string>,
): Promise<void> {
  await native()?.setSmsPackages(packages);
}

export async function setSmsAppsEnabled(enabled: boolean): Promise<void> {
  await native()?.setSmsAppsEnabled(enabled);
}

export async function setCaptureEnabled(enabled: boolean): Promise<void> {
  await native()?.setCaptureEnabled(enabled);
}

export async function getCaptureConfig(): Promise<CaptureConfig | null> {
  return (await native()?.getCaptureConfig()) ?? null;
}

export async function getCaptureHealth(): Promise<CaptureHealth | null> {
  return (await native()?.getCaptureHealth()) ?? null;
}

export async function resetCaptureStats(): Promise<void> {
  await native()?.resetCaptureStats();
}

export async function rebindListener(): Promise<boolean> {
  return (await native()?.rebindListener()) ?? false;
}

export async function resetCaptureConfig(): Promise<void> {
  await native()?.resetCaptureConfig();
}

/** Payload-free "new item queued" signal. Use it only to trigger drainQueue(). */
export function onCaptured(listener: () => void): EventSubscription | null {
  return native()?.onCaptured(listener) ?? null;
}

// Single-flight drain shared by every caller in the JS runtime. A request that arrives while
// a drain is running sets `rerunRequested`, so items queued mid-drain are picked up without
// a second concurrent reader.
let inFlight: Promise<number> | null = null;
let rerunRequested = false;

/**
 * Fetch -> persist -> acknowledge, in batches, until the native queue is empty.
 * Resolves with the number of items acknowledged.
 *
 * If the app dies between persist and acknowledge, the same items are returned next time.
 * Make `persist` idempotent by upserting on `id` (native ids are never reused).
 */
export function drainQueue(
  persist: PersistFn,
  batchSize = 100,
): Promise<number> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    let total = 0;
    try {
      do {
        rerunRequested = false;
        for (;;) {
          const items = await getPending(batchSize);
          if (items.length === 0) {
            break;
          }
          await persist(items);
          const deleted = await acknowledge(items.map(item => item.id));
          total += deleted;
          // Stop if nothing was deleted, so a misbehaving queue can't make this loop forever.
          if (deleted === 0 || items.length < batchSize) {
            break;
          }
        }
      } while (rerunRequested);
      return total;
    } finally {
      inFlight = null;
      rerunRequested = false;
    }
  })();
  return inFlight;
}
