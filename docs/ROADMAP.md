# Roadmap to Play Store launch

`docs/PRD.md` is the source of truth; this file only orders the work. Legend: ✅ done ·
🟡 partly done · ⬜ not started. A phase is done when its gate is met, not when its code is written.

## Phase 1 — Prove capture on real phones ⬜ (gate for everything else)
- ✅ Capture module: listener, filter, native queue, config, TurboModule, JS wrapper + hook.
- ✅ Capture fixes from review (2026-10-07): no silent merge of identical payments (inbox flags
  possible duplicates), `dedupKey` exposed to JS and unique in the JS DB, shade rescan skips items
  older than the seen window, account-number redaction, native capture on/off flag, periodic purge,
  `dataExtractionRules`, InboxStyle + MessagingStyle text extraction.
- ⬜ Verify default package names: `adb shell pm list packages` on 3+ phones; fix `CaptureConfig`.
- ⬜ Collect redacted real samples per bank/UPI app → Jest fixtures (replace the synthetic ones).
- ⬜ Device test plan: grant access, live capture, app killed, reboot, app update (`adb install -r`),
  force-stop, revoke + re-grant, Doze/battery saver. Record results in `docs/device-test-log.md`.
- ⬜ Devices: Samsung plus at least one Xiaomi/Redmi, Oppo/Realme or Vivo.
- ⬜ One-week capture-rate audit against a real bank statement (decides how important SMS opt-in is).
- **Gate:** every scenario recorded as works / lost / duplicated; losses fixed or documented.

## Phase 2 — MVP app 🟡 (code written, not device-tested)
- ✅ op-sqlite database: raw_captures, transactions, merchants, merchant_overrides, categories,
  settings; migrations; `persist()` with upsert on id.
- ✅ Rule parser (generic Indian bank/UPI formats, synthetic fixtures) + category map that learns
  from corrections.
- ✅ AI fallback client + Supabase Edge Function source (not deployed; app works without it).
- ✅ Draft inbox (swipe to confirm/ignore, edit), manual entry, voice entry (system speech dialog).
- ✅ Monthly overview: category breakdown, trend vs last month, top merchants.
- ✅ Onboarding: welcome, privacy disclosure, notification access, SMS opt-in, battery guide, app lock.
- ⬜ See the UI running on a phone (debug APK installed 2026-10-07 but the phone was locked; never viewed).
- ⬜ Deploy the backend function; set `AI_PARSE_URL`; per-user auth + rate limits.
- ⬜ JUnit tests for `TransactionFilter` and `CaptureQueue`.
- **Gate:** full capture → confirm flow works on the Phase 1 devices; parse-rate target set from
  real fixtures.

## Phase 3 — Compliance + closed test ⬜
- Privacy policy (public URL), Data Safety form, in-app disclosure text reviewed against current
  Google Play policy pages. Decide SMS-app capture: keep, or remove before submission.
- Release keystore + Play App Signing (release currently signs with the debug key).
- Enable R8/minify and test the release build (TurboModule classes must survive).
- DPDP Act review.
- Closed testing track with Play's current minimum testers/duration.
- **Gate:** closed-test feedback addressed; no capture-loss reports open.

## Phase 4 — Launch ⬜
- Staged production rollout, crash reporting without PII, feedback loop for unparsed formats,
  AI cost per user tracked.

## v1.1
Receipt OCR (ML Kit on-device first), home-screen widget, budgets and alerts, export (CSV, PDF).

## Later
Cloud backup and sync (encrypted, opt-in), AI monthly insights (premium), subscription,
regional-language alerts.
