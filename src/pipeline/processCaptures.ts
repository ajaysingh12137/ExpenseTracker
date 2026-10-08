import { isAiEnabled, parseWithAi } from '../ai/aiFallback';
import {
  createDraftFromCapture,
  getCategories,
  getRawToProcess,
  markRaw,
  resetForReparse,
} from '../db/repository';
import {
  getInstallId,
  getSetting,
  setSetting,
  SettingKeys,
} from '../db/settings';
import type { ParsedTransaction } from '../domain/types';
import {
  CONFIDENCE_FLOOR,
  PARSER_VERSION,
  parseTransactionText,
} from '../parser/ruleParser';

/** After this many failed AI calls a capture becomes a "needs details" draft for the user. */
export const MAX_AI_ATTEMPTS = 3;
const BATCH = 50;

let running: Promise<number> | null = null;
let rerun = false;

/**
 * Turns raw captures into drafts: rules first, AI only for what rules could not parse, and a
 * "needs details" draft (amount 0) when neither works, so nothing captured is silently dropped
 * except text the rules positively identify as not-a-transaction (reminders, requests, promos).
 * Single-flight like drainQueue. Resolves with the number of captures processed.
 */
export function processCaptures(): Promise<number> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    let total = 0;
    try {
      await reparseIfParserChanged();
      const categories = await getCategories();
      const known = new Set(categories.map(c => c.id));
      const categoryIds = categories.map(c => c.id);
      // Items left 'ai_pending' stay in the result set; never retry one within the same run.
      const handled = new Set<number>();
      do {
        rerun = false;
        for (;;) {
          const batch = (await getRawToProcess(BATCH + handled.size)).filter(
            raw => !handled.has(raw.id),
          );
          if (batch.length === 0) {
            break;
          }
          for (const raw of batch) {
            handled.add(raw.id);
            await processOne(raw, known, categoryIds);
            total += 1;
          }
        }
      } while (rerun);
      return total;
    } finally {
      running = null;
      rerun = false;
    }
  })();
  return running;
}

async function processOne(
  raw: {
    id: number;
    title: string;
    body: string;
    postedAt: number;
    aiAttempts: number;
    parseStatus: string;
  },
  known: ReadonlySet<string>,
  categoryIds: ReadonlyArray<string>,
): Promise<void> {
  const ruled = parseTransactionText(raw.title, raw.body);
  if (ruled === null) {
    await markRaw(raw.id, 'ignored', PARSER_VERSION);
    return;
  }
  if (ruled.confidence >= CONFIDENCE_FLOOR) {
    await createDraftFromCapture(raw.id, ruled, 'rule', raw.postedAt, known);
    await markRaw(raw.id, 'parsed', PARSER_VERSION);
    return;
  }

  if (isAiEnabled() && raw.aiAttempts < MAX_AI_ATTEMPTS) {
    const outcome = await parseWithAi(
      raw.title,
      raw.body,
      categoryIds,
      await getInstallId(),
    );
    if (outcome.kind === 'parsed') {
      await createDraftFromCapture(
        raw.id,
        mergeRuleHints(outcome.result, ruled),
        'ai',
        raw.postedAt,
        known,
      );
      await markRaw(raw.id, 'parsed', PARSER_VERSION);
      return;
    }
    if (outcome.kind === 'not_transaction') {
      await markRaw(raw.id, 'ignored', PARSER_VERSION);
      return;
    }
    if (raw.aiAttempts + 1 < MAX_AI_ATTEMPTS) {
      // Offline or server error: leave it for the next run (next drain / foreground).
      await markRaw(raw.id, 'ai_pending', PARSER_VERSION, true);
      return;
    }
  }

  // No AI, or AI kept failing: show the user what the rules found and let them complete it.
  await createDraftFromCapture(raw.id, ruled, 'rule', raw.postedAt, known);
  await markRaw(raw.id, 'failed', PARSER_VERSION, isAiEnabled());
}

/** The AI never sees full account numbers, so keep the rule parser's last-4 hint. */
function mergeRuleHints(
  ai: ParsedTransaction,
  ruled: ParsedTransaction,
): ParsedTransaction {
  return {
    ...ai,
    accountHint: ai.accountHint ?? ruled.accountHint,
    reference: ai.reference ?? ruled.reference ?? null,
  };
}

async function reparseIfParserChanged(): Promise<void> {
  const stored = Number((await getSetting(SettingKeys.parserVersion)) ?? '0');
  if (stored === PARSER_VERSION) {
    return;
  }
  if (stored > 0) {
    await resetForReparse(PARSER_VERSION);
  }
  await setSetting(SettingKeys.parserVersion, String(PARSER_VERSION));
}
