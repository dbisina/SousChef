// What someone says while cooking, turned into an action. Anything that is not a command is a question for the assistant.

export type CookCommand =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'repeat' }
  | { type: 'timer'; minutes: number; label: string }
  | { type: 'servings'; servings: number }
  | { type: 'stop' }
  | { type: 'ask'; question: string };

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, sixty: 60, ninety: 90,
};

const toNumber = (raw: string): number | null => {
  const t = raw.toLowerCase().replace(/[-\s]/g, '');
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'half' || t === 'ahalf') return 0.5;
  return WORDS[t] ?? null;
};

/** Takes the wake word ("enplace", "en place", the old "enplace") and filler off the front. */
const clean = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\b(hey|ok|okay)?\s*(sous|sue|sew)\s*(chef|chief|shef)\b[,.!?]?/g, ' ')
    .replace(/\b(hey|ok|okay)\s*(in|and)\s*place\b[,.!?]?/g, ' ')
    .replace(/\b(hey|ok|okay)?\s*(en|on)\s*(place|plays|plaice)\b[,.!?]?/g, ' ')
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (t: string, re: RegExp) => re.test(t);

export function parseCookCommand(spoken: string): CookCommand | null {
  const t = clean(spoken);
  if (!t) return null;

  const timer = /\b(?:set |start |put on )?(?:a |the )?(?:timer|alarm)(?: for| of)? (\d+(?:\.\d+)?|[a-z-]+)(?: and a (half))? ?(second|sec|minute|min|hour|hr)s?\b/.exec(t) ?? /\b(?:set |start )?(\d+(?:\.\d+)?|[a-z-]+) ?(second|sec|minute|min|hour|hr)s? (?:timer|alarm)\b/.exec(t);
  if (timer) {
    const isFirst = timer.length === 4;
    const amountRaw = timer[1] ?? '';
    const unit = (isFirst ? timer[3] : timer[2]) ?? 'minute';
    const amount = toNumber(amountRaw);
    if (amount !== null && amount > 0) {
      const base = unit.startsWith('hour') || unit === 'hr' ? amount * 60 : unit.startsWith('sec') ? amount / 60 : amount;
      const minutes = Math.round((base + (isFirst && timer[2] === 'half' ? 0.5 : 0)) * 100) / 100;
      return { type: 'timer', minutes, label: 'Timer' };
    }
  }

  const servings = /\b(?:make it|change|adjust|scale)(?: it| this| the recipe)?(?: to| for)? (\d+|[a-z-]+) (?:servings?|people|portions?)\b/.exec(t) ?? /\bfor (\d+|[a-z-]+) (?:people|servings?|portions?)\b/.exec(t);
  if (servings) {
    const n = toNumber(servings[1] ?? '');
    if (n !== null && n >= 1 && n <= 50) return { type: 'servings', servings: Math.round(n) };
  }

  if (has(t, /^(next|next step|go next|continue|go on|done|i m done|im done|what s next|whats next|then what)$/)) return { type: 'next' };
  if (has(t, /^(back|go back|previous|previous step|last step|step back)$/)) return { type: 'previous' };
  if (has(t, /^(repeat|repeat that|say that again|again|read (it|that|the step) (again|back)|what was that)$/)) return { type: 'repeat' };
  if (has(t, /^(stop|quiet|be quiet|cancel|shut up|enough|that s all|thats all)$/)) return { type: 'stop' };

  return { type: 'ask', question: spoken.replace(/\s+/g, ' ').trim() };
}
