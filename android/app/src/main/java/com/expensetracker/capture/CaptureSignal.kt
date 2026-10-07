package com.expensetracker.capture

/**
 * In-process "something new was queued" signal from the listener service to the TurboModule.
 * The service and the React runtime share a process, so no broadcast is needed. When JS is
 * not running there is no listener and the signal is dropped; the item is still in the queue.
 */
object CaptureSignal {
  @Volatile private var listener: (() -> Unit)? = null

  fun setListener(value: (() -> Unit)?) {
    listener = value
  }

  fun notifyCaptured() {
    listener?.invoke()
  }
}
