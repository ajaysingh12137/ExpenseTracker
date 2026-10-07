package com.expensetracker.capture

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

  override fun onCreate() {
    super.onCreate()
    io = Executors.newSingleThreadExecutor()
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    io.execute { runCatching { CaptureQueue.get(this).purgeExpired() }.onFailure(::logError) }

    // Recover alerts posted while we were unbound (after reboot, rebind, or first grant) that
    // are still in the shade. Dedup makes re-processing already-captured ones a no-op.
    runCatching { activeNotifications }.getOrNull()?.forEach(::handle)
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn != null) handle(sbn)
  }

  private fun handle(sbn: StatusBarNotification) {
    if (!CaptureConfig.isAllowed(this, sbn.packageName)) return

    // Rejected notifications never leave this stack frame.
    val captured = runCatching { TransactionFilter.evaluate(sbn) }.getOrNull() ?: return

    io.execute {
      runCatching {
        if (CaptureQueue.get(this).enqueue(captured)) CaptureSignal.notifyCaptured()
      }.onFailure(::logError)
    }
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
  }
}
