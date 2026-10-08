export type Direction = 'debit' | 'credit';

export type TransactionStatus = 'draft' | 'confirmed' | 'ignored';

export type ParsedBy = 'rule' | 'ai' | 'manual';

export type CaptureSource = 'notification' | 'sms' | 'receipt' | 'voice';

export type ParseStatus = 'pending' | 'parsed' | 'ai_pending' | 'failed';

/** Output of the rule parser or the AI fallback, before categorization. */
export type ParsedTransaction = {
  amountPaise: number;
  direction: Direction;
  merchantRaw: string | null;
  /** Last 4 digits only, never a full account number. */
  accountHint: string | null;
  /** Epoch ms if the text contained a date, otherwise null (caller falls back to posted time). */
  occurredAt: number | null;
  /** 0..1. Rule output below CONFIDENCE_FLOOR is treated as unparsed. */
  confidence: number;
  /** UPI ref / RRN / UTR / txn id. The same payment reported by two apps shares it. */
  reference?: string | null;
  categoryGuess?: string | null;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  isDefault: boolean;
};

export type Transaction = {
  id: number;
  rawCaptureId: number | null;
  amountPaise: number;
  direction: Direction;
  merchantRaw: string | null;
  merchantId: number | null;
  merchantName: string | null;
  categoryId: string;
  accountHint: string | null;
  occurredAt: number;
  status: TransactionStatus;
  parsedBy: ParsedBy;
  possibleDuplicateOf: number | null;
  note: string | null;
  reference: string | null;
  /** How many alerts (bank SMS, bank app, UPI app...) reported this same payment. */
  sourceCount: number;
};
