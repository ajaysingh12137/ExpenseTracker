package com.notch.app.capture

import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class TransactionListenerService : NotificationListenerService() {

  // Callbacks arrive on the main thread; SQLite work goes to a single background thread so
  // inserts stay ordered and the main thread is never blocked.
  private lateinit var io: ExecutorService

  // Only touched on the io thread.
  private var lastPurgeAt = 0L

  override fun onCreate() {
    super.onCreate()
    io = Executors.newSingleThreadExecutor()
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    io.execute { purgeIfDue(force = true) }

    // Recover alerts posted while we were unbound (after reboot, rebind, or first grant) that
    // are still in the shade. Dedup makes re-processing already-captured ones a no-op. Items
    // older than the seen window are skipped: their dedup hash may have expired, and the JS
    // database's unique dedup_key would be the only thing stopping a re-capture.
    val cutoff = System.currentTimeMillis() - CaptureQueue.SEEN_TTL_MS
    runCatching { activeNotifications }.getOrNull()
      ?.filter { it.postTime >= cutoff }
      ?.forEach(::handle)
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn != null) handle(sbn)
  }

  private fun handle(sbn: StatusBarNotification) {
    if (!CaptureConfig.isAllowed(this, sbn.packageName)) return

    // Rejected notifications never leave this stack frame.
    val captured = runCatching { TransactionFilter.evaluate(sbn) }.getOrNull()
    if (captured.isNullOrEmpty()) return

    io.execute {
      runCatching {
        val queue = CaptureQueue.get(this)
        var added = false
        for (item in captured) {
          if (queue.enqueue(item)) added = true
        }
        if (added) CaptureSignal.notifyCaptured()
        purgeIfDue(force = false)
      }.onFailure(::logError)
    }
  }

  /** Runs on the io thread. Keeps 30-day / 48-hour expiry working on long-lived listeners. */
  private fun purgeIfDue(force: Boolean) {
    val now = System.currentTimeMillis()
    if (!force && now - lastPurgeAt < PURGE_INTERVAL_MS) return
    runCatching { CaptureQueue.get(this).purgeExpired(now) }.onFailure(::logError)
    lastPurgeAt = now
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    // Ask the system to bind us again (API 24+, matches minSdk). Has no effect if the user
    // revoked notification access.
    requestRebind(ComponentName(this, TransactionListenerService::class.java))
  }

  override fun onDestroy() {
    io.shutdown()
    super.onDestroy()
  }

  private fun logError(t: Throwable) {
    // Never log notification content.
    Log.e(TAG, "Capture failed: ${t.javaClass.simpleName}")
  }

  private companion object {
    const val TAG = "TransactionCapture"
    const val PURGE_INTERVAL_MS = 6L * 60 * 60 * 1000
  }
}
