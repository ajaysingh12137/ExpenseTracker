import { AI_PARSE_PUBLIC_KEY, AI_PARSE_URL, AI_TIMEOUT_MS } from '../config';
import { parseRupeesToPaise } from '../domain/money';
import type { ParsedTransaction } from '../domain/types';

export const isAiEnabled = (): boolean => AI_PARSE_URL.length > 0;

/**
 * Removes what the model does not need before text leaves the phone: long digit runs (account,
 * card, phone and reference numbers) keep only their last 4 digits; email addresses are dropped.
 * Person names cannot be removed reliably without breaking merchant extraction, which is why the
 * disclosure screen says unparsed text is sent to the server.
 */
export function redactForAi(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(
      /(^|[^\d.,])(\d{6,})(?![\d.,])/g,
      (_match, lead: string, digits: string) => `${lead}XX${digits.slice(-4)}`,
    )
    .replace(/\s+/g, ' ')
    .trim();
}

const DIRECTIONS = new Set(['debit', 'credit']);

/**
 * Strict validation of the backend's JSON. Anything off-schema is rejected rather than coerced,
 * so a malformed model answer can never become a transaction.
 */
export function validateAiResult(
  value: unknown,
  now: number = Date.now(),
): ParsedTransaction | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const v = value as Record<string, unknown>;
  if (v.is_transaction === false) {
    return null;
  }

  const amount = typeof v.amount === 'number' ? v.amount.toFixed(2) : v.amount;
  if (typeof amount !== 'string') {
    return null;
  }
  const amountPaise = parseRupeesToPaise(amount);
  if (amountPaise === null || amountPaise <= 0) {
    return null;
  }
  if (typeof v.direction !== 'string' || !DIRECTIONS.has(v.direction)) {
    return null;
  }
  const confidence = typeof v.confidence === 'number' ? v.confidence : NaN;
  if (!(confidence >= 0 && confidence <= 1)) {
    return null;
  }

  const merchant =
    typeof v.merchant === 'string' && v.merchant.trim().length > 0
      ? v.merchant.trim().slice(0, 60)
      : null;

  let occurredAt: number | null = null;
  if (typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
    const [y, m, d] = v.date.split('-').map(Number);
    const ms = new Date(y, m - 1, d, 12).getTime();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    if (ms <= now + 2 * 24 * 60 * 60 * 1000 && ms >= now - sixtyDays) {
      occurredAt = ms;
    }
  }

  return {
    amountPaise,
    direction: v.direction as ParsedTransaction['direction'],
    merchantRaw: merchant,
    accountHint: null,
    occurredAt,
    confidence,
    categoryGuess: typeof v.category === 'string' ? v.category : null,
  };
}

export type AiOutcome =
  | { kind: 'parsed'; result: ParsedTransaction }
  | { kind: 'not_transaction' }
  | { kind: 'unavailable' };

/** Never throws: network or server problems come back as 'unavailable' and are retried later. */
export async function parseWithAi(
  title: string,
  body: string,
  categoryIds: ReadonlyArray<string>,
  installId: string,
): Promise<AiOutcome> {
  if (!isAiEnabled()) {
    return { kind: 'unavailable' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Random per-install id for the backend's rate limit; not linked to the user or device.
      'x-install-id': installId,
    };
    if (AI_PARSE_PUBLIC_KEY) {
      headers.apikey = AI_PARSE_PUBLIC_KEY;
      headers.Authorization = `Bearer ${AI_PARSE_PUBLIC_KEY}`;
    }
    const response = await fetch(AI_PARSE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: redactForAi(`${title}. ${body}`),
        categories: categoryIds,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { kind: 'unavailable' };
    }
    const json: unknown = await response.json();
    if (
      typeof json === 'object' &&
      json !== null &&
      (json as { is_transaction?: unknown }).is_transaction === false
    ) {
      return { kind: 'not_transaction' };
    }
    const result = validateAiResult(json);
    return result ? { kind: 'parsed', result } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
