import type { Direction } from '../domain/types';
import { INCOME, KEYWORD_RULES, UNCATEGORIZED } from './defaults';

/** Lowercase, strip punctuation and generic suffixes so "SWIGGY LTD." and "swiggy" match. */
export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(
      /\b(pvt|private|ltd|limited|llp|inc|india|technologies|tech|services|payments?|online|stores?)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export type CategoryInputs = {
  direction: Direction;
  normalizedMerchant: string | null;
  /** Payee as written; used to tell people from businesses (normalizing drops words like "store"). */
  merchantRaw?: string | null;
  /** The user's own correction for this merchant, if any. */
  overrideCategoryId: string | null;
  /** Category the merchant row was created with (from keywords or AI). */
  merchantDefaultCategoryId: string | null;
  /** Optional AI guess, only used if it names a known category. */
  aiGuess?: string | null;
  knownCategoryIds: ReadonlySet<string>;
};

/** Priority: user override > merchant default > keyword rule > AI guess > income/uncategorized. */
export function categorize(inputs: CategoryInputs): string {
  const {
    overrideCategoryId,
    merchantDefaultCategoryId,
    normalizedMerchant,
    aiGuess,
  } = inputs;
  if (overrideCategoryId && inputs.knownCategoryIds.has(overrideCategoryId)) {
    return overrideCategoryId;
  }
  if (
    merchantDefaultCategoryId &&
    inputs.knownCategoryIds.has(merchantDefaultCategoryId)
  ) {
    return merchantDefaultCategoryId;
  }
  const keyword = normalizedMerchant
    ? keywordCategory(normalizedMerchant)
    : null;
  if (keyword) {
    return keyword;
  }
  if (aiGuess && inputs.knownCategoryIds.has(aiGuess)) {
    return aiGuess;
  }
  if (inputs.direction === 'credit') {
    return INCOME;
  }
  const payee = (inputs.merchantRaw ?? normalizedMerchant ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9. ]+/g, ' ');
  if (
    payee.trim() &&
    looksLikePerson(payee) &&
    inputs.knownCategoryIds.has('transfers')
  ) {
    return 'transfers';
  }
  return UNCATEGORIZED;
}

// Words that mark a business; a payee containing one is never treated as a person.
const BUSINESS_HINT =
  /\b(store|stores|general|shop|mart|traders?|enterprises?|solutions|agency|cent(er|re)|bazaa?r|kirana|foods?|fashion|electronics?|motors?|medicals?|pharma|clinic|hospital|hotel|restaurant|cafe|bank|finance|insurance|school|college|academy|studio|salon|bakery|sweets|garage|petroleum|industries|corporation|corp|company|co)\b/;

/**
 * Person-to-person UPI payee: a phone-number UPI ID ("9876543210@ybl") or a plain 2-4 word name
 * ("ramesh kumar"). Business names usually contain a business word or match a keyword rule
 * first. A wrong guess is corrected once and then remembered for that payee.
 */
export function looksLikePerson(normalizedMerchant: string): boolean {
  const value = normalizedMerchant.trim();
  if (/^\+?\d{10,13}$/.test(value.replace(/\s+/g, ''))) {
    return true;
  }
  if (BUSINESS_HINT.test(value)) {
    return false;
  }
  const words = value.split(/\s+/).filter(Boolean);
  return (
    words.length >= 2 &&
    words.length <= 4 &&
    words.every(w => /^[a-z][a-z.]*$/.test(w) && w.length <= 15)
  );
}

export function keywordCategory(normalizedMerchant: string): string | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(normalizedMerchant)) {
      return rule.categoryId;
    }
  }
  return null;
}
