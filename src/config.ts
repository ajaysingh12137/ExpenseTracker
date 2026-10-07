/**
 * App configuration. No secrets belong here: everything in this file ships inside the APK.
 *
 * AI_PARSE_URL: HTTPS URL of the deployed `parse-transaction` backend function
 * (supabase/functions/parse-transaction). Empty string disables the AI fallback; unparsed
 * captures then stay in the inbox for the user to fill in.
 *
 * AI_PARSE_PUBLIC_KEY: a *publishable* key the backend uses to identify the app (for Supabase,
 * the anon key). It is not a secret and grants nothing by itself; the LLM key stays server-side.
 */
export const AI_PARSE_URL = '';
export const AI_PARSE_PUBLIC_KEY = '';

/** Abort AI calls after this long; the item stays queued for the next attempt. */
export const AI_TIMEOUT_MS = 15000;
