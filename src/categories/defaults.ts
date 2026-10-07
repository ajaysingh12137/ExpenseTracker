import type { Category } from '../domain/types';

export const UNCATEGORIZED = 'uncategorized';
export const INCOME = 'income';

export const DEFAULT_CATEGORIES: ReadonlyArray<Category> = [
  { id: 'food', name: 'Food & dining', icon: '🍽️', isDefault: true },
  { id: 'groceries', name: 'Groceries', icon: '🛒', isDefault: true },
  { id: 'transport', name: 'Transport', icon: '🚕', isDefault: true },
  { id: 'fuel', name: 'Fuel', icon: '⛽', isDefault: true },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', isDefault: true },
  { id: 'bills', name: 'Bills & utilities', icon: '💡', isDefault: true },
  { id: 'recharge', name: 'Mobile & internet', icon: '📶', isDefault: true },
  { id: 'rent', name: 'Rent & housing', icon: '🏠', isDefault: true },
  { id: 'health', name: 'Health', icon: '💊', isDefault: true },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', isDefault: true },
  { id: 'travel', name: 'Travel', icon: '✈️', isDefault: true },
  { id: 'education', name: 'Education', icon: '📚', isDefault: true },
  { id: 'transfers', name: 'Transfers', icon: '🔁', isDefault: true },
  { id: INCOME, name: 'Income', icon: '💰', isDefault: true },
  { id: UNCATEGORIZED, name: 'Uncategorized', icon: '❓', isDefault: true },
];

/**
 * Keyword fallback used only when the user has no override and the merchant has no default.
 * Matched against the normalized merchant name. Brand names here are examples of common Indian
 * merchants; extend from real captures.
 */
export const KEYWORD_RULES: ReadonlyArray<{
  categoryId: string;
  pattern: RegExp;
}> = [
  {
    categoryId: 'food',
    pattern:
      /\b(swiggy|zomato|restaurant|cafe|caf[eé]|dhaba|pizza|burger|kitchen|eats|food|bakery|chai|biryani)\b/,
  },
  {
    categoryId: 'groceries',
    pattern:
      /\b(blinkit|zepto|bigbasket|big basket|dmart|grocer(y|ies)|kirana|supermarket|mart|instamart|jiomart)\b/,
  },
  {
    categoryId: 'transport',
    pattern:
      /\b(uber|ola|rapido|metro|irctc|redbus|fastag|parking|auto|cab|taxi)\b/,
  },
  {
    categoryId: 'fuel',
    pattern:
      /\b(petrol|diesel|fuel|hpcl|bpcl|iocl|indian oil|bharat petroleum|hp petrol|shell)\b/,
  },
  {
    categoryId: 'shopping',
    pattern:
      /\b(amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|store|retail|fashion)\b/,
  },
  {
    categoryId: 'bills',
    pattern:
      /\b(electricity|bescom|tata power|adani|water|gas|bill ?desk|billdesk|bbps|insurance|lic)\b/,
  },
  {
    categoryId: 'recharge',
    pattern:
      /\b(airtel|jio|vodafone|vi|bsnl|recharge|broadband|act fibernet|dth|tata play)\b/,
  },
  {
    categoryId: 'rent',
    pattern: /\b(rent|nobroker|housing|maintenance|society)\b/,
  },
  {
    categoryId: 'health',
    pattern:
      /\b(pharmacy|apollo|medplus|1mg|pharmeasy|netmeds|hospital|clinic|diagnostic|lab)\b/,
  },
  {
    categoryId: 'entertainment',
    pattern:
      /\b(netflix|hotstar|prime video|spotify|bookmyshow|pvr|inox|youtube|gaming)\b/,
  },
  {
    categoryId: 'travel',
    pattern:
      /\b(makemytrip|goibibo|cleartrip|indigo|air india|akasa|vistara|hotel|oyo|airbnb|yatra)\b/,
  },
  {
    categoryId: 'education',
    pattern:
      /\b(school|college|university|udemy|coursera|byju|unacademy|tuition|fees)\b/,
  },
];
