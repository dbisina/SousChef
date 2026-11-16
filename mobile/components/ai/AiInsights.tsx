import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HealthSummaryResponse, WasteCoachResponse } from '@shared/index';
import { FONT, Muted, UButton } from '@/components/ui';
import { apiEnabled } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';
import { apiHealthSummary, apiWasteCoach } from '@/services/aiToolsApi';
import { AiCard, AiNote } from './AiBits';

/** Waste screen: three plain sentences about the last 30 days. The numbers are worked out by the server, the AI only words them. */
export function WasteCoachCard() {
  const { t } = useTranslation();
  const [out, setOut] = useState<WasteCoachResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!apiEnabled()) return null;

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      setOut(await apiWasteCoach());
    } catch (err) {
      setError(aiErrorText(err, t('ai.wasteFailed', 'Could not review your waste just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiCard title={t('ai.wasteTitle', 'Your fridge, honestly reviewed')} busy={busy} error={error}>
      {!out ? <UButton size="sm" label={t('ai.wasteGo', 'Review the last 30 days')} onPress={load} disabled={busy} /> : (
        <View style={{ gap: 6 }}>
          {out.insights.map((line, i) => <Text key={`w-${i}`} className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 15, lineHeight: 21 }}>• {line}</Text>)}
          {out.tip ? <Muted>{t('ai.tip', 'Tip')}: {out.tip}</Muted> : null}
          <AiNote>{t('ai.wasteNote', '{{n}} thrown-away items logged, worth {{v}} in all.', { n: out.facts.entries, v: out.facts.totalValue })}</AiNote>
        </View>
      )}
    </AiCard>
  );
}

/** Health home: the last 30 days in plain words. Numbers only; it never gives advice and says so. */
export function HealthSummaryCard() {
  const { t } = useTranslation();
  const [out, setOut] = useState<HealthSummaryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!apiEnabled()) return null;

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      setOut(await apiHealthSummary());
    } catch (err) {
      setError(aiErrorText(err, t('ai.healthFailed', 'Could not write your summary just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiCard title={t('ai.healthTitle', 'Your numbers in plain words')} busy={busy} error={error}>
      {!out ? <UButton size="sm" label={t('ai.healthGo', 'Summarise the last 30 days')} onPress={load} disabled={busy} /> : (
        <View style={{ gap: 6 }}>
          <Text className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 15, lineHeight: 22 }}>{out.summary}</Text>
          {out.facts.steadiest[0] ? <Muted small>{t('ai.steadiest', 'Steadiest after: {{title}}', { title: out.facts.steadiest[0].title })}</Muted> : null}
        </View>
      )}
      <AiNote>{t('ai.healthNote', 'This only describes your numbers. It is not medical advice. Talk to your doctor about your care.')}</AiNote>
    </AiCard>
  );
}
