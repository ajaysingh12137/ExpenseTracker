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

/** Result of classifying one notification. Drop reasons are counts only, never text. */
class Evaluation {
  val captured = mutableListOf<CapturedNotification>()
  var droppedOtp = 0
  var droppedOther = 0
}

/**
 * Pure classification. Nothing in here touches storage; anything rejected is simply dropped
 * and only ever existed in memory.
 */
object TransactionFilter {

  // OTP-family words.
  private const val OTP_WORD =
    "(?:OTP|one[\\s-]?time[\\s-]?pass(?:word|code)?|verification\\s+code|security\\s+code|" +
      "auth(?:entication)?\\s+code|login\\s+code|confirmation\\s+code|passcode)"

  // Checked first and unconditionally. A message is an OTP when it has an OTP-family word
  // *together with a code*: "OTP is 482913", "482913 is your OTP", "OTP for txn of Rs 500 at
  // X is 482913". A "Never share your OTP" footer on a debit alert has no code, so that alert
  // is kept: nothing secret can be stored from it. Ambiguous cases still drop.
  private val OTP_PATTERNS = listOf(
    // "OTP: 1234", "OTP is 123456", "OTP-123456"
    Regex("\\b$OTP_WORD\\b\\W{0,12}(?:is\\W{0,4})?\\d{4,8}\\b", RegexOption.IGNORE_CASE),
    // "OTP for txn of Rs 500 at X is 482913" (code later in the same sentence)
    Regex("\\b$OTP_WORD\\b.{0,80}?\\b(?:is|:)\\s*\\d{4,8}\\b", RegexOption.IGNORE_CASE),
    // "482913 is your OTP", "Use 482913 as your verification code"
    Regex("\\b\\d{4,8}\\b\\W{0,6}(?:is|as)\\s+(?:your|the)?\\s*$OTP_WORD", RegexOption.IGNORE_CASE),
    // "code is 1234", "PIN: 1234"
    Regex("\\b(?:code|pin|passcode)\\s*(?:is|:)\\s*\\d{4,8}\\b", RegexOption.IGNORE_CASE),
  )

  // A currency marker immediately followed by an amount: "₹500", "Rs.1,200.50", "INR 99".
  private val CURRENCY_AMOUNT = Regex(
    "(₹|\\bRs\\.?|\\bINR)\\s?[0-9][0-9,]*(\\.[0-9]{1,2})?",
    RegexOption.IGNORE_CASE,
  )

  // Some bank SMS omit the currency: "A/C X1234 debited by 1.0 on date ...".
  private val VERB_AMOUNT = Regex(
    "\\b(debited|credited|paid|sent|received|spent|withdrawn|transferred|deposited)\\s+" +
      "(?:by|for|of|with)?\\s*[0-9][0-9,]*(\\.[0-9]{1,2})?\\b",
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
    TRANSACTION_KEYWORD.containsMatchIn(text) &&
      (CURRENCY_AMOUNT.containsMatchIn(text) || VERB_AMOUNT.containsMatchIn(text))

  /** PRD: never store full account numbers; keep only the last 4 digits. */
  fun redactAccountNumbers(text: String): String =
    text
      .replace(LABELLED_ACCOUNT) { m -> "${m.groupValues[1]}${m.groupValues[2]}XX${m.groupValues[3].takeLast(4)}" }
      .replace(CARD_LENGTH_DIGITS) { m -> "XX${m.value.takeLast(4)}" }

  /**
   * Classifies a notification into zero or more capture candidates. MessagingStyle
   * notifications (SMS apps) can carry several messages; each one is classified separately so
   * one OTP doesn't hide a debit alert next to it, and an OTP is never stored because a
   * neighbour looked like a transaction. Caller is responsible for the allowlist check.
   */
  fun evaluate(sbn: StatusBarNotification): Evaluation {
    val evaluation = Evaluation()
    val notification = sbn.notification ?: return evaluation
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return evaluation
    // "Payment in progress" style status notifications; the final alert is a normal one.
    if (notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return evaluation

    val extras = notification.extras ?: return evaluation
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()

    val messages = messagingStyleTexts(extras)
    if (messages.isNotEmpty()) {
      for ((text, time) in messages) {
        candidate(sbn, title, text, if (time > 0) time else notification.`when`, evaluation)
      }
      return evaluation
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
      candidate(sbn, title, body, notification.`when`, evaluation)
      return evaluation
    }

    // InboxStyle: one line per message, only used when there is no main text.
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.map { it.toString().trim() }
      ?.filter { it.isNotEmpty() }
      .orEmpty()
    for (line in lines) candidate(sbn, title, line, notification.`when`, evaluation)
    return evaluation
  }

  private fun candidate(
    sbn: StatusBarNotification,
    title: String,
    rawBody: String,
    eventTime: Long,
    evaluation: Evaluation,
  ) {
    val combinedRaw = "$title\n$rawBody"
    if (isOtp(combinedRaw)) {
      evaluation.droppedOtp++
      return
    }
    if (!isTransactionLike(combinedRaw)) {
      evaluation.droppedOther++
      return
    }

    val safeTitle = redactAccountNumbers(title)
    val body = redactAccountNumbers(rawBody)
    val contentKey = sha256("${sbn.packageName}\u0000$safeTitle\u0000$body")
    val dedupKey = sha256("$contentKey\u0000$eventTime")

    evaluation.captured += CapturedNotification(
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
