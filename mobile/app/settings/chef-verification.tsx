import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { ChefVerificationView } from '@shared/index';
import { Body, CtaBar, Display, Field, Icon, Muted, Screen, UButton, UIconButton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { apiChefVerification, apiRequestChefVerification } from '@/services/chefApi';
import { showErrorToast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';

const MIN_NOTE = 10;
const isWebAddress = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v);

export default function ChefVerificationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isGuest = useAuthStore((s) => s.isGuest);
  const [view, setView] = useState<ChefVerificationView | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    apiChefVerification().then(setView, () => setFailed(true));
  }, []);
  useEffect(() => {
    if (!isGuest) load();
  }, [isGuest, load]);

  const submit = async () => {
    const trimmed = note.trim();
    const url = link.trim();
    if (trimmed.length < MIN_NOTE) {
      showErrorToast(t('account.chef.needNote', 'Tell us a little about your cooking (at least 10 characters).'), t('account.chef.missing', 'Missing info'));
      return;
    }
    if (url && !isWebAddress(url)) {
      showErrorToast(t('account.chef.badLink', 'The link should start with http:// or https://'), t('account.chef.missing', 'Missing info'));
      return;
    }
    setSending(true);
    try {
      setView(await apiRequestChefVerification({ note: trimmed, ...(url ? { portfolioUrl: url } : {}) }));
    } catch (err) {
      // A second request while the first is waiting is the one expected refusal: show where it stands.
      if (err instanceof ApiError && err.status === 409) load();
      else showErrorToast(t('account.chef.sendFailed', "We couldn't send your request. Try again?"), t('account.chef.problem', 'Request problem'));
    } finally {
      setSending(false);
    }
  };

  const back = <UIconButton icon="back" label={t('account.back', 'Back')} onPress={() => router.back()} />;
  const header = (
    <View style={{ paddingTop: Math.max(insets.top, 20) + 8, paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
      <View className="flex-row">{back}</View>
      <Display size={28}>{t('account.chef.title', 'Verified chef')}</Display>
    </View>
  );

  const message = (icon: 'check' | 'clock', title: string, body: string) => (
    <View className="items-center" style={{ paddingHorizontal: 32, paddingTop: 40, gap: 14 }}>
      <View className="items-center justify-center bg-tag-g" style={{ width: 80, height: 80, borderRadius: 40 }}>
        <Icon name={icon} size="lg" color="tag-g-fg" />
      </View>
      <Display size={24} center>
        {title}
      </Display>
      <Muted center>{body}</Muted>
    </View>
  );

  if (isGuest) {
    return (
      <Screen bare>
        {header}
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Body>{t('account.chef.guest', 'Create an account to ask for the verified chef badge.')}</Body>
          <UButton label={t('account.chef.signUp', 'Sign up')} onPress={() => router.push('/auth/login')} />
        </View>
      </Screen>
    );
  }

  if (!view) {
    return (
      <Screen bare>
        {header}
        <View className="items-center" style={{ paddingTop: 40, gap: 14 }}>
          {failed ? (
            <>
              <Muted center>{t('account.chef.loadFailed', "We couldn't load your request.")}</Muted>
              <UButton size="sm" variant="ghost" label={t('account.chef.retry', 'Try again')} onPress={load} />
            </>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      </Screen>
    );
  }

  if (view.status === 'approved') {
    return (
      <Screen bare>
        {header}
        {message('check', t('account.chef.approved', "You're a verified chef"), t('account.chef.approvedBody', 'The badge shows next to your name on your recipes and posts.'))}
      </Screen>
    );
  }

  if (view.status === 'pending') {
    return (
      <Screen bare>
        {header}
        {message('clock', t('account.chef.pending', 'Your request is with us'), t('account.chef.pendingBody', "We'll look at your cooking and let you know. You don't need to do anything else."))}
      </Screen>
    );
  }

  const note0 =
    view.status === 'rejected'
      ? view.rejectionReason
        ? t('account.chef.rejected', 'Not approved this time: {{reason}}. You can send a new request.', { reason: view.rejectionReason })
        : t('account.chef.rejectedNoReason', 'Not approved this time. You can send a new request.')
      : view.status === 'revoked'
        ? t('account.chef.revoked', 'Your badge was removed. You can send a new request.')
        : t('account.chef.intro', 'The badge tells people you cook for real. Tell us about your cooking and share a link where we can see it.');

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton variant="accent" label={sending ? t('account.chef.sending', 'Sending...') : t('account.chef.send', 'Send request')} loading={sending} onPress={submit} />
        </CtaBar>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 160 }}>
          {header}
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            <Muted>{note0}</Muted>
            <Field
              label={t('account.chef.noteLabel', 'About your cooking *')}
              value={note}
              onChangeText={setNote}
              placeholder={t('account.chef.notePlaceholder', 'Where you cook, what you make, how long you have been doing it')}
              multiline
            />
            <Field
              label={t('account.chef.linkLabel', 'Link to your cooking')}
              value={link}
              onChangeText={setLink}
              placeholder="https://"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
