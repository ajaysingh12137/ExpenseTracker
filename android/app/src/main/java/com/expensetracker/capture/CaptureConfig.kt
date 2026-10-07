package com.expensetracker.capture

import android.content.Context
import android.content.SharedPreferences

/**
 * Allowlist of notification sources, persisted in SharedPreferences so JS can update it at
 * runtime and the listener service can read it without the JS runtime being alive.
 *
 * EVERY default package name below is "verify on device". They are best-effort values for
 * common Indian bank/UPI/SMS apps; app publishers can and do change package names, and some
 * OEM builds ship different SMS apps. List what is actually installed with:
 *
 *   adb shell pm list packages | grep -iE "bank|pay|upi|sbi|hdfc|icici|axis|kotak|mms|messag"
 *
 * and replace these via setAllowedPackages / setSmsPackages from JS.
 */
object CaptureConfig {
  private const val PREFS_NAME = "transaction_capture_config"
  private const val KEY_PACKAGES = "allowed_packages"
  private const val KEY_SMS_PACKAGES = "sms_packages"
  private const val KEY_SMS_ENABLED = "sms_apps_enabled"
  private const val KEY_CAPTURE_ENABLED = "capture_enabled"

  /** Bank and UPI apps. Verify on device. */
  val DEFAULT_PACKAGES: Set<String> = setOf(
    "com.google.android.apps.nbu.paisa.user", // Google Pay (India) - verify on device
    "com.phonepe.app", // PhonePe - verify on device
    "net.one97.paytm", // Paytm - verify on device
    "in.org.npci.upiapp", // BHIM - verify on device
    "com.sbi.lotusintouch", // YONO SBI - verify on device
    "com.csam.icici.bank.imobile", // ICICI iMobile - verify on device
    "com.snapwork.hdfc", // HDFC Bank MobileBanking - verify on device
    "com.axis.mobile", // Axis Mobile - verify on device
    "com.msf.kbank.mobile", // Kotak - verify on device
  )

  /**
   * SMS apps where bank alerts arrive. Disabled by default: reading SMS content through the
   * SMS app's notifications is the part of this feature most likely to draw Play policy
   * scrutiny, so the user must opt in explicitly. Verify on device.
   */
  val DEFAULT_SMS_PACKAGES: Set<String> = setOf(
    "com.google.android.apps.messaging", // Google Messages - verify on device
    "com.samsung.android.messaging", // Samsung Messages - verify on device
    "com.android.mms", // AOSP / several OEM builds - verify on device
  )

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun getPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_PACKAGES, null)?.toSet() ?: DEFAULT_PACKAGES

  fun getSmsPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_SMS_PACKAGES, null)?.toSet() ?: DEFAULT_SMS_PACKAGES

  fun isSmsAppsEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_SMS_ENABLED, false)

  /**
   * Master switch, off until the user accepts the in-app disclosure. Lets the user withdraw
   * consent inside the app without having to find the system notification-access screen.
   */
  fun isCaptureEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_CAPTURE_ENABLED, false)

  fun setCaptureEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_CAPTURE_ENABLED, enabled).apply()
  }

  fun setPackages(context: Context, packages: Collection<String>) {
    prefs(context).edit().putStringSet(KEY_PACKAGES, sanitize(packages)).apply()
  }

  fun setSmsPackages(context: Context, packages: Collection<String>) {
    prefs(context).edit().putStringSet(KEY_SMS_PACKAGES, sanitize(packages)).apply()
  }

  fun setSmsAppsEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_SMS_ENABLED, enabled).apply()
  }

  /** Restores default allowlists. Keeps the consent-driven capture switch as it is. */
  fun reset(context: Context) {
    prefs(context).edit()
      .remove(KEY_PACKAGES)
      .remove(KEY_SMS_PACKAGES)
      .remove(KEY_SMS_ENABLED)
      .apply()
  }

  fun isAllowed(context: Context, packageName: String): Boolean {
    if (packageName == context.packageName) return false
    if (!isCaptureEnabled(context)) return false
    if (packageName in getPackages(context)) return true
    return isSmsAppsEnabled(context) && packageName in getSmsPackages(context)
  }

  // Android package names: dot-separated segments of [A-Za-z0-9_], each starting with a letter.
  private val PACKAGE_NAME = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")

  private fun sanitize(packages: Collection<String>): Set<String> =
    packages.map { it.trim() }.filter { PACKAGE_NAME.matches(it) }.toSet()
}
