import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/ui/Pressable';
import { FONT, Muted } from '@/components/ui';
import { apiEnabled } from '@/lib/api';
import { aiErrorText } from '@/lib/aiError';
import { apiChatAssist } from '@/services/aiToolsApi';
import { AiChip } from './AiBits';

/** Above the message box: three reply ideas, or a short summary of a long chat. Runs only when tapped. */
export function ChatAssistBar({ conversationId, onPickReply }: { conversationId: string; onPickReply: (text: string) => void }) {
  const { t } = useTranslation();
  const [replies, setReplies] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!apiEnabled()) return null;

  const run = async (mode: 'replies' | 'summary') => {
    setBusy(true);
    setError('');
    try {
      const res = await apiChatAssist({ conversationId, mode });
      if (mode === 'replies') {
        setReplies(res.replies ?? []);
        setSummary('');
      } else {
        setSummary(res.summary ?? '');
        setReplies([]);
      }
    } catch (err) {
      setError(aiErrorText(err, t('ai.assistFailed', 'Could not help with this chat just now.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, gap: 6 }}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <AiChip label={busy ? t('ai.thinking', 'Thinking...') : t('ai.replyIdeas', 'Reply ideas')} onPress={() => void run('replies')} />
        <AiChip label={t('ai.summarise', 'Summarise')} onPress={() => void run('summary')} />
      </View>
      {replies.length > 0 ? (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {replies.map((r) => <AiChip key={r} label={r} onPress={() => { onPickReply(r); setReplies([]); }} />)}
        </View>
      ) : null}
      {summary ? (
        <Pressable onPress={() => setSummary('')} accessibilityRole="button" accessibilityLabel={t('ai.dismiss', 'Dismiss summary')} className="bg-surface-2" style={{ borderRadius: 16, padding: 12 }}>
          <Text className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>{summary}</Text>
        </Pressable>
      ) : null}
      {error ? <Muted small accessibilityRole="alert">{error}</Muted> : null}
    </View>
  );
}
