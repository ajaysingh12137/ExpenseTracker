import type { Direction, TransactionStatus } from '../domain/types';

/**
 * Cross-source matching: one real payment is often reported by several apps (bank SMS, bank
 * app, UPI app). Those reports should become ONE transaction with several sources, while two
 * genuinely separate payments of the same amount must stay separate (PRD).
 *
 * Rules, in order:
 * 1. Same payment reference (UPI ref / RRN / UTR) -> same payment, whatever the source.
 * 2. Different references on both sides -> never the same payment.
 * 3. Otherwise: same amount + same direction + within MATCH_WINDOW_MS, and the existing
 *    transaction has NO alert from this same app yet. One app reports one payment once, so a
 *    second alert from the same app means a second payment (that case is only flagged as a
 *    possible duplicate, never merged).
 *
 * Merges are never silent: the inbox shows "2 sources" and the edit screen can split them.
 */
export const MATCH_WINDOW_MS = 15 * 60 * 1000;

export type MatchInput = {
  amountPaise: number;
  direction: Direction;
  occurredAt: number;
  reference: string | null;
  packageName: string;
};

export type MatchCandidate = {
  id: number;
  amountPaise: number;
  direction: Direction;
  occurredAt: number;
  reference: string | null;
  status: TransactionStatus;
  /** Source apps already linked to this transaction. */
  packages: ReadonlyArray<string>;
  /** Manual entries are never merged automatically. */
  manual: boolean;
};

export type Match = { id: number; reason: 'reference' | 'cross_source' };

export function findMatch(
  input: MatchInput,
  candidates: ReadonlyArray<MatchCandidate>,
): Match | null {
  if (input.amountPaise <= 0) {
    return null;
  }
  if (input.reference) {
    const byRef = candidates.find(
      c => !c.manual && c.reference === input.reference,
    );
    if (byRef) {
      return { id: byRef.id, reason: 'reference' };
    }
  }

  let best: MatchCandidate | null = null;
  for (const c of candidates) {
    if (
      c.manual ||
      c.amountPaise !== input.amountPaise ||
      c.direction !== input.direction
    ) {
      continue;
    }
    if (Math.abs(c.occurredAt - input.occurredAt) > MATCH_WINDOW_MS) {
      continue;
    }
    if (input.reference && c.reference && input.reference !== c.reference) {
      continue; // two different payments that happen to share an amount
    }
    if (c.packages.includes(input.packageName)) {
      continue; // same app twice = two payments
    }
    if (
      !best ||
      Math.abs(c.occurredAt - input.occurredAt) <
        Math.abs(best.occurredAt - input.occurredAt)
    ) {
      best = c;
    }
  }
  return best ? { id: best.id, reason: 'cross_source' } : null;
}
