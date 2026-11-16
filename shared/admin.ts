// What the staff dashboard (admin/) reads. All read-only numbers; nothing here contains a secret.

export interface AdminStats {
  people: number;
  newPeopleLast7Days: number;
  suspendedPeople: number;
  postsLast7Days: number;
  openReports: number;
  pendingChefVerifications: number;
}

export interface AiUsageRow {
  /** A provider name (`gemini`, `gemini-free`, `deepseek`, `nebius`) or a task name, depending on the table. */
  name: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated US dollars (from token counts and the configured prices). */
  costUsd: number;
}

export interface AiUsageReport {
  days: number;
  since: string;
  /** The hard monthly stop, and what this calendar month has cost so far. */
  budgetUsd: number;
  spentThisMonthUsd: number;
  byProvider: AiUsageRow[];
  byTask: AiUsageRow[];
  /** One row per UTC day that had any calls, oldest first. */
  byDay: { date: string; calls: number; costUsd: number }[];
}

/** One AI service as the router sees it. For the Gemini pool, `details` lists the free keys by their last four characters. */
export interface AiProviderStatus {
  name: string;
  model: string;
  details?: { funded: boolean; freeKeys: { key: string; resting: boolean }[] };
}

export interface AiKeysReport {
  providers: AiProviderStatus[];
  /** Providers that may see private requests (health numbers, private chats, receipts). */
  privateProviders: string[];
}
