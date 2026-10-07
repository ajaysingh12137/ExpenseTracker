import { redactForAi, validateAiResult } from '../src/ai/aiFallback';
import { categorize, normalizeMerchant } from '../src/categories/categorize';
import { parseDayInput } from '../src/domain/dates';
import { formatPaise, parseRupeesToPaise } from '../src/domain/money';
import { parseVoiceText } from '../src/parser/voiceParser';

const NOW = new Date(2026, 9, 7, 15, 0).getTime();

describe('money', () => {
  test('parses rupee strings to integer paise', () => {
    expect(parseRupeesToPaise('1,23,456.7')).toBe(12345670);
    expect(parseRupeesToPaise('99.5')).toBe(9950);
    expect(parseRupeesToPaise('500')).toBe(50000);
    expect(parseRupeesToPaise('0.07')).toBe(7);
    expect(parseRupeesToPaise('abc')).toBeNull();
    expect(parseRupeesToPaise('1.234')).toBeNull();
  });

  test('formats with Indian digit grouping', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
    expect(formatPaise(50000)).toBe('₹500');
    expect(formatPaise(100)).toBe('₹1');
    expect(formatPaise(1234567800)).toBe('₹1,23,45,678');
    expect(formatPaise(-5050)).toBe('-₹50.50');
  });
});

describe('categorize', () => {
  const known = new Set([
    'food',
    'shopping',
    'income',
    'uncategorized',
    'groceries',
  ]);
  const base = {
    direction: 'debit' as const,
    overrideCategoryId: null,
    merchantDefaultCategoryId: null,
    knownCategoryIds: known,
  };

  test('user override wins over everything', () => {
    expect(
      categorize({
        ...base,
        normalizedMerchant: 'swiggy',
        overrideCategoryId: 'groceries',
        merchantDefaultCategoryId: 'food',
      }),
    ).toBe('groceries');
  });

  test('keyword rule, then fallback by direction', () => {
    expect(
      categorize({
        ...base,
        normalizedMerchant: normalizeMerchant('SWIGGY LTD.'),
      }),
    ).toBe('food');
    expect(categorize({ ...base, normalizedMerchant: 'ramesh kumar' })).toBe(
      'uncategorized',
    );
    expect(
      categorize({
        ...base,
        direction: 'credit',
        normalizedMerchant: 'ramesh kumar',
      }),
    ).toBe('income');
  });

  test('unknown AI guesses are ignored', () => {
    expect(
      categorize({ ...base, normalizedMerchant: null, aiGuess: 'crypto' }),
    ).toBe('uncategorized');
    expect(
      categorize({ ...base, normalizedMerchant: null, aiGuess: 'shopping' }),
    ).toBe('shopping');
  });
});

describe('AI fallback guards', () => {
  test('redacts long digit runs and emails, keeps amounts', () => {
    expect(
      redactForAi('a/c 123456789012 ref 98765 amt 1250000.00 mail a.b@x.com'),
    ).toBe('a/c XX9012 ref 98765 amt 1250000.00 mail [email]');
  });

  test('accepts a valid result', () => {
    const r = validateAiResult(
      {
        is_transaction: true,
        amount: '249.00',
        direction: 'debit',
        merchant: 'Swiggy',
        date: '2026-10-06',
        category: 'food',
        confidence: 0.9,
      },
      NOW,
    );
    expect(r).toMatchObject({
      amountPaise: 24900,
      direction: 'debit',
      merchantRaw: 'Swiggy',
      categoryGuess: 'food',
    });
    expect(r!.occurredAt).toBe(new Date(2026, 9, 6, 12).getTime());
  });

  test.each([
    [
      {
        is_transaction: true,
        amount: '-5',
        direction: 'debit',
        confidence: 0.9,
      },
    ],
    [
      {
        is_transaction: true,
        amount: '10',
        direction: 'sideways',
        confidence: 0.9,
      },
    ],
    [{ is_transaction: true, amount: '10', direction: 'debit', confidence: 3 }],
    [{ is_transaction: false }],
    ['not an object'],
    [null],
  ])('rejects malformed output %#', value => {
    expect(validateAiResult(value, NOW)).toBeNull();
  });

  test('drops implausible dates but keeps the transaction', () => {
    const r = validateAiResult(
      {
        is_transaction: true,
        amount: '10',
        direction: 'debit',
        merchant: null,
        date: '2019-01-01',
        category: null,
        confidence: 0.8,
      },
      NOW,
    );
    expect(r).not.toBeNull();
    expect(r!.occurredAt).toBeNull();
  });
});

describe('voice parser', () => {
  test('spent ... at ...', () => {
    expect(parseVoiceText('spent 250 on lunch at cafe coffee')).toEqual({
      amountPaise: 25000,
      direction: 'debit',
      merchant: 'Cafe Coffee',
    });
  });

  test('received ... from ...', () => {
    expect(parseVoiceText('received 5000 rupees from Amit')).toEqual({
      amountPaise: 500000,
      direction: 'credit',
      merchant: 'Amit',
    });
  });

  test('mis-heard prepositions still give a payee', () => {
    expect(parseVoiceText('250 online chat Cafe')).toEqual({
      amountPaise: 25000,
      direction: 'debit',
      merchant: 'Online Chat Cafe',
    });
  });

  test('no amount', () => {
    expect(parseVoiceText('bought vegetables').amountPaise).toBeNull();
  });
});

describe('dates', () => {
  test('parseDayInput keeps time of day and rejects invalid dates', () => {
    const keep = new Date(2026, 9, 7, 9, 30).getTime();
    expect(parseDayInput('05-10-2026', keep)).toBe(
      new Date(2026, 9, 5, 9, 30).getTime(),
    );
    expect(parseDayInput('31-02-2026', keep)).toBeNull();
    expect(parseDayInput('2026-10-05', keep)).toBeNull();
  });
});
