package com.expensetracker.capture

import android.app.Notification
import android.service.notification.StatusBarNotification
import java.security.MessageDigest

data class CapturedNotification(
  val packageName: String,
  val title: String,
  val body: String,
  val postedAt: Long,
  /** Exact identity: package + title + body + Notification.when. */
  val dedupKey: String,
  /** Content identity: package + title + body, used for the short repost window. */
  val contentKey: String,
)

/**
 * Pure classification. Nothing in here touches storage; anything rejected is simply dropped
 * and only ever existed in memory.
 */
object TransactionFilter {

  // Checked first and unconditionally. Errs on the side of discarding: a real transaction
  // alert that also mentions "OTP" (e.g. a "never share your OTP" footer) is dropped too.
  private val OTP_PATTERNS = listOf(
    Regex("\\bOTP\\b", RegexOption.IGNORE_CASE),
    Regex("one[\\s-]?time[\\s-]?pass(word|code)?", RegexOption.IGNORE_CASE),
    Regex("\\b(verification|security|auth(entication)?|login|confirmation)\\s+code\\b", RegexOption.IGNORE_CASE),
    Regex("\\b(code|pin|passcode)\\s*(is|:)\\s*\\d{4,8}\\b", RegexOption.IGNORE_CASE),
    Regex("\\b\\d{4,8}\\s+is\\s+(your|the)\\b", RegexOption.IGNORE_CASE),
  )

  // A currency marker immediately followed by an amount: "₹500", "Rs.1,200.50", "INR 99".
  private val CURRENCY_AMOUNT = Regex(
    "(₹|\\bRs\\.?|\\bINR)\\s?[0-9][0-9,]*(\\.[0-9]{1,2})?",
    RegexOption.IGNORE_CASE,
  )

  private val TRANSACTION_KEYWORD = Regex(
    "\\b(debited|credited|paid|received|sent|spent|withdrawn|transferred|deposited|refunded|" +
      "refund|debit|credit|purchase|txn|transaction|payment)\\b",
    RegexOption.IGNORE_CASE,
  )

  fun isOtp(text: String): Boolean = OTP_PATTERNS.any { it.containsMatchIn(text) }

  fun isTransactionLike(text: String): Boolean =
    CURRENCY_AMOUNT.containsMatchIn(text) && TRANSACTION_KEYWORD.containsMatchIn(text)

  /**
   * Returns a capture candidate, or null if the notification should be ignored.
   * Caller is responsible for the allowlist check.
   */
  fun evaluate(sbn: StatusBarNotification): CapturedNotification? {
    val notification = sbn.notification ?: return null
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return null
    // "Payment in progress" style status notifications; the final alert is a normal one.
    if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return null

    val extras = notification.extras ?: return null
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim().orEmpty()

    // Big text is usually the untruncated version of text; keep both only if they differ.
    val body = when {
      bigText.isEmpty() -> text
      text.isEmpty() || bigText.contains(text) -> bigText
      else -> "$text\n$bigText"
    }
    if (body.isEmpty()) return null

    val combined = "$title\n$body"
    if (isOtp(combined)) return null
    if (!isTransactionLike(combined)) return null

    val contentKey = sha256("${sbn.packageName}\u0000$title\u0000$body")
    val dedupKey = sha256("$contentKey\u0000${notification.`when`}")

    return CapturedNotification(
      packageName = sbn.packageName,
      title = title,
      body = body,
      postedAt = sbn.postTime,
      dedupKey = dedupKey,
      contentKey = contentKey,
    )
  }

  private fun sha256(input: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(input.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
}
