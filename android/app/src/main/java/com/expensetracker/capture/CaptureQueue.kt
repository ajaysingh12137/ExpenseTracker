package com.expensetracker.capture

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class PendingItem(
  val id: Long,
  val dedupKey: String,
  val packageName: String,
  val title: String,
  val body: String,
  val postedAt: Long,
  val capturedAt: Long,
)

/**
 * Durable native queue. JS reads with getPending(), persists to its own DB, then calls
 * acknowledge(ids) and the rows are deleted here.
 *
 * Two tables:
 *  - pending: captured items waiting for JS (raw text lives only here, and only until acked
 *    or until PENDING_TTL_MS passes).
 *  - seen: hashes only, never text. Remembers recent captures so a repost or update of the
 *    same notification (same content AND same event time) is not queued twice, even after JS
 *    has acknowledged it. Identical content with a different event time is a separate payment
 *    and is always queued (PRD: repeat payments must stay separate; the inbox flags possible
 *    duplicates instead of merging them).
 */
class CaptureQueue private constructor(context: Context) :
  SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

  init {
    setWriteAheadLoggingEnabled(true)
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE pending (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dedup_key TEXT NOT NULL UNIQUE,
        package_name TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        posted_at INTEGER NOT NULL,
        captured_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE seen (
        dedup_key TEXT PRIMARY KEY,
        content_key TEXT NOT NULL,
        seen_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX idx_seen_content ON seen(content_key, seen_at)")
    db.execSQL("CREATE INDEX idx_seen_at ON seen(seen_at)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // Only version 1 exists. Add explicit migrations here when the schema changes;
    // never drop `pending`, it may hold unacknowledged transactions.
  }

  /** Returns true if a new row was queued, false if it was a duplicate. */
  fun enqueue(item: CapturedNotification, now: Long = System.currentTimeMillis()): Boolean {
    val db = writableDatabase
    db.beginTransaction()
    try {
      if (isDuplicate(db, item, now)) return false

      val seen = ContentValues().apply {
        put("dedup_key", item.dedupKey)
        put("content_key", item.contentKey)
        put("seen_at", now)
      }
      db.insertWithOnConflict("seen", null, seen, SQLiteDatabase.CONFLICT_REPLACE)

      val row = ContentValues().apply {
        put("dedup_key", item.dedupKey)
        put("package_name", item.packageName)
        put("title", item.title)
        put("body", item.body)
        put("posted_at", item.postedAt)
        put("captured_at", now)
      }
      val id = db.insertWithOnConflict("pending", null, row, SQLiteDatabase.CONFLICT_IGNORE)
      db.setTransactionSuccessful()
      return id != -1L
    } finally {
      db.endTransaction()
    }
  }

  private fun isDuplicate(db: SQLiteDatabase, item: CapturedNotification, now: Long): Boolean {
    // Same content and same event time within the seen window: a repost/update.
    db.rawQuery(
      "SELECT 1 FROM seen WHERE dedup_key = ? AND seen_at >= ? LIMIT 1",
      arrayOf(item.dedupKey, (now - SEEN_TTL_MS).toString()),
    ).use { if (it.moveToFirst()) return true }
    return false
  }

  fun getPending(limit: Int): List<PendingItem> {
    val safeLimit = limit.coerceIn(1, MAX_BATCH)
    val items = ArrayList<PendingItem>()
    readableDatabase.rawQuery(
      "SELECT id, dedup_key, package_name, title, body, posted_at, captured_at FROM pending " +
        "ORDER BY id ASC LIMIT $safeLimit",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        items.add(
          PendingItem(
            id = c.getLong(0),
            dedupKey = c.getString(1),
            packageName = c.getString(2),
            title = c.getString(3),
            body = c.getString(4),
            postedAt = c.getLong(5),
            capturedAt = c.getLong(6),
          ),
        )
      }
    }
    return items
  }

  /** Deletes acknowledged rows. Unknown ids are ignored. Returns rows deleted. */
  fun acknowledge(ids: List<Long>): Int {
    if (ids.isEmpty()) return 0
    val db = writableDatabase
    var deleted = 0
    db.beginTransaction()
    try {
      // Chunked to stay under SQLite's bound-parameter limit.
      ids.distinct().chunked(500).forEach { chunk ->
        val placeholders = chunk.joinToString(",") { "?" }
        deleted += db.delete(
          "pending",
          "id IN ($placeholders)",
          chunk.map { it.toString() }.toTypedArray(),
        )
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
    return deleted
  }

  /** Drops stale unacknowledged rows (privacy) and old dedup hashes. */
  fun purgeExpired(now: Long = System.currentTimeMillis()) {
    val db = writableDatabase
    db.delete("pending", "captured_at < ?", arrayOf((now - PENDING_TTL_MS).toString()))
    db.delete("seen", "seen_at < ?", arrayOf((now - SEEN_TTL_MS).toString()))
  }

  companion object {
    private const val DB_NAME = "transaction_capture.db"
    private const val DB_VERSION = 1
    const val MAX_BATCH = 200
    private const val PENDING_TTL_MS = 30L * 24 * 60 * 60 * 1000
    const val SEEN_TTL_MS = 48L * 60 * 60 * 1000

    @Volatile private var instance: CaptureQueue? = null

    fun get(context: Context): CaptureQueue =
      instance ?: synchronized(this) {
        instance ?: CaptureQueue(context).also { instance = it }
      }
  }
}
