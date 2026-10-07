import { parseRupeesToPaise } from '../domain/money';
import type { Direction } from '../domain/types';

export type VoiceDraft = {
  amountPaise: number | null;
  direction: Direction;
  merchant: string | null;
};

const CREDIT_WORDS = /\b(received|got|earned|credited|salary|refund)\b/i;
const AMOUNT =
  /(?:₹|\brs\.?|\brupees?\b|\binr\b)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:₹|rs\.?|rupees?|inr|bucks)?/i;
const MERCHANT =
  /\b(?:at|to|from|for|on)\s+([a-z0-9][a-z0-9 &'.-]{1,40}?)(?:\s+(?:for|on|at|today|yesterday|using|via|by)\b|[.,]|$)/i;

/**
 * Best-effort reading of a spoken expense such as "spent 250 on chai at Ramesh stall" or
 * "received 5000 from Amit". The user always reviews the result before saving.
 */
export function parseVoiceText(text: string): VoiceDraft {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const amountMatch = AMOUNT.exec(cleaned);
  const amountPaise = amountMatch ? parseRupeesToPaise(amountMatch[1]) : null;
  const direction: Direction = CREDIT_WORDS.test(cleaned) ? 'credit' : 'debit';

  // Prefer the place after "at"/"to"/"from" over the item after "for"/"on".
  const preferred =
    /\b(?:at|to|from)\s+([a-z0-9][a-z0-9 &'.-]{1,40}?)(?:\s+(?:for|on|today|yesterday|using|via|by)\b|[.,]|$)/i.exec(
      cleaned,
    );
  const fallback = MERCHANT.exec(cleaned);
  const raw = (preferred ?? fallback)?.[1]?.trim() ?? null;
  const merchant =
    raw && !/^\d/.test(raw) ? raw.replace(/\b\w/g, c => c.toUpperCase()) : null;

  return {
    amountPaise: amountPaise && amountPaise > 0 ? amountPaise : null,
    direction,
    merchant,
  };
}
