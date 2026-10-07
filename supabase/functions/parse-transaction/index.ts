// Supabase Edge Function (Deno): AI fallback parser for notification text the app's rules could
// not parse. The Anthropic key lives only here (ANTHROPIC_API_KEY secret), never in the app.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=...
//   supabase db push            (applies supabase/migrations)
//   supabase functions deploy parse-transaction
// Then set AI_PARSE_URL / AI_PARSE_PUBLIC_KEY in src/config.ts.
//
// Privacy: request text is never logged. Only hashes, counts and error class names are.

import Anthropic from 'npm:@anthropic-ai/sdk';
import {createClient} from 'npm:@supabase/supabase-js@2';

// Model per docs/PRD.md ("small, cheap model via backend only"; cost estimate based on Haiku 4.5).
const MODEL = 'claude-haiku-4-5';
const DAILY_LIMIT_PER_INSTALL = 200;
const MAX_TEXT_CHARS = 1000;

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    is_transaction: {type: 'boolean'},
    amount: {type: 'string', description: 'Rupees as digits with optional 2 decimals, e.g. "1250.50". Empty if not a transaction.'},
    direction: {type: 'string', enum: ['debit', 'credit']},
    merchant: {anyOf: [{type: 'string'}, {type: 'null'}]},
    date: {anyOf: [{type: 'string', format: 'date'}, {type: 'null'}]},
    category: {anyOf: [{type: 'string'}, {type: 'null'}]},
    confidence: {type: 'number'},
  },
  required: ['is_transaction', 'amount', 'direction', 'merchant', 'date', 'category', 'confidence'],
  additionalProperties: false,
};

const SYSTEM = `You extract one completed financial transaction from an Indian bank, card or UPI \
notification. Account and reference numbers are already masked.
- is_transaction is false for OTPs, payment requests, bill reminders, offers, failed or pending payments.
- amount: the transaction amount in rupees (not the balance or a limit), digits only, e.g. "499.00".
- direction: "debit" if money left the user's account, "credit" if it arrived (refunds are credit).
- merchant: the payee or payer as written, or null.
- date: YYYY-MM-DD only if the text states it, else null.
- category: one id from the provided list, or null.
- confidence: 0 to 1, how sure you are of amount and direction.`;

type ParseResult = {
  is_transaction: boolean;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string | null;
  date: string | null;
  category: string | null;
  confidence: number;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

/** Same shape the app validates: rejects anything off-schema instead of coercing it. */
function isValid(v: ParseResult, categories: ReadonlySet<string>): boolean {
  if (typeof v.is_transaction !== 'boolean') return false;
  if (!v.is_transaction) return true;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(v.amount) || Number(v.amount) <= 0) return false;
  if (v.direction !== 'debit' && v.direction !== 'credit') return false;
  if (!(v.confidence >= 0 && v.confidence <= 1)) return false;
  if (v.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return false;
  if (v.category !== null && !categories.has(v.category)) v.category = null;
  return true;
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json(405, {error: 'method_not_allowed'});
  }
  const installId = req.headers.get('x-install-id') ?? '';
  if (!/^[a-f0-9-]{16,64}$/i.test(installId)) {
    return json(400, {error: 'missing_install_id'});
  }

  let text: string;
  let categories: string[];
  try {
    const body = await req.json();
    text = String(body.text ?? '').slice(0, MAX_TEXT_CHARS).trim();
    categories = Array.isArray(body.categories) ? body.categories.map(String).slice(0, 50) : [];
  } catch {
    return json(400, {error: 'bad_json'});
  }
  if (!text) {
    return json(400, {error: 'empty_text'});
  }

  // Cache by normalized text: the same alert format is never sent to the model twice.
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  const key = await sha256(normalized);
  const cached = await supabase.from('ai_parse_cache').select('result').eq('text_hash', key).maybeSingle();
  if (cached.data?.result) {
    return json(200, cached.data.result);
  }

  // Per-install daily rate limit (atomic increment in Postgres).
  const usage = await supabase.rpc('increment_ai_usage', {p_install_id: installId});
  if (usage.error) {
    console.error('usage_rpc_failed', usage.error.code);
    return json(503, {error: 'unavailable'});
  }
  if (Number(usage.data) > DAILY_LIMIT_PER_INSTALL) {
    return json(429, {error: 'rate_limited'});
  }

  let result: ParseResult;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Category ids: ${categories.join(', ') || '(none)'}\n\nNotification:\n${text}`,
        },
      ],
      output_config: {format: {type: 'json_schema', schema: OUTPUT_SCHEMA}},
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      console.error('model_stop', response.stop_reason);
      return json(502, {error: 'model_incomplete'});
    }
    const block = response.content.find(b => b.type === 'text');
    result = JSON.parse(block && block.type === 'text' ? block.text : '');
    console.log('usage', {
      in: response.usage.input_tokens,
      out: response.usage.output_tokens,
      install: await sha256(installId),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error('anthropic_rate_limited');
      return json(503, {error: 'unavailable'});
    }
    if (error instanceof Anthropic.APIError) {
      console.error('anthropic_api_error', error.status);
      return json(502, {error: 'unavailable'});
    }
    console.error('parse_failed', error instanceof Error ? error.name : 'unknown');
    return json(502, {error: 'unavailable'});
  }

  if (!isValid(result, new Set(categories))) {
    console.error('invalid_model_output');
    return json(502, {error: 'invalid_output'});
  }

  await supabase.from('ai_parse_cache').upsert({text_hash: key, result});
  return json(200, result);
});
