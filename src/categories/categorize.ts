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
  return inputs.direction === 'credit' ? INCOME : UNCATEGORIZED;
}

export function keywordCategory(normalizedMerchant: string): string | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(normalizedMerchant)) {
      return rule.categoryId;
    }
  }
  return null;
}
