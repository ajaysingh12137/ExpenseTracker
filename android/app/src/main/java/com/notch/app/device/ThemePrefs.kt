package com.notch.app.device

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

/**
 * The user's theme choice ("system" | "light" | "dark"), persisted natively so it applies
 * before React starts: the launch splash, system dialogs (e.g. the app-lock prompt) and the
 * first JS frame all use the chosen theme, with no light/dark flash.
 */
object ThemePrefs {
  private const val PREFS = "notch_ui"
  private const val KEY_MODE = "theme_mode"
  private val MODES = setOf("system", "light", "dark")

  fun get(context: Context): String =
    context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_MODE, "system")
      ?.takeIf { it in MODES } ?: "system"

  fun set(context: Context, mode: String) {
    val safe = mode.takeIf { it in MODES } ?: "system"
    context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_MODE, safe)
      .apply()
    apply(safe)
  }

  /** Call on the main thread. */
  fun apply(mode: String) {
    AppCompatDelegate.setDefaultNightMode(
      when (mode) {
        "light" -> AppCompatDelegate.MODE_NIGHT_NO
        "dark" -> AppCompatDelegate.MODE_NIGHT_YES
        else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
      },
    )
  }
}
