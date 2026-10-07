# ExpenseTracker — project context

Product requirements (source of truth): @docs/PRD.md · Phased plan: @docs/ROADMAP.md
When this file, the roadmap and the PRD disagree, **the PRD wins**.

## Product
Android expense tracker, Indian market first. Promise: **zero manual entry**. Bank/UPI app
notifications (SMS-app notifications only on explicit opt-in) are captured natively, parsed
on-device with regex, sent to an AI backend only when rules fail, and confirmed by the user in an
inbox with a swipe. Owner has ~3 years of React Native experience.

## Pipeline (all stages exist in code; none verified on a real device yet)
```
TransactionListenerService (Kotlin) → native SQLite queue (fetch-then-ack)
 → useTransactionCapture drain → persistCaptures → raw_captures (op-sqlite)
 → processCaptures: ruleParser → (AI fallback if confidence < floor) → categorize
 → draft transactions → Inbox (swipe confirm / ignore / edit) → Overview
Manual + voice entry → confirmed transactions directly
```

## Folder structure
```
App.tsx                         # loads settings → Onboarding | Lock | MainApp (tabs + stack)
specs/                          # TurboModule codegen specs (TransactionCapture, DeviceServices)
src/capture/                    # wrapper, drain hook, CaptureProvider (wires persist + pipeline)
src/db/                         # op-sqlite: database.ts (migrations), repository.ts, settings.ts
src/pipeline/processCaptures.ts # raw capture → draft (rules, AI retries, needs-details drafts)
src/parser/                     # ruleParser.ts (PARSER_VERSION), voiceParser.ts
src/categories/                 # default categories, keyword rules, categorize()
src/ai/aiFallback.ts            # redaction, backend call, strict result validation
src/device/                     # app lock, voice, battery settings (DeviceServices module)
src/screens/ src/ui/            # screens; theme (light/dark), components, SwipeRow, useDbQuery
src/state/store.ts              # zustand: UI state + `revision` bump after every DB write
android/.../capture/            # listener, filter, queue, config, TurboModule
android/.../device/             # DeviceServicesModule (BiometricPrompt, speech intent, battery)
supabase/                       # parse-transaction Edge Function + SQL migration (NOT deployed)
__tests__/                      # Jest: parser (synthetic fixtures), money, categorize, AI guards
docs/PRD.md docs/ROADMAP.md
```

## Key decisions and reasons
- **Notification listener, not READ_SMS**: SMS permissions are restricted on Play. SMS-app
  notifications are opt-in only, and may need removing before Play submission (PRD open item).
- **Native durable queue + ack**; JS `persist` must be durable and idempotent (upsert on id,
  unique `dedup_key`). At-least-once delivery.
- **Repeat payments stay separate (PRD).** Native dedup only drops exact reposts (same content
  AND same event time). Near-identical payments within 3 min are flagged `possible_duplicate_of`
  in the inbox, never merged.
- **Raw text kept separate from transactions**; `PARSER_VERSION` bump re-parses rule drafts.
- **Capture master switch** (`CaptureConfig.isCaptureEnabled`) is off until the disclosure is
  accepted; Settings can turn it off without revoking system access.
- **AI**: `claude-haiku-4-5` via Supabase Edge Function (PRD names Haiku); structured output,
  server + client validation, cache by text hash, per-install daily limit. `AI_PARSE_URL` empty
  in `src/config.ts` → AI disabled; unparsed captures become "needs details" drafts.
- **No Victory Native yet**: charts are plain Views to avoid Skia/Reanimated native risk on RN 0.87.

## Privacy rules (non-negotiable)
- Never log notification content (native or JS, debug or release). Log exception class names only.
- OTP filter runs first; when unsure, drop. Never store OTPs.
- Account/card numbers redacted natively to last 4 before storage; AI text further redacted.
- No secrets in the app bundle. `src/config.ts` holds only a URL and a publishable key.
- All stores excluded from cloud backup and device transfer (`res/xml/data_extraction_rules.xml`).

## Coding conventions
- Kotlin: 2-space indent, trailing commas, `object` singletons, `runCatching` in the service,
  KDoc explains *why*, raw `SQLiteOpenHelper`.
- TS: Prettier (repo `.prettierrc.js`, `{ x }` bracket spacing), strict types, named exports,
  DB access only through `src/db/*`, every write calls `notifyDataChanged()`.
- Money is integer paise everywhere (`src/domain/money.ts`).
- UI: "glass" design system in `src/ui/` — tokens in `theme.ts` (light + dark; no colour
  literals in screens), primitives in `components.tsx` (Screen, GlassCard, HeroCard, Button,
  ListRow, IconBadge, CategoryPicker…), `GlassTabBar.tsx`. Icons: `lucide-react-native` only
  (needs `react-native-svg`); category icon/colour from `categoryVisuals.ts`, not the DB emoji.
  Screens hide native headers and render `Screen title/onBack` themselves.
- Changing a spec requires a native rebuild (codegen). Don't rename module/spec names casually.

## Commands (Windows dev machine)
```bash
npm start                                # Metro
npm run android                          # build + install debug
cd android && ./gradlew assembleDebug    # native build only
npx tsc --noEmit && npm run lint && npm test
npx prettier --check App.tsx src specs __tests__
adb shell pm list packages | grep -iE "bank|pay|upi|sbi|hdfc|icici|axis|kotak|mms|messag"
adb shell cmd notification post -S bigtext -t "HDFC Bank" tag1 "Rs.500 debited from a/c XX1234 to Shop"
```
Shell-posted notifications come from `com.android.shell`; add it temporarily via Settings →
"Apps to read from" to test. Verify `cmd notification` syntax with `adb shell cmd notification help`.

## Current status (2026-10-07)
- MVP code complete per PRD feature table (except items below). `tsc`, `eslint`, `prettier`,
  Jest (32 tests), `assembleDebug`, and a Hermes compile of the release JS bundle all pass.
- Debug APK installed on the dev phone; the UI has **not** been seen running (phone was locked)
  and capture has **never** run on a real notification.
- Not done: device test plan, real-sample fixtures, backend deployment (`AI_PARSE_URL`), JUnit
  tests for Kotlin, release signing / R8, Play compliance items. See `docs/ROADMAP.md`.
- Unverified assumptions in code: default package names (`CaptureConfig.kt`), MessagingStyle
  bundle keys `"text"`/`"time"` (`TransactionFilter.kt`), OEM battery menu paths.
