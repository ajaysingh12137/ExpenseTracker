import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';
import { DEFAULT_CATEGORIES } from '../categories/defaults';

/**
 * App database (op-sqlite). Excluded from cloud backup and device transfer via
 * android/app/src/main/res/xml/data_extraction_rules.xml. Not encrypted yet: the PRD requires
 * SQLCipher before cloud sync ships.
 *
 * Schema version lives in PRAGMA user_version. Migrations only ever move forward; never drop
 * raw_captures (it is the only copy of captured text once the native queue is acknowledged).
 */
const MIGRATIONS: ReadonlyArray<ReadonlyArray<string>> = [
  // v1
  [
    `CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalized_name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      default_category_id TEXT
    )`,
    `CREATE TABLE merchant_overrides (
      merchant_id INTEGER PRIMARY KEY REFERENCES merchants(id),
      category_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE raw_captures (
      id INTEGER PRIMARY KEY,
      dedup_key TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      package_name TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      posted_at INTEGER NOT NULL,
      captured_at INTEGER NOT NULL,
      parse_status TEXT NOT NULL DEFAULT 'pending',
      parser_version INTEGER NOT NULL DEFAULT 0,
      ai_attempts INTEGER NOT NULL DEFAULT 0
    )`,
    'CREATE INDEX idx_raw_status ON raw_captures(parse_status)',
    `CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_capture_id INTEGER UNIQUE REFERENCES raw_captures(id),
      amount_paise INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
      merchant_raw TEXT,
      merchant_id INTEGER REFERENCES merchants(id),
      category_id TEXT NOT NULL,
      account_hint TEXT,
      occurred_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'ignored')),
      parsed_by TEXT NOT NULL CHECK (parsed_by IN ('rule', 'ai', 'manual')),
      possible_duplicate_of INTEGER,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    'CREATE INDEX idx_tx_status_time ON transactions(status, occurred_at)',
    'CREATE INDEX idx_tx_merchant ON transactions(merchant_id)',
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
];

let db: DB | null = null;
let ready: Promise<DB> | null = null;

async function migrate(database: DB): Promise<void> {
  await database.execute('PRAGMA foreign_keys = ON');
  const result = await database.execute('PRAGMA user_version');
  const current = Number(result.rows[0]?.user_version ?? 0);

  for (let version = current; version < MIGRATIONS.length; version++) {
    await database.transaction(async tx => {
      for (const statement of MIGRATIONS[version]) {
        await tx.execute(statement);
      }
      if (version === 0) {
        for (const [index, c] of DEFAULT_CATEGORIES.entries()) {
          await tx.execute(
            'INSERT OR IGNORE INTO categories (id, name, icon, is_default, sort) VALUES (?, ?, ?, 1, ?)',
            [c.id, c.name, c.icon, index],
          );
        }
      }
      // PRAGMA does not accept bound parameters; version is a loop integer, not user input.
      await tx.execute(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/** Opens and migrates once; every caller shares the same connection. */
export function getDb(): Promise<DB> {
  if (db) {
    return Promise.resolve(db);
  }
  if (!ready) {
    ready = (async () => {
      const database = open({ name: 'expense_tracker.sqlite' });
      await migrate(database);
      db = database;
      return database;
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
