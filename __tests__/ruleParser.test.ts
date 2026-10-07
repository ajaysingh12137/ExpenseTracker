/**
 * SYNTHETIC fixtures written for this test suite, modelled on common Indian alert phrasing.
 * They are not copies of real bank messages. Replace/extend with redacted real samples
 * (docs/ROADMAP.md Phase 1) before trusting parse-rate numbers.
 */
import {
  CONFIDENCE_FLOOR,
  findDate,
  parseTransactionText,
} from '../src/parser/ruleParser';

const NOW = new Date(2026, 9, 7, 15, 0).getTime(); // 7 Oct 2026, 3 pm local
const day = (y: number, m: number, d: number) =>
  new Date(y, m, d, 12).getTime();

describe('parseTransactionText', () => {
  test('UPI debit with VPA, account hint and numeric date', () => {
    const r = parseTransactionText(
      'Bank alert',
      'Rs.500.00 debited from a/c XX1234 on 07-10-26 to VPA shop.name@okaxis. UPI Ref 412345678901',
      NOW,
    );
    expect(r).toMatchObject({
      amountPaise: 50000,
      direction: 'debit',
      merchantRaw: 'shop name',
      accountHint: '1234',
      occurredAt: day(2026, 9, 7),
    });
    expect(r!.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
  });

  test('UPI app "Paid ₹X to Y"', () => {
    const r = parseTransactionText('PhonePe', 'Paid ₹249 to Swiggy', NOW);
    expect(r).toMatchObject({
      amountPaise: 24900,
      direction: 'debit',
      merchantRaw: 'Swiggy',
    });
    expect(r!.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
  });

  test('credit with payer name, ignores the balance amount', () => {
    const r = parseTransactionText(
      'Bank alert',
      'Your A/c XX5678 is credited with INR 1,250.50 on 05-Oct-2026 by UPI from RAMESH KUMAR. Avl Bal INR 10,000.00',
      NOW,
    );
    expect(r).toMatchObject({
      amountPaise: 125050,
      direction: 'credit',
      merchantRaw: 'RAMESH KUMAR',
      accountHint: '5678',
      occurredAt: day(2026, 9, 5),
    });
  });

  test('credit card spend is a debit even though the text says "Credit"', () => {
    const r = parseTransactionText(
      'Card alert',
      'Rs 1,999.00 spent on your Credit Card ending 4321 at AMAZON on 06/10/26',
      NOW,
    );
    expect(r).toMatchObject({
      amountPaise: 199900,
      direction: 'debit',
      merchantRaw: 'AMAZON',
      accountHint: '4321',
      occurredAt: day(2026, 9, 6),
    });
  });

  test('"used for" card alert without a debit verb', () => {
    const r = parseTransactionText(
      'Card alert',
      'Your Credit Card XX4321 was used for Rs 500 at Cafe Day.',
      NOW,
    );
    expect(r).toMatchObject({
      amountPaise: 50000,
      direction: 'debit',
      merchantRaw: 'Cafe Day',
    });
  });

  test('refund is a credit', () => {
    const r = parseTransactionText(
      'Bank alert',
      'Refund of Rs.120 credited to your a/c XX1234',
      NOW,
    );
    expect(r).toMatchObject({ amountPaise: 12000, direction: 'credit' });
  });

  test('balance-only text is not confidently parsed', () => {
    const r = parseTransactionText(
      'Bank alert',
      'Avl Bal Rs 5,000 in a/c XX1234',
      NOW,
    );
    expect(r === null || r.confidence < CONFIDENCE_FLOOR).toBe(true);
  });

  test.each([
    ['bill reminder', 'Your credit card bill of Rs 4,500 is due on 15-10-2026'],
    ['collect request', 'XYZ has requested money ₹200 from you on UPI'],
    ['failed payment', 'Payment of Rs 300 to Zomato failed'],
    [
      'promo',
      'Get cashback up to ₹100 on your next payment, offer valid today',
    ],
  ])('%s is not a transaction', (_name, text) => {
    expect(parseTransactionText('Alert', text, NOW)).toBeNull();
  });

  test('text the rules cannot read falls below the confidence floor', () => {
    const r = parseTransactionText(
      'Bank',
      'Txn alert: amount 450 processed for merchant',
      NOW,
    );
    expect(r === null || r.confidence < CONFIDENCE_FLOOR).toBe(true);
  });
});

describe('findDate', () => {
  test('rejects impossible and far-away dates', () => {
    expect(findDate('on 31-02-2026', NOW)).toBeNull();
    expect(findDate('on 01-01-2020', NOW)).toBeNull();
  });

  test('reads named months', () => {
    expect(findDate('on 3 Oct 2026', NOW)).toBe(day(2026, 9, 3));
  });
});
