import {
  Landmark,
  MessageSquareText,
  Smartphone,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

/**
 * Friendly names for capture sources. Package names mirror the (unverified) defaults in
 * CaptureConfig.kt; unknown packages fall back to the package name itself.
 */
const KNOWN: Record<string, { label: string; kind: 'upi' | 'bank' | 'sms' }> = {
  'com.google.android.apps.nbu.paisa.user': {
    label: 'Google Pay',
    kind: 'upi',
  },
  'com.phonepe.app': { label: 'PhonePe', kind: 'upi' },
  'net.one97.paytm': { label: 'Paytm', kind: 'upi' },
  'in.org.npci.upiapp': { label: 'BHIM', kind: 'upi' },
  'com.sbi.lotusintouch': { label: 'YONO SBI', kind: 'bank' },
  'com.csam.icici.bank.imobile': { label: 'ICICI iMobile', kind: 'bank' },
  'com.snapwork.hdfc': { label: 'HDFC Bank', kind: 'bank' },
  'com.axis.mobile': { label: 'Axis Mobile', kind: 'bank' },
  'com.msf.kbank.mobile': { label: 'Kotak', kind: 'bank' },
  'com.google.android.apps.messaging': {
    label: 'Bank SMS (Messages)',
    kind: 'sms',
  },
  'com.samsung.android.messaging': { label: 'Bank SMS (Samsung)', kind: 'sms' },
  'com.android.mms': { label: 'Bank SMS', kind: 'sms' },
};

const ICONS: Record<'upi' | 'bank' | 'sms' | 'other', LucideIcon> = {
  upi: Wallet,
  bank: Landmark,
  sms: MessageSquareText,
  other: Smartphone,
};

export function sourceLabel(packageName: string): string {
  return KNOWN[packageName]?.label ?? packageName;
}

export function sourceIcon(packageName: string): LucideIcon {
  return ICONS[KNOWN[packageName]?.kind ?? 'other'];
}
