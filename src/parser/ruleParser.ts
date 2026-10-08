import { parseRupeesToPaise } from '../domain/money';
import type { Direction, ParsedTransaction } from '../domain/types';

/**
 * On-device rule parser for Indian bank / UPI alert text.
 *
 * The patterns target common phrasing ("Rs.500 debited from a/c XX1234", "Paid ₹249 to X",
 * "credited with INR 1,000") and were written against synthetic samples, not real bank
 * messages. Replace and extend them using redacted real samples (see docs/ROADMAP.md Phase 1).
 *
 * Bump PARSER_VERSION whenever behaviour changes; raw captures parsed with an older version
 * can then be re-parsed.
 */
export const PARSER_VERSION = 3;

/** Below this the result is treated as unparsed and handed to the AI fallback. */
export const CONFIDENCE_FLOOR = 0.75;

const AMOUNT = /(?:₹|\bRs\.?|\bINR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

// Some bank SMS omit the currency: "A/C X1234 debited by 1.0 on date 07Oct26".
const VERB_AMOUNT =
  /\b(?:debited|credited|paid|sent|received|spent|withdrawn|transferred|deposited)\s+(?:by|for|of|with)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/i;

// Payment reference: UPI Ref / RRN / UTR / Txn ID. Must contain at least 6 digits so words like
// "UPI user" or a VPA never qualify.
const REFERENCE =
  /\b(?:UPI\s*(?:Ref(?:erence)?|txn|transaction)?\s*(?:No\.?|ID|#|number)?|Ref(?:erence)?\s*(?:No\.?|ID|#|number)?|Refno|RRN|UTR|Txn\s*(?:ID|No\.?|#))\s*[:.#-]?\s*([A-Za-z0-9]{6,24})/gi;

// Amounts that describe state, not the transaction itself.
const NON_TXN_AMOUNT_CONTEXT =
  /(avl\.?|avail(able)?|bal(ance)?|limit|outstanding|min(imum)?\.?\s*(amt|amount)?\s*due|total\s*due)\W{0,6}(is|of)?\W{0,3}$/i;

// Whole-message signals that this is not a completed transaction.
const NOT_A_TRANSACTION = [
  /\b(is|are)\s+due\b|\bdue\s+(date|on|by)\b|\bpayment\s+reminder\b/i,
  /\b(has\s+)?requested\s+(money|₹|rs|inr)|\bcollect\s+request\b|\bpayment\s+request\b/i,
  /\b(failed|declined|unsuccessful|reversed?\s+pending)\b/i,
];

// Promotions: an offer word together with an "up to / win / valid till" qualifier, in any order.
// A real "cashback of Rs 10 credited" has the first but not the second.
const PROMO_OFFER =
  /\b(cashback|rewards?|offer|discount|coupon)\b|\d+\s?%\s?off\b/i;
const PROMO_QUALIFIER =
  /\b(up\s?to|upto|win|valid\s+(till|until|today|on)|use\s+code|t&c)\b/i;

function isPromotion(text: string): boolean {
  return PROMO_OFFER.test(text) && PROMO_QUALIFIER.test(text);
}

const DEBIT_WORDS =
  /\b(debited|spent|withdrawn|paid|sent|purchase[d]?|debit(ed)?|transferred\s+to|payment\s+of|charged|used\s+for)\b/i;
const CREDIT_WORDS =
  /\b(credited|received|deposited|refund(ed)?|reversal|cashback\s+(of|credited)|credit(ed)?)\b/i;
const REFUND_WORDS = /\b(refund(ed)?|reversal|reversed)\b/i;

const ACCOUNT_HINT =
  /\b(?:a\/c|acct|account|card)\s*(?:no\.?|number|ending(?:\s+with)?)?\s*[:#-]?\s*(?:[x*•]+\s*)?(\d{3,4})\b/i;

const MERCHANT_PATTERNS: Array<{ re: RegExp; direction?: Direction }> = [
  // "trf to MERCHANT Refno 123" (common SBI-style wording)
  {
    re: /\btrf\s+to\s+([A-Za-z0-9][A-Za-z0-9 &.'_-]{1,40}?)(?=\s+(?:on|via|ref\w*|rrn|utr|upi)\b|[.,;(]|$)/i,
    direction: 'debit',
  },
  { re: /\bto\s+VPA\s+([a-z0-9._-]+@[a-z0-9.]+)/i, direction: 'debit' },
  { re: /\bfrom\s+VPA\s+([a-z0-9._-]+@[a-z0-9.]+)/i, direction: 'credit' },
  {
    re: /\b(?:info|ref(?:erence)?\s*info)\s*[:-]\s*([A-Za-z0-9 &.'_/-]{2,40})/i,
  },
  {
    re: /\b(?:paid|sent|transferred|payment)\b.{0,40}?\bto\s+([A-Za-z0-9][A-Za-z0-9 &.'_-]{1,40}?)(?=\s+(?:on|via|using|ref|upi|from|for|at)\b|[.,;(]|$)/i,
    direction: 'debit',
  },
  {
    re: /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'_-]{1,40}?)(?=\s+(?:on|via|using|ref|upi|for)\b|[.,;(]|$)/i,
    direction: 'debit',
  },
  {
    re: /\b(?:received|credited)\b.{0,60}?\bfrom\s+([A-Za-z0-9][A-Za-z0-9 &.'_-]{1,40}?)(?=\s+(?:on|via|using|ref|upi|to|in)\b|[.,;(]|$)/i,
    direction: 'credit',
  },
  {
    re: /\bto\s+([A-Za-z0-9][A-Za-z0-9 &.'_-]{1,40}?)(?=\s+(?:on|via|using|ref|upi)\b|[.,;(]|$)/i,
    direction: 'debit',
  },
];

// Captured "merchant" text that is really part of the account/bank sentence.
const MERCHANT_STOPWORDS =
  /^(your|you|a\/c|acct|account|card|beneficiary|the|bank|wallet|self|upi|ref|xx\d+|\d+)$/i;

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function findTransactionAmount(text: string): number | null {
  AMOUNT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT.exec(text)) !== null) {
    const before = text.slice(Math.max(0, match.index - 30), match.index);
    if (NON_TXN_AMOUNT_CONTEXT.test(before)) {
      continue;
    }
    const paise = parseRupeesToPaise(match[1]);
    if (paise !== null && paise > 0) {
      return paise;
    }
  }
  const verb = VERB_AMOUNT.exec(text);
  if (verb) {
    const paise = parseRupeesToPaise(verb[1]);
    if (paise !== null && paise > 0) {
      return paise;
    }
  }
  return null;
}

/** Normalized payment reference, or null. Same payment, same reference across apps. */
export function findReference(text: string): string | null {
  REFERENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REFERENCE.exec(text)) !== null) {
    const candidate = match[1].toUpperCase();
    if ((candidate.match(/\d/g) ?? []).length >= 6) {
      return candidate;
    }
  }
  return null;
}

function findDirection(rawText: string): Direction | null {
  // "Credit Card" / "Debit Card" name the instrument, not the direction.
  const text = rawText.replace(/\b(credit|debit)\s+card\b/gi, 'card');
  if (REFUND_WORDS.test(text)) {
    return 'credit';
  }
  const debit = DEBIT_WORDS.exec(text);
  const credit = CREDIT_WORDS.exec(text);
  if (debit && credit) {
    // "debited from your a/c ... credited to VPA x" -> the first verb is about the user's account.
    return debit.index <= credit.index ? 'debit' : 'credit';
  }
  if (debit) {
    return 'debit';
  }
  if (credit) {
    return 'credit';
  }
  return null;
}

export function cleanMerchant(raw: string): string | null {
  let value = raw.trim();
  const vpa = /^([a-z0-9._-]+)@[a-z0-9.]+$/i.exec(value);
  if (vpa) {
    // "swiggy.stores@axb" -> "swiggy stores"; personal VPAs stay readable but unpaired from bank.
    value = vpa[1].replace(/[._-]+/g, ' ');
  }
  value = value
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:-]+$/, '')
    .trim();
  if (value.length < 2 || MERCHANT_STOPWORDS.test(value)) {
    return null;
  }
  return value;
}

function findMerchant(
  text: string,
  direction: Direction | null,
): string | null {
  for (const { re, direction: expected } of MERCHANT_PATTERNS) {
    if (expected && direction && expected !== direction) {
      continue;
    }
    const match = re.exec(text);
    if (match) {
      const merchant = cleanMerchant(match[1]);
      if (merchant) {
        return merchant;
      }
    }
  }
  return null;
}

function findAccountHint(text: string): string | null {
  const match = ACCOUNT_HINT.exec(text);
  if (!match) {
    return null;
  }
  return match[1].slice(-4);
}

function toYear(raw: string): number {
  const year = Number(raw);
  return raw.length === 2 ? 2000 + year : year;
}

/** Finds a dd-mm-yy(yy), dd/mm/yy(yy) or dd-Mon-yy(yy) date. Returns local noon epoch ms. */
export function findDate(
  text: string,
  now: number = Date.now(),
): number | null {
  const numeric = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(text);
  const named = /\b(\d{1,2})[-\s]?([A-Za-z]{3,4})[-\s,]*(\d{2}|\d{4})\b/.exec(
    text,
  );

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  if (named && MONTHS[named[2].toLowerCase()] !== undefined) {
    day = Number(named[1]);
    month = MONTHS[named[2].toLowerCase()];
    year = toYear(named[3]);
  } else if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
    year = toYear(numeric[3]);
  }
  if (day === null || month === null || year === null) {
    return null;
  }
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(year, month, day, 12, 0, 0, 0);
  if (date.getMonth() !== month) {
    return null; // e.g. 31-02
  }
  // Reject dates far from now: likely a reference number or due date that slipped through.
  const ms = date.getTime();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  if (ms > now + 2 * 24 * 60 * 60 * 1000 || ms < now - sixtyDays) {
    return null;
  }
  return ms;
}

/**
 * Returns null when the text is clearly not a completed transaction (bill reminder, collect
 * request, promo, failed payment). Otherwise returns a result whose confidence says whether the
 * rules understood it; callers send results below CONFIDENCE_FLOOR to the AI fallback.
 */
export function parseTransactionText(
  title: string,
  body: string,
  now: number = Date.now(),
): ParsedTransaction | null {
  const text = normalizeText(`${title}. ${body}`);
  if (NOT_A_TRANSACTION.some(re => re.test(text)) || isPromotion(text)) {
    return null;
  }

  const amountPaise = findTransactionAmount(text);
  const direction = findDirection(text);
  const merchantRaw = findMerchant(normalizeText(body) || text, direction);
  const accountHint = findAccountHint(text);
  const occurredAt = findDate(text, now);
  const reference = findReference(text);

  let confidence = 0;
  if (amountPaise !== null) {
    confidence += 0.5;
  }
  if (direction !== null) {
    confidence += 0.25;
  }
  if (merchantRaw !== null) {
    confidence += 0.15;
  }
  if (accountHint !== null) {
    confidence += 0.1;
  }

  return {
    amountPaise: amountPaise ?? 0,
    direction: direction ?? 'debit',
    merchantRaw,
    accountHint,
    occurredAt,
    confidence: Math.round(confidence * 100) / 100,
    reference,
  };
}
