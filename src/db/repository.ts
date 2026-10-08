import type { QueryResult, Scalar } from '@op-engineering/op-sqlite';
import {
  categorize,
  keywordCategory,
  normalizeMerchant,
} from '../categories/categorize';
import { UNCATEGORIZED } from '../categories/defaults';
import type {
  Category,
  CaptureSource,
  Direction,
  ParsedBy,
  ParsedTransaction,
  Transaction,
  TransactionStatus,
} from '../domain/types';
import { notifyDataChanged } from '../state/store';
import { findMatch, MATCH_WINDOW_MS } from '../pipeline/matching';
import type { MatchCandidate } from '../pipeline/matching';
import { getDb } from './database';

/** Anything with execute(): the DB itself or a transaction handle. */
type Executor = {
  execute: (query: string, params?: Scalar[]) => Promise<QueryResult>;
};
type Row = Record<string, Scalar>;

/** Two captures with the same amount, direction and merchant this close together are flagged. */
export const DUPLICATE_WINDOW_MS = 3 * 60 * 1000;

const num = (value: Scalar | undefined): number | null =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value !== ''
    ? Number(value)
    : null;
const str = (value: Scalar | undefined): string | null =>
  typeof value === 'string' ? value : null;

const TX_SELECT = `
  SELECT t.*, COALESCE(m.display_name, t.merchant_raw) AS merchant_name,
    (SELECT COUNT(*) FROM raw_captures r WHERE r.transaction_id = t.id) AS source_count
  FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id`;

function toTransaction(row: Row): Transaction {
  return {
    id: num(row.id) ?? 0,
    rawCaptureId: num(row.raw_capture_id),
    amountPaise: num(row.amount_paise) ?? 0,
    direction: (str(row.direction) ?? 'debit') as Direction,
    merchantRaw: str(row.merchant_raw),
    merchantId: num(row.merchant_id),
    merchantName: str(row.merchant_name),
    categoryId: str(row.category_id) ?? UNCATEGORIZED,
    accountHint: str(row.account_hint),
    occurredAt: num(row.occurred_at) ?? 0,
    status: (str(row.status) ?? 'draft') as TransactionStatus,
    parsedBy: (str(row.parsed_by) ?? 'rule') as ParsedBy,
    possibleDuplicateOf: num(row.possible_duplicate_of),
    note: str(row.note),
    reference: str(row.reference),
    sourceCount: Math.max(1, num(row.source_count) ?? 1),
  };
}

// ---------------------------------------------------------------------------------------------
// Capture persistence (the `persist` passed to useTransactionCapture)

export type CaptureInput = {
  id: number;
  dedupKey: string;
  packageName: string;
  title: string;
  body: string;
  postedAt: number;
  capturedAt: number;
};

/**
 * Durable before it resolves (single committed transaction). Idempotent: upsert on the native id
 * and unique on dedup_key, so a batch redelivered after a crash, or a notification re-captured
 * after the native seen-window expired, never creates a second row.
 */
export async function persistCaptures(
  items: ReadonlyArray<CaptureInput>,
  smsPackages: ReadonlySet<string>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const db = await getDb();
  await db.transaction(async tx => {
    for (const item of items) {
      const source: CaptureSource = smsPackages.has(item.packageName)
        ? 'sms'
        : 'notification';
      await tx.execute(
        `INSERT OR IGNORE INTO raw_captures
           (id, dedup_key, source, package_name, title, body, posted_at, captured_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.dedupKey,
          source,
          item.packageName,
          item.title,
          item.body,
          item.postedAt,
          item.capturedAt,
        ],
      );
    }
  });
  notifyDataChanged();
}

export type PendingRaw = {
  id: number;
  title: string;
  body: string;
  postedAt: number;
  aiAttempts: number;
  parseStatus: string;
};

export async function getRawToProcess(limit: number): Promise<PendingRaw[]> {
  const db = await getDb();
  const result = await db.execute(
    `SELECT id, title, body, posted_at, ai_attempts, parse_status FROM raw_captures
     WHERE parse_status IN ('pending', 'ai_pending') ORDER BY id ASC LIMIT ?`,
    [limit],
  );
  return result.rows.map(row => ({
    id: num(row.id) ?? 0,
    title: str(row.title) ?? '',
    body: str(row.body) ?? '',
    postedAt: num(row.posted_at) ?? Date.now(),
    aiAttempts: num(row.ai_attempts) ?? 0,
    parseStatus: str(row.parse_status) ?? 'pending',
  }));
}

export async function markRaw(
  id: number,
  status: 'parsed' | 'ai_pending' | 'failed' | 'ignored',
  parserVersion: number,
  incrementAiAttempts = false,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE raw_captures SET parse_status = ?, parser_version = ?,
       ai_attempts = ai_attempts + ? WHERE id = ?`,
    [status, parserVersion, incrementAiAttempts ? 1 : 0, id],
  );
}

/** After a parser upgrade: let rule-parsed drafts and ignored/failed captures be parsed again. */
export async function resetForReparse(currentVersion: number): Promise<void> {
  const db = await getDb();
  await db.transaction(async tx => {
    const stale = `SELECT id FROM transactions WHERE status = 'draft' AND parsed_by = 'rule'
      AND raw_capture_id IN (SELECT id FROM raw_captures WHERE parser_version < ?)`;
    await tx.execute(
      `UPDATE raw_captures SET transaction_id = NULL, parse_status = 'pending'
       WHERE transaction_id IN (${stale})`,
      [currentVersion],
    );
    await tx.execute(`DELETE FROM transactions WHERE id IN (${stale})`, [
      currentVersion,
    ]);
    await tx.execute(
      `UPDATE raw_captures SET parse_status = 'pending'
       WHERE parser_version < ? AND parse_status IN ('ignored', 'failed', 'parsed')
         AND transaction_id IS NULL`,
      [currentVersion],
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Merchants and categories

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  const result = await db.execute(
    'SELECT id, name, icon, is_default FROM categories ORDER BY sort, name',
  );
  return result.rows.map(row => ({
    id: str(row.id) ?? '',
    name: str(row.name) ?? '',
    icon: str(row.icon) ?? '',
    isDefault: num(row.is_default) === 1,
  }));
}

type ResolvedMerchant = {
  id: number;
  override: string | null;
  defaultCategory: string | null;
};

async function resolveMerchant(
  ex: Executor,
  merchantRaw: string | null,
  initialCategory: string | null,
): Promise<ResolvedMerchant | null> {
  if (!merchantRaw) {
    return null;
  }
  const normalized = normalizeMerchant(merchantRaw);
  if (!normalized) {
    return null;
  }
  await ex.execute(
    'INSERT OR IGNORE INTO merchants (normalized_name, display_name, default_category_id) VALUES (?, ?, ?)',
    [normalized, merchantRaw.trim(), initialCategory],
  );
  const result = await ex.execute(
    `SELECT m.id, m.default_category_id, o.category_id AS override
     FROM merchants m LEFT JOIN merchant_overrides o ON o.merchant_id = m.id
     WHERE m.normalized_name = ?`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: num(row.id) ?? 0,
    override: str(row.override),
    defaultCategory: str(row.default_category_id),
  };
}

async function findPossibleDuplicate(
  ex: Executor,
  amountPaise: number,
  direction: Direction,
  merchantId: number | null,
  occurredAt: number,
): Promise<number | null> {
  if (amountPaise <= 0) {
    return null;
  }
  const result = await ex.execute(
    `SELECT id FROM transactions
     WHERE amount_paise = ? AND direction = ? AND status != 'ignored'
       AND (? IS NULL OR merchant_id IS NULL OR merchant_id = ?)
       AND occurred_at BETWEEN ? AND ?
     ORDER BY id ASC LIMIT 1`,
    [
      amountPaise,
      direction,
      merchantId,
      merchantId,
      occurredAt - DUPLICATE_WINDOW_MS,
      occurredAt + DUPLICATE_WINDOW_MS,
    ],
  );
  return num(result.rows[0]?.id);
}

/** Existing transactions that could be the same payment as a new alert. */
async function matchCandidates(
  ex: Executor,
  amountPaise: number,
  direction: Direction,
  occurredAt: number,
  reference: string | null,
): Promise<MatchCandidate[]> {
  const result = await ex.execute(
    `SELECT t.id, t.amount_paise, t.direction, t.occurred_at, t.reference, t.status, t.parsed_by,
            (SELECT GROUP_CONCAT(r.package_name, '|') FROM raw_captures r
              WHERE r.transaction_id = t.id) AS packages
     FROM transactions t
     WHERE (t.reference IS NOT NULL AND t.reference = ?)
        OR (t.amount_paise = ? AND t.direction = ? AND t.occurred_at BETWEEN ? AND ?)`,
    [
      reference,
      amountPaise,
      direction,
      occurredAt - MATCH_WINDOW_MS,
      occurredAt + MATCH_WINDOW_MS,
    ],
  );
  return result.rows.map(row => ({
    id: num(row.id) ?? 0,
    amountPaise: num(row.amount_paise) ?? 0,
    direction: (str(row.direction) ?? 'debit') as Direction,
    occurredAt: num(row.occurred_at) ?? 0,
    reference: str(row.reference),
    status: (str(row.status) ?? 'draft') as TransactionStatus,
    packages: (str(row.packages) ?? '').split('|').filter(Boolean),
    manual: str(row.parsed_by) === 'manual',
  }));
}

// ---------------------------------------------------------------------------------------------
// Drafts from captures

/**
 * Turns one raw capture into a transaction, or links it to an existing one when another app
 * already reported the same payment (see pipeline/matching.ts). Identical repeat payments from
 * the same app always become separate transactions (PRD); a near-identical earlier one is
 * only *flagged* via possible_duplicate_of.
 */
export async function createDraftFromCapture(
  rawId: number,
  parsed: ParsedTransaction,
  parsedBy: 'rule' | 'ai',
  fallbackTime: number,
  knownCategoryIds: ReadonlySet<string>,
): Promise<'created' | 'merged'> {
  const db = await getDb();
  const now = Date.now();
  let outcome: 'created' | 'merged' = 'created';
  await db.transaction(async tx => {
    const rawRow = (
      await tx.execute(
        'SELECT package_name, no_merge FROM raw_captures WHERE id = ?',
        [rawId],
      )
    ).rows[0];
    const packageName = str(rawRow?.package_name) ?? '';
    const noMerge = num(rawRow?.no_merge) === 1;
    const reference = parsed.reference ?? null;

    const normalized = parsed.merchantRaw
      ? normalizeMerchant(parsed.merchantRaw)
      : null;
    const initialCategory =
      (normalized ? keywordCategory(normalized) : null) ??
      (parsed.categoryGuess && knownCategoryIds.has(parsed.categoryGuess)
        ? parsed.categoryGuess
        : null);
    const merchant = await resolveMerchant(
      tx,
      parsed.merchantRaw,
      initialCategory,
    );

    const categoryId = categorize({
      direction: parsed.direction,
      normalizedMerchant: normalized,
      overrideCategoryId: merchant?.override ?? null,
      merchantDefaultCategoryId: merchant?.defaultCategory ?? null,
      aiGuess: parsed.categoryGuess ?? null,
      knownCategoryIds,
    });
    const occurredAt = parsed.occurredAt ?? fallbackTime;
    // A text date has no time of day; if it is the posting day, the posting time is more precise.
    const sameDay =
      parsed.occurredAt !== null &&
      new Date(parsed.occurredAt).toDateString() ===
        new Date(fallbackTime).toDateString();
    const when = sameDay ? fallbackTime : occurredAt;

    if (!noMerge) {
      const match = findMatch(
        {
          amountPaise: parsed.amountPaise,
          direction: parsed.direction,
          occurredAt: when,
          reference,
          packageName,
        },
        await matchCandidates(
          tx,
          parsed.amountPaise,
          parsed.direction,
          when,
          reference,
        ),
      );
      if (match) {
        await tx.execute(
          'UPDATE raw_captures SET transaction_id = ? WHERE id = ?',
          [match.id, rawId],
        );
        // Fill in what the first alert did not say (e.g. the UPI app names the payee, the bank
        // SMS has the account); never overwrite what is already there or what the user edited.
        await tx.execute(
          `UPDATE transactions SET
             reference = COALESCE(reference, ?),
             account_hint = COALESCE(account_hint, ?),
             merchant_raw = COALESCE(merchant_raw, ?),
             merchant_id = COALESCE(merchant_id, ?),
             category_id = CASE WHEN status = 'draft' AND merchant_id IS NULL
                                 AND category_id IN ('uncategorized', 'income')
                                THEN ? ELSE category_id END,
             updated_at = ?
           WHERE id = ?`,
          [
            reference,
            parsed.accountHint,
            parsed.merchantRaw,
            merchant?.id ?? null,
            categoryId,
            now,
            match.id,
          ],
        );
        outcome = 'merged';
        return;
      }
    }

    const duplicateOf = await findPossibleDuplicate(
      tx,
      parsed.amountPaise,
      parsed.direction,
      merchant?.id ?? null,
      when,
    );

    const inserted = await tx.execute(
      `INSERT OR IGNORE INTO transactions
         (raw_capture_id, amount_paise, direction, merchant_raw, merchant_id, category_id,
          account_hint, occurred_at, status, parsed_by, possible_duplicate_of, reference,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
      [
        rawId,
        parsed.amountPaise,
        parsed.direction,
        parsed.merchantRaw,
        merchant?.id ?? null,
        categoryId,
        parsed.accountHint,
        when,
        parsedBy,
        duplicateOf,
        reference,
        now,
        now,
      ],
    );
    if (inserted.insertId) {
      await tx.execute(
        'UPDATE raw_captures SET transaction_id = ? WHERE id = ?',
        [inserted.insertId, rawId],
      );
    }
  });
  notifyDataChanged();
  return outcome;
}

// ---------------------------------------------------------------------------------------------
// Sources (one payment, several alerts)

export type TransactionSource = {
  rawCaptureId: number;
  packageName: string;
  postedAt: number;
  title: string;
  body: string;
  /** The alert the transaction was first created from; cannot be split off. */
  primary: boolean;
};

export async function listSources(
  transactionId: number,
): Promise<TransactionSource[]> {
  const db = await getDb();
  const result = await db.execute(
    `SELECT r.id, r.package_name, r.posted_at, r.title, r.body,
            (r.id = t.raw_capture_id) AS is_primary
     FROM raw_captures r JOIN transactions t ON t.id = r.transaction_id
     WHERE r.transaction_id = ? ORDER BY is_primary DESC, r.posted_at ASC`,
    [transactionId],
  );
  return result.rows.map(row => ({
    rawCaptureId: num(row.id) ?? 0,
    packageName: str(row.package_name) ?? '',
    postedAt: num(row.posted_at) ?? 0,
    title: str(row.title) ?? '',
    body: str(row.body) ?? '',
    primary: num(row.is_primary) === 1,
  }));
}

/**
 * "These were two different payments": detaches a linked alert and re-processes it as its own
 * transaction. no_merge stops it from being matched again.
 */
export async function splitSource(rawCaptureId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE raw_captures SET transaction_id = NULL, no_merge = 1, parse_status = 'pending'
     WHERE id = ? AND id NOT IN (SELECT raw_capture_id FROM transactions WHERE raw_capture_id IS NOT NULL)`,
    [rawCaptureId],
  );
  notifyDataChanged();
}

// ---------------------------------------------------------------------------------------------
// Reading

export async function listDrafts(): Promise<Transaction[]> {
  const db = await getDb();
  const result = await db.execute(
    `${TX_SELECT} WHERE t.status = 'draft' ORDER BY t.occurred_at DESC`,
  );
  return result.rows.map(toTransaction);
}

export async function countDrafts(): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "SELECT COUNT(*) AS n FROM transactions WHERE status = 'draft'",
  );
  return num(result.rows[0]?.n) ?? 0;
}

export async function getTransaction(id: number): Promise<Transaction | null> {
  const db = await getDb();
  const result = await db.execute(`${TX_SELECT} WHERE t.id = ?`, [id]);
  return result.rows[0] ? toTransaction(result.rows[0]) : null;
}

export async function getRawText(
  rawCaptureId: number,
): Promise<{ title: string; body: string } | null> {
  const db = await getDb();
  const result = await db.execute(
    'SELECT title, body FROM raw_captures WHERE id = ?',
    [rawCaptureId],
  );
  const row = result.rows[0];
  return row
    ? { title: str(row.title) ?? '', body: str(row.body) ?? '' }
    : null;
}

export async function listConfirmed(options: {
  from: number;
  to: number;
  categoryId?: string;
  direction?: Direction;
}): Promise<Transaction[]> {
  const db = await getDb();
  const params: Scalar[] = [options.from, options.to];
  let where =
    "t.status = 'confirmed' AND t.occurred_at >= ? AND t.occurred_at < ?";
  if (options.direction) {
    where += ' AND t.direction = ?';
    params.push(options.direction);
  }
  if (options.categoryId) {
    where += ' AND t.category_id = ?';
    params.push(options.categoryId);
  }
  const result = await db.execute(
    `${TX_SELECT} WHERE ${where} ORDER BY t.occurred_at DESC`,
    params,
  );
  return result.rows.map(toTransaction);
}

/** Confirmed total for one direction. Spent and received are never netted together. */
export async function sumByDirection(
  from: number,
  to: number,
  direction: Direction,
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM transactions
     WHERE status = 'confirmed' AND direction = ? AND occurred_at >= ? AND occurred_at < ?`,
    [direction, from, to],
  );
  return num(result.rows[0]?.total) ?? 0;
}

export const sumDebits = (from: number, to: number) =>
  sumByDirection(from, to, 'debit');

export type CategoryTotal = {
  categoryId: string;
  name: string;
  icon: string;
  totalPaise: number;
  count: number;
};
export type MerchantTotal = { name: string; totalPaise: number; count: number };

export async function categoryTotals(
  from: number,
  to: number,
  direction: Direction = 'debit',
): Promise<CategoryTotal[]> {
  const db = await getDb();
  const result = await db.execute(
    `SELECT t.category_id, COALESCE(c.name, t.category_id) AS name, COALESCE(c.icon, '') AS icon,
            SUM(t.amount_paise) AS total, COUNT(*) AS n
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'confirmed' AND t.direction = ? AND t.occurred_at >= ? AND t.occurred_at < ?
     GROUP BY t.category_id ORDER BY total DESC`,
    [direction, from, to],
  );
  return result.rows.map(row => ({
    categoryId: str(row.category_id) ?? UNCATEGORIZED,
    name: str(row.name) ?? '',
    icon: str(row.icon) ?? '',
    totalPaise: num(row.total) ?? 0,
    count: num(row.n) ?? 0,
  }));
}

export async function topMerchants(
  from: number,
  to: number,
  direction: Direction = 'debit',
  limit = 5,
): Promise<MerchantTotal[]> {
  const db = await getDb();
  const result = await db.execute(
    `SELECT COALESCE(m.display_name, t.merchant_raw, 'Unknown') AS name,
            SUM(t.amount_paise) AS total, COUNT(*) AS n
     FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id
     WHERE t.status = 'confirmed' AND t.direction = ? AND t.occurred_at >= ? AND t.occurred_at < ?
     GROUP BY COALESCE(CAST(t.merchant_id AS TEXT), t.merchant_raw, 'Unknown')
     ORDER BY total DESC LIMIT ?`,
    [direction, from, to, limit],
  );
  return result.rows.map(row => ({
    name: str(row.name) ?? 'Unknown',
    totalPaise: num(row.total) ?? 0,
    count: num(row.n) ?? 0,
  }));
}

// ---------------------------------------------------------------------------------------------
// Writing

export async function setStatus(
  id: number,
  status: TransactionStatus,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE transactions SET status = ?, updated_at = ? WHERE id = ?',
    [status, Date.now(), id],
  );
  notifyDataChanged();
}

export type TransactionPatch = {
  amountPaise: number;
  direction: Direction;
  merchant: string | null;
  categoryId: string;
  occurredAt: number;
  note: string | null;
};

/**
 * Saves the user's edit. If the category differs from what the map would have chosen, it is
 * stored as a merchant override and applied to this merchant's other drafts, so the next
 * capture from the same merchant is categorized correctly.
 */
export async function updateTransaction(
  id: number,
  patch: TransactionPatch,
  options: { confirm: boolean },
): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.transaction(async tx => {
    const merchant = await resolveMerchant(
      tx,
      patch.merchant,
      patch.categoryId,
    );
    const effective = merchant
      ? merchant.override ?? merchant.defaultCategory
      : null;
    if (merchant && effective !== patch.categoryId) {
      await tx.execute(
        `INSERT INTO merchant_overrides (merchant_id, category_id, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(merchant_id) DO UPDATE SET category_id = excluded.category_id,
           updated_at = excluded.updated_at`,
        [merchant.id, patch.categoryId, now],
      );
      await tx.execute(
        `UPDATE transactions SET category_id = ?, updated_at = ?
         WHERE merchant_id = ? AND status = 'draft' AND id != ?`,
        [patch.categoryId, now, merchant.id, id],
      );
    }
    await tx.execute(
      `UPDATE transactions SET amount_paise = ?, direction = ?, merchant_raw = ?, merchant_id = ?,
         category_id = ?, occurred_at = ?, note = ?, updated_at = ?,
         status = CASE WHEN ? = 1 THEN 'confirmed' ELSE status END
       WHERE id = ?`,
      [
        patch.amountPaise,
        patch.direction,
        patch.merchant,
        merchant?.id ?? null,
        patch.categoryId,
        patch.occurredAt,
        patch.note,
        now,
        options.confirm ? 1 : 0,
        id,
      ],
    );
  });
  notifyDataChanged();
}

/** Manual and voice entries are confirmed immediately: the user typed or said them. */
export async function addManualTransaction(input: {
  amountPaise: number;
  direction: Direction;
  merchant: string | null;
  categoryId: string | null;
  occurredAt: number;
  note: string | null;
}): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  let insertedId = 0;
  await db.transaction(async tx => {
    const normalized = input.merchant
      ? normalizeMerchant(input.merchant)
      : null;
    const merchant = await resolveMerchant(
      tx,
      input.merchant,
      normalized ? keywordCategory(normalized) : null,
    );
    const categories = await tx.execute('SELECT id FROM categories');
    const known = new Set(categories.rows.map(row => str(row.id) ?? ''));
    const categoryId =
      input.categoryId && known.has(input.categoryId)
        ? input.categoryId
        : categorize({
            direction: input.direction,
            normalizedMerchant: normalized,
            overrideCategoryId: merchant?.override ?? null,
            merchantDefaultCategoryId: merchant?.defaultCategory ?? null,
            knownCategoryIds: known,
          });
    const result = await tx.execute(
      `INSERT INTO transactions
         (raw_capture_id, amount_paise, direction, merchant_raw, merchant_id, category_id,
          account_hint, occurred_at, status, parsed_by, possible_duplicate_of, note, created_at, updated_at)
       VALUES (NULL, ?, ?, ?, ?, ?, NULL, ?, 'confirmed', 'manual', NULL, ?, ?, ?)`,
      [
        input.amountPaise,
        input.direction,
        input.merchant,
        merchant?.id ?? null,
        categoryId,
        input.occurredAt,
        input.note,
        now,
        now,
      ],
    );
    insertedId = result.insertId ?? 0;
  });
  notifyDataChanged();
  return insertedId;
}
