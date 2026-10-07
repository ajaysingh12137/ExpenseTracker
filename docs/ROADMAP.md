# Roadmap to Play Store launch

Legend: ✅ done · 🟡 partly done · ⬜ not started. Phases run in order. A phase is done when
its exit criteria are met, not when its code is written.

## Phase 0 — Capture module ✅ (code) / ⬜ (verified)
- ✅ Notification listener, filter, native queue, config, TurboModule, JS wrapper + hook.
- ✅ Debug build, `tsc`, `eslint` pass. (The service file was edited after the last APK build.)
- ⬜ First commit of the work so far.

## Phase 1 — Real-device testing ⬜
- Verify default package names: `adb shell pm list packages` on 3+ phones; fix `CaptureConfig`.
- Collect **real notification samples** (redacted) per bank/UPI app → these become Jest fixtures.
  Record which style each app uses (BigText / Inbox / MessagingStyle).
- Test plan per device: grant access, live capture, app killed, reboot, app update
  (`adb install -r`), force-stop, revoke + re-grant access, Doze/battery saver.
- Devices: at least one each of Xiaomi/Redmi, Samsung, Oppo/Vivo/Realme, a Pixel or near-stock phone.
- Exit: each scenario's result recorded (works / lost / duplicated) in `docs/device-test-log.md`.

## Phase 2 — Fixes from code review ⬜
1. Dedup: stop silently merging identical payments within 2 min; prefer surfacing possible
   duplicates in the inbox (`CaptureQueue.kt` isDuplicate).
2. Re-capture after 48 h: skip shade-recovered notifications older than the seen window, and/or
   expose `dedupKey` to JS so the JS DB enforces uniqueness permanently.
3. Backup / device transfer: add `dataExtractionRules` excluding capture DB + prefs (and the
   future JS DB).
4. Native "capture enabled" flag so in-app consent withdrawal stops capture without revoking
   system access.
5. Run `purgeExpired` periodically, not only on listener connect.
6. Handle `EXTRA_TEXT_LINES` (InboxStyle) if Phase 1 samples show it.
7. Prettier-format `src/` and `specs/`.
- Exit: Phase 1 scenarios re-run, all pass or are documented as known limitations.

## Phase 3 — JS database + `persist` ⬜
- Choose DB (decision pending: e.g. op-sqlite, WatermelonDB, Realm; check New Architecture /
  RN 0.87 support at the time of choosing).
- Tables: `raw_captures` (upsert on native id; also unique on dedupKey) separate from
  `transactions` (parsed, with `raw_capture_id`, parser version, status draft/confirmed).
- Implement `persist()`; wire `useTransactionCapture` in `App.tsx`.
- Exit: captured items survive app kill between persist and ack with no duplicates (tests).

## Phase 4 — Consent / disclosure screen ⬜
- Prominent disclosure **before** sending the user to notification-access settings.
- Separate opt-in toggle for SMS-app notifications.
- Pass `enabled` to the hook only after consent; persist consent + timestamp.
- Battery-optimization / autostart guidance screen (required on Xiaomi/Oppo/Vivo/Samsung).

## Phase 5 — On-device regex parser (test-first) ⬜
- Jest fixtures from Phase 1 samples **first**, then per-bank/app rules.
- Output: amount, direction (debit/credit), merchant/payee, account tail, ref no., timestamp,
  confidence. Version the parser; re-parse `raw_captures` on version bump.
- Merchant→category map with learning from user corrections.
- Exit: agreed parse-rate target on fixture set (target to be set after seeing samples).

## Phase 6 — AI fallback backend ⬜
- Serverless function; LLM key server-side only; strict JSON schema output, validated.
- Cache by normalized-text hash; rate limit; no raw text in server logs.
- Send only the unparsed notification text. Decide provider/model at build time.

## Phase 7 — Draft inbox UI ⬜
- List of drafts; swipe to confirm/reject; edit amount/merchant/category; duplicate hints.
- Navigation + state library chosen here.

## Phase 8 — Overview / charts ⬜
- Monthly totals, category breakdown, trend. Offline-first.

## Phase 9 — Receipt OCR ⬜
- ML Kit text recognition on-device → same parser/AI fallback → draft inbox.

## Phase 10 — Compliance + closed testing ⬜
- Privacy policy (hosted URL), Data Safety form, Notification listener / sensitive-data
  declarations. **Verify every policy point against Google's current Play docs**; policies change.
- Release keystore + Play App Signing (release build currently signs with debug key).
- Enable R8/minify and test the release build (TurboModule classes need to survive).
- Closed testing track; Play's minimum tester/duration requirements (verify current rules).

## Phase 11 — Launch ⬜
- Production rollout (staged), crash reporting without PII, feedback loop for unparsed formats.

## Later
Cloud sync, monthly AI insights, freemium subscription (insights, exports, budgets), voice entry.
