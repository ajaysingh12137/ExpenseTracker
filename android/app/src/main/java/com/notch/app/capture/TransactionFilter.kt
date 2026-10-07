package com.notch.app.capture

import android.app.Notification
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import android.service.notification.StatusBarNotification
import java.security.MessageDigest

data class CapturedNotification(
  val packageName: String,
  val title: String,
  val body: String,
  val postedAt: Long,
  /** Exact identity: package + title + body + event time. Reposts of the same alert match. */
  val dedupKey: String,
  /** Content identity: package + title + body. Stored for diagnostics; never used to merge. */
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

  // "a/c 123456789012" -> "a/c XX9012". Banks usually mask already; this catches the ones that don't.
  private val LABELLED_ACCOUNT = Regex(
    "\\b(a/c|acct|account|card)(\\s*(?:no\\.?|number|ending(?:\\s+with)?)?\\s*[:#-]?\\s*)(\\d{5,})",
    RegexOption.IGNORE_CASE,
  )

  // 13-19 digit runs are card-number length. 12-digit UPI reference numbers are kept.
  private val CARD_LENGTH_DIGITS = Regex("(?<![\\d])\\d{13,19}(?![\\d])")

  fun isOtp(text: String): Boolean = OTP_PATTERNS.any { it.containsMatchIn(text) }

  fun isTransactionLike(text: String): Boolean =
    CURRENCY_AMOUNT.containsMatchIn(text) && TRANSACTION_KEYWORD.containsMatchIn(text)

  /** PRD: never store full account numbers; keep only the last 4 digits. */
  fun redactAccountNumbers(text: String): String =
    text
      .replace(LABELLED_ACCOUNT) { m -> "${m.groupValues[1]}${m.groupValues[2]}XX${m.groupValues[3].takeLast(4)}" }
      .replace(CARD_LENGTH_DIGITS) { m -> "XX${m.value.takeLast(4)}" }

  /**
   * Returns zero or more capture candidates. MessagingStyle notifications (SMS apps) can carry
   * several messages; each one is classified separately so one OTP doesn't hide a debit alert
   * next to it, and an OTP is never stored because a neighbour looked like a transaction.
   * Caller is responsible for the allowlist check.
   */
  fun evaluate(sbn: StatusBarNotification): List<CapturedNotification> {
    val notification = sbn.notification ?: return emptyList()
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return emptyList()
    // "Payment in progress" style status notifications; the final alert is a normal one.
    if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return emptyList()

    val extras = notification.extras ?: return emptyList()
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()

    val messages = messagingStyleTexts(extras)
    if (messages.isNotEmpty()) {
      return messages.mapNotNull { (text, time) ->
        candidate(sbn, title, text, if (time > 0) time else notification.`when`)
      }
    }

    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim().orEmpty()
    // Big text is usually the untruncated version of text; keep both only if they differ.
    val body = when {
      bigText.isEmpty() -> text
      text.isEmpty() || bigText.contains(text) -> bigText
      else -> "$text\n$bigText"
    }
    if (body.isNotEmpty()) {
      return listOfNotNull(candidate(sbn, title, body, notification.`when`))
    }

    // InboxStyle: one line per message, only used when there is no main text.
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.map { it.toString().trim() }
      ?.filter { it.isNotEmpty() }
      .orEmpty()
    return lines.mapNotNull { candidate(sbn, title, it, notification.`when`) }
  }

  private fun candidate(
    sbn: StatusBarNotification,
    title: String,
    rawBody: String,
    eventTime: Long,
  ): CapturedNotification? {
    val combinedRaw = "$title\n$rawBody"
    if (isOtp(combinedRaw)) return null
    if (!isTransactionLike(combinedRaw)) return null

    val safeTitle = redactAccountNumbers(title)
    val body = redactAccountNumbers(rawBody)
    val contentKey = sha256("${sbn.packageName}\u0000$safeTitle\u0000$body")
    val dedupKey = sha256("$contentKey\u0000$eventTime")

    return CapturedNotification(
      packageName = sbn.packageName,
      title = safeTitle,
      body = body,
      postedAt = sbn.postTime,
      dedupKey = dedupKey,
      contentKey = contentKey,
    )
  }

  /** (text, timestamp) per MessagingStyle message, read from the framework's bundle keys. */
  private fun messagingStyleTexts(extras: Bundle): List<Pair<String, Long>> {
    val parcelables: Array<out Parcelable>? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        extras.getParcelableArray(Notification.EXTRA_MESSAGES, Parcelable::class.java)
      } else {
        @Suppress("DEPRECATION")
        extras.getParcelableArray(Notification.EXTRA_MESSAGES)
      }
    if (parcelables.isNullOrEmpty()) return emptyList()
    return parcelables.mapNotNull { p ->
      val bundle = p as? Bundle ?: return@mapNotNull null
      val text = bundle.getCharSequence("text")?.toString()?.trim().orEmpty()
      if (text.isEmpty()) null else text to bundle.getLong("time", 0L)
    }
  }

  private fun sha256(input: String): String =
    MessageDigest.getInstance("SHA-256")
      .digest(input.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }
}
