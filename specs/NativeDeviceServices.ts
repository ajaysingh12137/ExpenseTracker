import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** True if the device has a biometric or a screen lock the app lock can use. */
  canUseAppLock(): Promise<boolean>;
  /** Shows the system biometric / device-PIN prompt. Resolves false on cancel or failure. */
  authenticate(title: string, subtitle: string): Promise<boolean>;
  /**
   * Opens the system speech-recognition dialog. Resolves with the best transcript, or null if
   * the user cancelled. Rejects with E_NO_RECOGNIZER if the device has no speech service.
   */
  startVoiceInput(prompt: string): Promise<string | null>;
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  /** Opens the battery-optimization list; resolves false if no settings screen could open. */
  openBatteryOptimizationSettings(): Promise<boolean>;
  openAppDetailsSettings(): Promise<boolean>;
  /** Build.MANUFACTURER, lowercased (e.g. "xiaomi", "samsung"). */
  getManufacturer(): Promise<string>;
  /** Releases the native launch splash once the first JS screen is ready. */
  hideSplash(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceServices');
