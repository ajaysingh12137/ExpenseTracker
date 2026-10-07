# ExpenseTracker — project context

## Product
AI-powered expense tracker for **Android, Indian market first**. Promise: **zero manual entry**.
Transactions are captured from bank/UPI app notifications (SMS-app notifications only on explicit
opt-in), parsed on-device with regex, and sent to an LLM backend only when local parsing fails.
User confirms drafts in an inbox with a swipe. Later: freemium subscription (AI insights,
exports, budgets). Owner has ~3 years of React Native experience.

## Architecture (target pipeline)
```
Capture (notification listener | receipt OCR via ML Kit | voice/manual)
 → on-device rule parser (regex per bank, free)
 → merchant→category map (learns from user corrections)
 → AI fallback for unparsed text only (serverless fn → LLM, strict JSON, cached)
 → draft inbox (user confirms)
 → local offline-first DB → cloud sync + monthly AI insights
```
Only the **capture** stage exists today. See `docs/ROADMAP.md`.

### Capture module (built, not yet device-tested)
Native, `android/app/src/main/java/com/expensetracker/capture/`:
- `TransactionListenerService.kt` — `NotificationListenerService`. Allowlist check → filter →
  enqueue on a single background executor. On connect: purges expired rows, rescans
  `activeNotifications`. Requests rebind on disconnect.
- `TransactionFilter.kt` — pure classifier. Drops OTP-like text first, then requires a currency
  amount AND a transaction keyword. Builds `contentKey` = sha256(pkg+title+body) and
  `dedupKey` = sha256(contentKey+`Notification.when`).
- `CaptureQueue.kt` — native SQLite `transaction_capture.db`. `pending` holds raw text until JS
  acks it (30-day TTL); `seen` holds hashes only (48 h TTL; 2-min content-only repost window).
- `CaptureConfig.kt` — package allowlists in SharedPreferences (`transaction_capture_config`).
  Default package names are **unverified**. SMS apps are off by default.
- `CaptureSignal.kt` — in-process "new item" callback from service → TurboModule.
- `TransactionCaptureModule.kt` / `TransactionCapturePackage.kt` — TurboModule
  `TransactionCapture`, registered manually in `MainApplication.kt`.

JS/TS:
- `specs/NativeTransactionCapture.ts` — codegen spec (`codegenConfig` in `package.json`,
  generated Java package `com.expensetracker.capture`). Event: `onCaptured` (payload-free).
- `src/capture/transactionCapture.ts` — typed wrappers + `drainQueue(persist)`: single-flight
  fetch → persist → acknowledge loop. Native module is loaded lazily (Android-only).
- `src/capture/useTransactionCapture.ts` — hook: drains on mount, on `onCaptured`, and on
  foreground; tracks permission. `enabled=false` pauses draining (not capture).

**Contract:** `persist` must be durable before it resolves and must upsert on `item.id`
(at-least-once delivery: a crash between persist and ack redelivers the batch).

## Tech stack (as found in repo)
React Native 0.87.1 (New Architecture on, Hermes on) · React 19.2.3 · TypeScript ^6.0.3 ·
Kotlin 2.2.0 · Gradle 9.4.1 · compileSdk 37 / targetSdk 36 / minSdk 24 · buildTools 37.0.0 ·
NDK 27.1.12297006 · Node >= 22.11 · Jest 29 · ESLint 8 (`@react-native`) · Prettier 2.8.8.
No database, navigation, state or UI libraries installed yet. iOS folder is template only (not a target).

## Folder structure
```
App.tsx                  # still the RN template screen
specs/                   # TurboModule codegen specs
src/capture/             # JS side of notification capture
android/app/src/main/java/com/expensetracker/
  MainApplication.kt     # registers TransactionCapturePackage
  capture/               # native capture module
docs/ROADMAP.md          # phased plan to Play Store launch
__tests__/               # Jest
```

## Key decisions and reasons
- **Notification listener, not READ_SMS**: SMS permissions are heavily restricted on Play;
  bank/UPI app notifications cover most flows. Reading SMS-app notifications is opt-in only.
- **Native durable queue + ack**: the listener runs without the JS runtime; items must survive
  until JS has persisted them.
- **Raw text kept separate from parsed transactions** (planned): lets the parser improve and
  re-parse old captures later.
- **Regex first, LLM only as fallback**: cost, latency, privacy.
- **LLM calls go through our backend**: API keys never ship in the app.
- **Draft inbox**: parser output is never trusted silently; the user confirms.

## Privacy rules (non-negotiable)
- **Never log notification content** (title, body, amounts, merchants), in native or JS code,
  including debug logs and error messages. Log exception class names only.
- **Never store OTPs.** The OTP filter runs before anything else; when unsure, drop.
- **No API keys or secrets in the app bundle.** AI goes through the backend.
- Keep the minimum data: rejected notifications never leave memory; `seen` stores hashes only.
- Send text to the AI backend only when on-device parsing fails, and only the minimum text needed.
- Any new on-device store with personal data must be excluded from backup/device transfer.

## Coding conventions (observed)
- Kotlin: 2-space indent, trailing commas, `object` singletons for stateless helpers,
  `runCatching` around anything that touches notifications or storage in the service,
  KDoc explains *why*. SQLite via raw `SQLiteOpenHelper`, no Room.
- TS: strict types, `type` over `interface` except for the TurboModule `Spec`, named exports,
  refs to keep hook effects stable, comments explain intent.
- **Formatting:** `.prettierrc.js` (singleQuote, trailingComma all, arrowParens avoid,
  default bracketSpacing). `src/` and `specs/` currently **fail `prettier --check`**
  (written as `{Foo}`, not `{ Foo }`). Run prettier on them in a dedicated formatting change.
- Do not change native module or spec names without regenerating codegen.

## Commands (Windows dev machine; adjust paths elsewhere)
```bash
npm start                               # Metro
npm run android                         # build + install debug
cd android && ./gradlew assembleDebug   # native build only (gradlew.bat in cmd/PowerShell)
npx tsc --noEmit                        # type check
npm run lint                            # eslint
npx prettier --check src specs App.tsx  # formatting
npm test                                # jest
adb shell pm list packages | grep -iE "bank|pay|upi|sbi|hdfc|icici|axis|kotak|mms|messag"
adb shell cmd notification post -S bigtext -t "HDFC Bank" tag1 "Rs.500 debited from a/c XX1234 to Shop"
```
(I have not checked the `cmd notification post` syntax on this repo's devices. Notifications
posted from the shell come from the `com.android.shell` package, so add that package to the
allowlist temporarily when testing.)

## Current status (2026-10-07)
- Capture module written, debug APK built, `tsc`/`eslint`/`jest` pass. **Never run on a device.**
- Nothing is committed yet (no commits; capture/ and src/ are untracked).
- `App.tsx` is still the template. No DB, no `persist`, no consent UI, no parser.
- Review findings to fix before building further: see `docs/ROADMAP.md` Phase 2.
