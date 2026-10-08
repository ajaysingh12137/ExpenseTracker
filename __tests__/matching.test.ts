/**
 * Cross-source matching. Bank SMS + UPI app reporting the SAME payment must become one
 * transaction; two real payments of the same amount must stay two (PRD).
 */
import { findMatch, MATCH_WINDOW_MS } from '../src/pipeline/matching';
import type { MatchCandidate, MatchInput } from '../src/pipeline/matching';

const T = new Date(2026, 9, 8, 12, 0).getTime();
const SMS = 'com.google.android.apps.messaging';
const GPAY = 'com.google.android.apps.nbu.paisa.user';

const candidate = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: 1,
  amountPaise: 100,
  direction: 'debit',
  occurredAt: T,
  reference: null,
  status: 'draft',
  packages: [SMS],
  manual: false,
  ...over,
});

const input = (over: Partial<MatchInput> = {}): MatchInput => ({
  amountPaise: 100,
  direction: 'debit',
  occurredAt: T + 40_000,
  reference: null,
  packageName: GPAY,
  ...over,
});

describe('findMatch', () => {
  test('₹1 from bank SMS + the same ₹1 from the UPI app -> one transaction', () => {
    expect(findMatch(input(), [candidate()])).toEqual({
      id: 1,
      reason: 'cross_source',
    });
  });

  test('two ₹1 payments from the same app stay separate', () => {
    expect(findMatch(input({ packageName: SMS }), [candidate()])).toBeNull();
  });

  test('same reference matches even outside the time window and from the same app', () => {
    const c = candidate({
      reference: '412345678901',
      occurredAt: T - 2 * MATCH_WINDOW_MS,
    });
    expect(
      findMatch(input({ reference: '412345678901', packageName: SMS }), [c]),
    ).toEqual({ id: 1, reason: 'reference' });
  });

  test('different references are never the same payment', () => {
    const c = candidate({ reference: '412345678901' });
    expect(findMatch(input({ reference: '999999999999' }), [c])).toBeNull();
  });

  test('outside the window, different amount or direction -> no match', () => {
    expect(
      findMatch(input({ occurredAt: T + MATCH_WINDOW_MS + 1 }), [candidate()]),
    ).toBeNull();
    expect(findMatch(input({ amountPaise: 200 }), [candidate()])).toBeNull();
    expect(findMatch(input({ direction: 'credit' }), [candidate()])).toBeNull();
  });

  test('manual entries are never merged automatically', () => {
    expect(
      findMatch(input(), [candidate({ manual: true, packages: [] })]),
    ).toBeNull();
  });

  test('picks the closest in time when several qualify', () => {
    const far = candidate({ id: 1, occurredAt: T - 10 * 60_000 });
    const near = candidate({ id: 2, occurredAt: T + 30_000 });
    expect(findMatch(input(), [far, near])?.id).toBe(2);
  });

  test('a transaction already holding an alert from this app is skipped for the next one', () => {
    const both = candidate({ id: 1, packages: [SMS, GPAY] });
    const smsOnly = candidate({
      id: 2,
      packages: [SMS],
      occurredAt: T + 60_000,
    });
    expect(findMatch(input(), [both, smsOnly])?.id).toBe(2);
  });
});
