package com.notch.app.capture

import android.content.Context
import android.content.SharedPreferences

/**
 * Capture health, for the in-app "Capture health" screen. Stores only counts and timestamps per
 * source package -- never notification text -- so users and support can see whether alerts are
 * arriving and why any were skipped.
 */
object CaptureStats {
  private const val PREFS = "capture_stats"
  private const val KEY_CONNECTED_AT = "listener_connected_at"
  private const val KEY_DISCONNECTED_AT = "listener_disconnected_at"
  private const val KEY_SINCE = "since"

  /** True while the system has our listener bound (same process as the app). */
  @Volatile var listenerConnected: Boolean = false

  enum class Field(val key: String) {
    SEEN("seen"),
    CAPTURED("captured"),
    DUPLICATE("dup"),
    OTP("otp"),
    OTHER("other"),
  }

  data class SourceStat(
    val packageName: String,
    val seen: Long,
    val captured: Long,
    val duplicate: Long,
    val droppedOtp: Long,
    val droppedOther: Long,
    val lastSeenAt: Long,
    val lastCapturedAt: Long,
  )

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @Synchronized
  fun record(context: Context, packageName: String, counts: Map<Field, Int>, now: Long) {
    val p = prefs(context)
    val edit = p.edit()
    if (!p.contains(KEY_SINCE)) edit.putLong(KEY_SINCE, now)
    for ((field, n) in counts) {
      if (n <= 0) continue
      val key = "$packageName|${field.key}"
      edit.putLong(key, p.getLong(key, 0) + n)
    }
    edit.putLong("$packageName|last", now)
    if ((counts[Field.CAPTURED] ?: 0) > 0) edit.putLong("$packageName|lastCaptured", now)
    edit.apply()
  }

  fun onConnected(context: Context, now: Long) {
    listenerConnected = true
    prefs(context).edit().putLong(KEY_CONNECTED_AT, now).apply()
  }

  fun onDisconnected(context: Context, now: Long) {
    listenerConnected = false
    prefs(context).edit().putLong(KEY_DISCONNECTED_AT, now).apply()
  }

  fun connectedAt(context: Context): Long = prefs(context).getLong(KEY_CONNECTED_AT, 0)

  fun disconnectedAt(context: Context): Long = prefs(context).getLong(KEY_DISCONNECTED_AT, 0)

  fun since(context: Context): Long = prefs(context).getLong(KEY_SINCE, 0)

  fun sources(context: Context): List<SourceStat> {
    val all = prefs(context).all
    val packages = all.keys.mapNotNull { key -> key.substringBefore('|', "").ifEmpty { null } }.toSet()
    fun long(key: String) = (all[key] as? Long) ?: 0L
    return packages
      .map { pkg ->
        SourceStat(
          packageName = pkg,
          seen = long("$pkg|seen"),
          captured = long("$pkg|captured"),
          duplicate = long("$pkg|dup"),
          droppedOtp = long("$pkg|otp"),
          droppedOther = long("$pkg|other"),
          lastSeenAt = long("$pkg|last"),
          lastCapturedAt = long("$pkg|lastCaptured"),
        )
      }
      .sortedByDescending { it.lastSeenAt }
  }

  fun reset(context: Context) {
    val p = prefs(context)
    val connected = p.getLong(KEY_CONNECTED_AT, 0)
    val disconnected = p.getLong(KEY_DISCONNECTED_AT, 0)
    p.edit()
      .clear()
      .putLong(KEY_CONNECTED_AT, connected)
      .putLong(KEY_DISCONNECTED_AT, disconnected)
      .putLong(KEY_SINCE, System.currentTimeMillis())
      .apply()
  }
}
