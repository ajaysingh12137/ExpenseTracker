import { getDb } from './database';

export const SettingKeys = {
  onboarded: 'onboarded',
  consentAt: 'consent_at',
  smsConsentAt: 'sms_consent_at',
  appLock: 'app_lock',
  parserVersion: 'parser_version',
  batteryStepDone: 'battery_step_done',
  installId: 'install_id',
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const result = await db.execute('SELECT value FROM settings WHERE key = ?', [
    key,
  ]);
  const value = result.rows[0]?.value;
  return typeof value === 'string' ? value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM settings WHERE key = ?', [key]);
}

/** Random id used only for the AI backend's per-install rate limit. */
export async function getInstallId(): Promise<string> {
  const existing = await getSetting(SettingKeys.installId);
  if (existing) {
    return existing;
  }
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  await setSetting(SettingKeys.installId, id);
  return id;
}
