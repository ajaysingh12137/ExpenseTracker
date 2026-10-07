package com.expensetracker.device

/**
 * Keeps the native splash on screen until JS has loaded settings and drawn its first frame,
 * so users never see a blank or half-rendered screen. JS opens the gate via
 * DeviceServices.hideSplash(); MainActivity also caps the wait (see MAX_HOLD_MS).
 */
object SplashGate {
  @Volatile var ready: Boolean = false

  /** Never hold the splash longer than this, even if JS fails to report ready. */
  const val MAX_HOLD_MS = 3_000L
}
