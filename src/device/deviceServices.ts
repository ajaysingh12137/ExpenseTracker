import { Platform } from 'react-native';
import type { Spec } from '../../specs/NativeDeviceServices';

let nativeModule: Spec | null | undefined;
function native(): Spec | null {
  if (nativeModule === undefined) {
    nativeModule =
      Platform.OS === 'android'
        ? require('../../specs/NativeDeviceServices').default
        : null;
  }
  return nativeModule ?? null;
}

export async function canUseAppLock(): Promise<boolean> {
  return (await native()?.canUseAppLock()) ?? false;
}

export async function authenticate(
  title: string,
  subtitle: string,
): Promise<boolean> {
  return (await native()?.authenticate(title, subtitle)) ?? false;
}

export type VoiceResult =
  | { kind: 'text'; text: string }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' };

export async function startVoiceInput(prompt: string): Promise<VoiceResult> {
  const mod = native();
  if (!mod) {
    return { kind: 'unavailable' };
  }
  try {
    const text = await mod.startVoiceInput(prompt);
    return text ? { kind: 'text', text } : { kind: 'cancelled' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  return (await native()?.isIgnoringBatteryOptimizations()) ?? false;
}

export async function openBatteryOptimizationSettings(): Promise<boolean> {
  return (await native()?.openBatteryOptimizationSettings()) ?? false;
}

export async function openAppDetailsSettings(): Promise<boolean> {
  return (await native()?.openAppDetailsSettings()) ?? false;
}

export function hideSplash(): void {
  native()?.hideSplash();
}

export async function getManufacturer(): Promise<string> {
  return (await native()?.getManufacturer()) ?? '';
}

/**
 * Per-OEM steps for keeping the listener alive. Menu names differ between OS versions and
 * regions; these are typical paths, not guaranteed ones (see dontkillmyapp.com for current ones).
 */
export function batterySteps(manufacturer: string): string[] {
  const m = manufacturer.toLowerCase();
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) {
    return [
      'App info → Autostart: turn on.',
      'App info → Battery saver: choose "No restrictions".',
      'In Recents, long-press this app and lock it so it is not cleared.',
    ];
  }
  if (m.includes('oppo') || m.includes('realme') || m.includes('oneplus')) {
    return [
      'App info → Battery usage: allow background activity and auto launch.',
      'Turn off battery optimization for this app.',
      'In Recents, lock this app so it is not cleared.',
    ];
  }
  if (m.includes('vivo') || m.includes('iqoo')) {
    return [
      'Settings → Battery → Background power consumption: allow this app.',
      'i Manager / Settings → Apps → Autostart: turn on for this app.',
      'In Recents, lock this app so it is not cleared.',
    ];
  }
  if (m.includes('samsung')) {
    return [
      'App info → Battery: choose "Unrestricted".',
      'Battery → Background usage limits: make sure this app is not in "Sleeping" or "Deep sleeping" apps.',
    ];
  }
  return [
    'Turn off battery optimization for this app so Android does not stop it in the background.',
  ];
}
