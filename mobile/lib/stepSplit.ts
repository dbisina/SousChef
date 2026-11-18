// Turns a pasted or dictated method into separate steps.

const clean = (s: string): string =>
  s
    .replace(/^[\s\-–—•*·▪●◦]+/, '')
    .replace(/^(?:step\s*)?\d+\s*[.):\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Splits on numbering ("1.", "2)", "Step 3:"), else on blank lines, else on lines, else on sentences. */
export function splitSteps(text: string): string[] {
  const t = text.replace(/\r/g, '').trim();
  if (!t) return [];

  const numbered = /(?:^|\n)\s*(?:step\s*)?\d+\s*[.):\-]\s+\S/i;
  if (numbered.test(t)) {
    const parts = t.split(/\n(?=\s*(?:step\s*)?\d+\s*[.):\-]\s+\S)/i);
    const steps = parts.map(clean).filter(Boolean);
    if (steps.length > 1) return steps;
  }

  const paragraphs = t.split(/\n\s*\n/).map(clean).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  const lines = t.split(/\n/).map(clean).filter(Boolean);
  if (lines.length > 1) return lines;

  // One block of text, as dictation gives it: one step per sentence, keeping short bits ("Stir.") with the one before.
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(clean).filter(Boolean);
  const steps: string[] = [];
  for (const s of sentences) {
    const last = steps.length - 1;
    if (last >= 0 && s.length < 14) steps[last] = `${steps[last]} ${s}`;
    else steps.push(s);
  }
  return steps;
}
