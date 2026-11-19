import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_REASONS, type ReportReason, type ReportTarget } from '@shared/index';
import { Field, H2, Muted, Sheet, UButton } from '@/components/ui';
import { guestBlocked } from '@/lib/guestPrompt';
import { apiSetBlocked } from '@/services/chatApi';
import { apiReport } from '@/services/socialApi';
import { showErrorToast, showSuccessToast } from '@/stores/toastStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** What is being reported. */
  targetType: ReportTarget;
  targetId: string;
  /** The person who made it. With this, the sheet also offers to block them. */
  personId?: string;
  personName?: string;
  /** Called after the person is blocked (a profile or chat closes itself). */
  onBlocked?: () => void;
}

type Step = 'menu' | 'reason';

/**
 * Report something, or block the person who made it. Stores require both on anything people post.
 * Reports go to staff; blocking hides the person's posts, comments and messages from you at once.
 */
export function SafetySheet({ visible, onClose, targetType, targetId, personId, personName, onBlocked }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('menu');
      setReason(null);
      setDetails('');
    }
  }, [visible]);

  const labels: Record<ReportReason, string> = {
    spam: t('safety.reason.spam', 'Spam or a scam'),
    abuse: t('safety.reason.abuse', 'Harassment or hate'),
    inappropriate: t('safety.reason.inappropriate', 'Nudity, violence or other unsuitable content'),
    misinformation: t('safety.reason.misinformation', 'False or dangerous information'),
    other: t('safety.reason.other', 'Something else'),
  };

  const startReport = () => {
    if (guestBlocked()) return;
    setStep('reason');
  };

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await apiReport({ targetType, targetId, reason, ...(details.trim() ? { details: details.trim() } : {}) });
      showSuccessToast(t('safety.reported', 'Thanks. We will take a look.'));
      onClose();
    } catch {
      showErrorToast(t('safety.reportFailed', "We couldn't send your report. Try again?"), t('safety.problem', 'Report problem'));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!personId || guestBlocked()) return;
    setBusy(true);
    try {
      await apiSetBlocked(personId, true);
      showSuccessToast(t('safety.blocked', 'Blocked. You will not see each other any more.'));
      onClose();
      onBlocked?.();
    } catch {
      showErrorToast(t('safety.blockFailed', "We couldn't block them. Try again?"), t('safety.problem', 'Report problem'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('safety.title', 'Report or block')}>
      {step === 'menu' ? (
        <>
          <H2>{t('safety.title', 'Report or block')}</H2>
          <UButton variant="ghost" label={t('safety.report', 'Report this')} onPress={startReport} />
          {personId ? (
            <UButton
              variant="ghost"
              label={personName ? t('safety.blockNamed', 'Block {{name}}', { name: personName }) : t('safety.block', 'Block this person')}
              loading={busy}
              onPress={() => void block()}
            />
          ) : null}
          <Muted small>{t('safety.note', 'Reports go to our team, who remove anything that breaks the rules, usually within a day.')}</Muted>
        </>
      ) : (
        <>
          <H2>{t('safety.why', 'What is wrong with it?')}</H2>
          {REPORT_REASONS.map((r) => (
            <UButton key={r} variant={reason === r ? 'accent' : 'ghost'} label={labels[r]} onPress={() => setReason(r)} />
          ))}
          <Field
            label={t('safety.details', 'More detail (optional)')}
            placeholder={t('safety.details', 'More detail (optional)')}
            value={details}
            onChangeText={setDetails}
            multiline
          />
          <UButton variant="accent" label={t('safety.send', 'Send report')} disabled={!reason || busy} loading={busy} onPress={() => void send()} />
        </>
      )}
    </Sheet>
  );
}
