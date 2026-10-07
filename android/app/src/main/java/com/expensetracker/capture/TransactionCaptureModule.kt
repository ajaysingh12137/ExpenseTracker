package com.expensetracker.capture

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class TransactionCaptureModule(reactContext: ReactApplicationContext) :
  NativeTransactionCaptureSpec(reactContext) {

  private val io: ExecutorService = Executors.newSingleThreadExecutor()

  private val listenerComponent: ComponentName
    get() = ComponentName(reactApplicationContext, TransactionListenerService::class.java)

  override fun initialize() {
    super.initialize()
    CaptureSignal.setListener {
      // The JS side may be tearing down; a missed signal is harmless because the item is
      // already durable and the next foreground/mount drain picks it up.
      runCatching { emitOnCaptured() }
    }
  }

  override fun invalidate() {
    CaptureSignal.setListener(null)
    io.shutdown()
    super.invalidate()
  }

  override fun isPermissionGranted(promise: Promise) {
    promise.resolve(hasListenerAccess(reactApplicationContext))
  }

  private fun hasListenerAccess(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      val nm = context.getSystemService(NotificationManager::class.java)
      return nm?.isNotificationListenerAccessGranted(listenerComponent) == true
    }
    // API 24-26: no public query API; this secure setting is what the system itself uses.
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      ?: return false
    return flat.split(":").any { ComponentName.unflattenFromString(it) == listenerComponent }
  }

  override fun openPermissionSettings(promise: Promise) {
    val context = reactApplicationContext
    val candidates = buildList {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // Opens this app's toggle directly. Some OEM builds do not implement it, hence fallbacks.
        add(
          Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
            .putExtra(
              Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
              listenerComponent.flattenToString(),
            ),
        )
      }
      add(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
      add(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.fromParts("package", context.packageName, null)),
      )
    }

    val activity = reactApplicationContext.currentActivity
    for (intent in candidates) {
      try {
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        promise.resolve(true)
        return
      } catch (_: ActivityNotFoundException) {
        // Try the next, less specific screen.
      } catch (_: SecurityException) {
        // Some OEMs guard the detail screen; fall through.
      }
    }
    promise.resolve(false)
  }

  override fun getPending(limit: Double, promise: Promise) {
    io.execute {
      try {
        val items = CaptureQueue.get(reactApplicationContext).getPending(limit.toInt())
        val array = Arguments.createArray()
        for (item in items) {
          array.pushMap(
            Arguments.createMap().apply {
              putDouble("id", item.id.toDouble())
              putString("packageName", item.packageName)
              putString("title", item.title)
              putString("body", item.body)
              putDouble("postedAt", item.postedAt.toDouble())
              putDouble("capturedAt", item.capturedAt.toDouble())
            },
          )
        }
        promise.resolve(array)
      } catch (t: Throwable) {
        promise.reject("E_QUEUE_READ", "Failed to read capture queue", t)
      }
    }
  }

  override fun acknowledge(ids: ReadableArray, promise: Promise) {
    val parsed = ArrayList<Long>(ids.size())
    for (i in 0 until ids.size()) {
      if (ids.getType(i) == ReadableType.Number) parsed.add(ids.getDouble(i).toLong())
    }
    io.execute {
      try {
        promise.resolve(CaptureQueue.get(reactApplicationContext).acknowledge(parsed))
      } catch (t: Throwable) {
        promise.reject("E_QUEUE_ACK", "Failed to acknowledge capture queue items", t)
      }
    }
  }

  override fun setAllowedPackages(packages: ReadableArray, promise: Promise) {
    CaptureConfig.setPackages(reactApplicationContext, toStringList(packages))
    promise.resolve(null)
  }

  override fun setSmsPackages(packages: ReadableArray, promise: Promise) {
    CaptureConfig.setSmsPackages(reactApplicationContext, toStringList(packages))
    promise.resolve(null)
  }

  override fun setSmsAppsEnabled(enabled: Boolean, promise: Promise) {
    CaptureConfig.setSmsAppsEnabled(reactApplicationContext, enabled)
    promise.resolve(null)
  }

  override fun getCaptureConfig(promise: Promise) {
    val context = reactApplicationContext
    promise.resolve(
      Arguments.createMap().apply {
        putArray(
          "packages",
          Arguments.fromList(CaptureConfig.getPackages(context).sorted()),
        )
        putArray(
          "smsPackages",
          Arguments.fromList(CaptureConfig.getSmsPackages(context).sorted()),
        )
        putBoolean("smsAppsEnabled", CaptureConfig.isSmsAppsEnabled(context))
      },
    )
  }

  override fun resetCaptureConfig(promise: Promise) {
    CaptureConfig.reset(reactApplicationContext)
    promise.resolve(null)
  }

  private fun toStringList(array: ReadableArray): List<String> {
    val out = ArrayList<String>(array.size())
    for (i in 0 until array.size()) {
      if (array.getType(i) == ReadableType.String) array.getString(i)?.let(out::add)
    }
    return out
  }
}
