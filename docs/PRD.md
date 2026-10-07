# Zero-Entry Expense Tracker — Product Requirements

Oct 7, 2026 · Ajay Singh · Source of truth: when this file and `docs/ROADMAP.md` disagree, this file wins.

## Product overview

An Android expense tracker for the Indian market that logs spending automatically, so users never
have to type an expense. Transactions are captured from bank and UPI notifications, parsed on the
phone, and confirmed with one swipe.

**Core promise:** zero manual entry for most transactions, with privacy-first processing on the device.

**Goals for the first release**

- Capture a majority of a user's real transactions automatically (target to be set after the
  capture-rate audit, see Current status).
- Keep every captured expense one swipe away from confirmed.
- Keep AI costs low enough that a free tier is sustainable.
- Pass Google Play review on the first submission.

**Success metrics to track from day one**

| Metric | What it measures |
| --- | --- |
| Capture rate | Captured transactions ÷ actual transactions on the user's statement |
| Parse success rate | Share of captures parsed by local rules without AI |
| Confirm rate | Share of drafts confirmed without edits |
| Day-7 and day-30 retention | Whether users keep the app |
| AI cost per active user per month | Whether the free tier is sustainable |

Targets for these numbers are not set yet; set them after the first device tests and the one-week audit.

## Target users and use cases

The first users are Android owners in India who pay mostly through UPI and cards and want to know
where their money goes without the effort of logging it.

| User | Need | Core use case |
| --- | --- | --- |
| Young professional | See monthly spending without effort | Auto-captured UPI and card spends, monthly overview |
| Student | Stay within a tight budget | Category totals, later budget alerts |
| Household manager | Track home and grocery spending | Receipt capture, category breakdown |
| Freelancer or small trader | Separate spending and income | Credits and debits captured, export to CSV or PDF |

Out of scope for the first release: iOS, multi-currency, shared family accounts, and direct bank
account linking.

## Feature requirements

The MVP does one thing well: expenses get logged without typing. Everything else waits until
capture works on real devices.

| Feature | Release | Requirement |
| --- | --- | --- |
| Notification capture | MVP (built) | Allowlisted bank and UPI apps; OTPs never stored; durable native queue |
| SMS-app capture | MVP, opt-in | Off by default; separate consent; MessagingStyle support |
| Rule parser | MVP | Regex per sender; extracts amount, type, merchant, date, account hint |
| Category map | MVP | Merchant to category; learns from user corrections |
| AI fallback | MVP | Only for text the rules cannot parse; strict JSON output |
| Draft inbox | MVP | Swipe to confirm; tap to edit amount, merchant, category |
| Manual and voice entry | MVP | Fallback for cash and missed transactions |
| Monthly overview | MVP | Category breakdown, trend vs last month, top merchants |
| Consent and disclosure | MVP | Clear explanation before notification access is requested |
| App lock | MVP | Biometric or device PIN |
| Battery-optimization guide | MVP | Required step for Xiaomi, Oppo, Vivo, Samsung |
| Receipt OCR | v1.1 | ML Kit on-device first, AI only for messy text |
| Home-screen widget | v1.1 | Spent today and this month, quick add |
| Budgets and alerts | v1.1 | Per-category monthly limits |
| Export | v1.1 | CSV and PDF |
| Cloud backup and sync | Later | Encrypted, opt-in |
| AI monthly insights | Later, premium | Spending patterns and saving suggestions |
| Subscription | Later | Play Billing via RevenueCat or react-native-iap |
| Regional-language alerts | Later | Parse Hindi and other regional bank messages |

## Key user flows

**Onboarding (first launch)**

1. Welcome screen states the promise: expenses logged automatically.
2. Privacy screen explains what is read, what is never stored (OTPs, personal messages), that
   parsing happens on the phone, and that **text the phone cannot parse is sent to our server for
   AI parsing** (names and full account numbers removed first).
3. User grants notification access via the system settings deep link; the app rechecks on return.
4. Optional: user opts in to SMS-app capture after a separate explanation.
5. Battery-optimization step with device-specific instructions.
6. App lock setup, then the empty inbox with a "make a test payment" hint.

**Capture to confirm**

1. A payment notification arrives; the native listener filters and queues it.
2. When the app opens (or is already open), the queue drains into the raw captures table.
3. The rule parser extracts fields; unparsed text goes to the AI fallback.
4. The category map assigns a category.
5. A draft appears in the inbox; the user swipes to confirm or taps to edit.
6. Edits update the user's merchant map so the next one is right.

**Review**

1. Home shows spent today and this month.
2. Overview shows category breakdown, trend vs last month, top merchants.
3. Tapping a category lists its transactions, each editable.

## Architecture and data flow

```
Capture (notification listener | manual | voice)            [receipt OCR in v1.1]
 → native durable queue (fetch-then-acknowledge)
 → raw_captures (JS DB, upsert on id, unique dedup_key)
 → on-device rule parser
 → AI fallback (backend function, only when rules fail)
 → category map (merchant overrides > merchant default > keyword rules)
 → draft inbox (user confirms / edits)
 → transactions (local DB)                                  [cloud sync later]
```

User corrections in the inbox flow back into the category map, so the same merchant is
categorized correctly next time.

## Tech stack

| Layer | Choice | Status |
| --- | --- | --- |
| App framework | React Native 0.87.1, bare, New Architecture, Hermes | In repo |
| Android SDK | Min 24, target 36, compile 37 | In repo |
| Native capture | Kotlin NotificationListenerService + TurboModule | Built |
| Local database | op-sqlite | Chosen (PRD recommendation) |
| State | Zustand for UI state; database as source of truth | To add |
| Navigation | React Navigation | To add |
| Charts | Victory Native (Skia-based) | To add |
| On-device OCR | Google ML Kit text recognition | v1.1 |
| Backend | Supabase (auth, Edge Functions, Postgres) or Firebase | To decide |
| AI | Small, cheap model via backend only (e.g. Claude Haiku or Gemini Flash, paid tier) | To decide |
| Payments | RevenueCat or react-native-iap with Play Billing | Later |
| Testing | Jest for TypeScript, JUnit for Kotlin, adb device tests | Partly set up |

Library choices marked "to add" are recommendations; confirm each one supports this React Native
version before installing.

## Data model

Raw captures and parsed transactions are kept in separate tables, so raw text can be re-parsed
whenever the parser improves.

| Table | Key fields | Purpose |
| --- | --- | --- |
| raw_captures | id (from native queue), dedup_key (unique), source (notification, sms, receipt, voice), package_name, title, body, posted_at, parse_status, parser_version | Input as captured (account numbers already redacted natively); upsert on id |
| transactions | id, raw_capture_id, amount_paise, direction (debit or credit), merchant_raw, merchant_id, category_id, account_hint, occurred_at, status (draft, confirmed, ignored), parsed_by (rule, ai, manual), possible_duplicate_of | The expenses the user sees |
| merchants | id, normalized_name, display_name, default_category_id | One row per merchant |
| merchant_overrides | merchant_id, category_id, updated_at | The user's own corrections |
| categories | id, name, icon, is_default | Food, transport, bills, shopping, etc. |
| parser_rules | id, sender_pattern, regex, version | Optional: rules updatable without an app release |
| settings | key, value | Capture toggles, app lock, onboarding state |

Store money as integer paise, never floats. Never store OTPs or full account numbers; keep only
the last 4 digits as the account hint. Unmasked account/card numbers are redacted to their last 4
digits in the native layer before anything is written.

## AI integration and cost control

AI is a fallback, not the main path: local rules handle most text for free, and the model is
called only when they fail. Estimated cost is about $12 a month at 1,000 active users, an
approximate back-of-envelope figure.

**Rules**

- The API key lives only in a backend function (Supabase Edge Function or Firebase Cloud
  Function), never in the app.
- Send only the notification text needed to parse; strip names and full account numbers first.
- Require JSON-only output: amount, direction, merchant, date, category guess, confidence.
- Validate the JSON on the server; reject and log anything malformed (without logging the text).
- Cache results by normalized text so the same format is never sent twice.
- Per-user rate limits and a provider-side monthly spending cap.
- Log cost per user per month as a metric.
- Use a paid tier for real user data. Some free tiers allow the provider to use inputs to improve models.

**Cost estimate (approximate)**

| Call | Approx. tokens | Approx. cost each |
| --- | --- | --- |
| Parse one notification | 500 in, 100 out | $0.001 |
| Receipt image | larger, image input | a few tenths of a cent |
| Monthly insights per user | 3,000 in, 500 out | about half a cent |

Basis: Claude Haiku 4.5 listed at $1 per million input tokens and $5 per million output tokens
(Anthropic pricing page); the 1,000-user figure assumes 60 transactions per user a month and 20%
needing AI. Prices change often; recheck before launch.

## Privacy, security and Play Store compliance

Play Store approval is the biggest launch risk, because the app reads notifications that contain
financial data. Every point below must be checked against Google's current policy pages before
submission.

**Privacy rules (non-negotiable)**

- Never log notification content, in debug or release builds.
- Never store OTPs or verification codes; filter them before anything is written.
- Store only allowlisted, transaction-like notifications; nothing else leaves memory.
- No network calls from the native capture layer.
- Exclude capture and app databases from Android cloud backup **and device-to-device transfer**
  (`dataExtractionRules`; `allowBackup="false"` alone may not cover device transfer on Android 12+).
- Encrypt the app database (e.g. SQLCipher) before cloud sync ships.

**Play Store requirements**

- [ ] Prominent in-app disclosure before requesting notification access; it must mention the AI
      fallback sending unparsed text off the device
- [ ] Privacy policy hosted on a public URL and linked in the listing
- [ ] Data Safety form: on-device-only processing is not "collected" under Google's definition;
      the AI fallback makes **financial info** collected, and **messages (SMS)** only if SMS
      capture is enabled. Verify these definitions against Google's current help pages.
- [ ] Confirm whether reading SMS-app notifications is acceptable under the SMS and Call Log
      policy, or keep it disabled
- [ ] Closed test with the required number of testers if the developer account is new and personal
- [ ] Android restricts notification-access settings for sideloaded APKs; distribute test builds
      through Play testing tracks

**Legal**

- [ ] Review India's Digital Personal Data Protection Act, 2023 and which of its rules are in force at launch

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Reliability | No transaction lost once queued, across app kill, reboot, app update or force-stop. Notifications that arrive while the listener is unbound are recovered only if still in the shade |
| Dedup | Identical repeat payments (same amount, same merchant) must stay separate transactions. Possible duplicates are flagged in the inbox, never merged silently |
| Background | Listener rebinds after disconnect; works with the app closed |
| Battery | No polling or wake locks; event-driven only |
| Offline | Every feature except AI fallback and sync works with no internet |
| Performance | Expense saves feel instant; inbox and overview open without a visible delay |
| Security | App lock, no secrets in the APK, database excluded from backups |
| Accessibility | Screen-reader labels, readable contrast, large-text support |
| Devices | Tested on Samsung plus at least one Xiaomi, Oppo or Vivo phone |

## Testing strategy

| Level | What | Tool |
| --- | --- | --- |
| Parser fixtures | Real bank, UPI and SMS texts with expected amount, direction, merchant, date | Jest |
| Filter and dedup | OTP rejection, identical repeat payments, reposted notifications | JUnit (Kotlin) |
| Queue | Fetch, persist, acknowledge, 30-day expiry, crash mid-drain | JUnit + Jest |
| Device | Fake notifications posted via adb; reboot, update, force-stop, battery saver | adb on real phones |
| Capture-rate audit | One week of real use compared against the bank statement | Manual |
| Closed test | Real users on varied phones and banks | Play Console testing track |

Anonymize fixture texts before committing them: replace names, account digits and reference
numbers with fake values of the same shape.

## Roadmap

See `docs/ROADMAP.md`: four gated phases to launch, then v1.1. Prove capture on real phones first.

## Assumptions and items to verify

| Assumption | Why it matters | How to verify |
| --- | --- | --- |
| Many Indian banks send transaction alerts mainly by SMS | Notification-only capture may miss many transactions | One-week capture-rate audit |
| UPI apps may not notify for payments made inside the app | Outgoing UPI payments could be missed | Test with GPay, PhonePe, Paytm on a real phone |
| Reading SMS-app notifications may conflict with Play's SMS policy | Could block approval | Google Play policy pages; keep opt-in until confirmed |
| Play developer fee is a one-time $25 | Budget | Play Console signup page |
| New personal accounts need a closed test before production | Launch timeline | Play Console help pages |
| AI cost about $12 a month at 1,000 users | Free-tier viability | Measure real cost per user in closed test |
| DPDP Act rules in force at launch | Legal compliance | Official government sources |
