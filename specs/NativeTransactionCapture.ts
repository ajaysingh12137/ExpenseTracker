import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type PendingTransactionNotification = {
  /** Native queue row id. Pass back to acknowledge() once persisted. */
  id: number;
  /** Stable hash of the notification; unique in the JS database. */
  dedupKey: string;
  packageName: string;
  title: string;
  body: string;
  /** StatusBarNotification post time, epoch ms. */
  postedAt: number;
  /** Time the listener stored the item, epoch ms. */
  capturedAt: number;
};

export type CaptureConfig = {
  /** Bank and UPI app package names. */
  packages: ReadonlyArray<string>;
  /** SMS app package names, only used when smsAppsEnabled is true. */
  smsPackages: ReadonlyArray<string>;
  smsAppsEnabled: boolean;
  /** Master switch; false until the user accepts the in-app disclosure. */
  captureEnabled: boolean;
};

export interface Spec extends TurboModule {
  isPermissionGranted(): Promise<boolean>;
  /** Resolves true if some settings screen was opened. */
  openPermissionSettings(): Promise<boolean>;
  getPending(
    limit: number,
  ): Promise<ReadonlyArray<PendingTransactionNotification>>;
  /** Resolves with the number of rows deleted. */
  acknowledge(ids: ReadonlyArray<number>): Promise<number>;
  setAllowedPackages(packages: ReadonlyArray<string>): Promise<void>;
  setSmsPackages(packages: ReadonlyArray<string>): Promise<void>;
  setSmsAppsEnabled(enabled: boolean): Promise<void>;
  setCaptureEnabled(enabled: boolean): Promise<void>;
  getCaptureConfig(): Promise<CaptureConfig>;
  resetCaptureConfig(): Promise<void>;

  /** Fired after a new item is queued while JS is running. Payload-free: drain to read it. */
  readonly onCaptured: CodegenTypes.EventEmitter<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TransactionCapture');
