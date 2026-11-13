import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import {
  Chip,
  CtaBar,
  Field,
  FONT,
  H2,
  Icon,
  Muted,
  PhotoCard,
  Screen,
  SectionLabel,
  UButton,
  UIconButton,
  Display,
} from '@/components/ui';
import { submitAdInquiry } from '@/services/adService';
import { showErrorToast, showInfoToast } from '@/stores/toastStore';
import {
  AdPlacement,
  AdBudgetRange,
  AD_BUDGET_LABELS,
  AD_PLACEMENT_LABELS,
} from '@/types/ads';

export default function AdvertiseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState<AdBudgetRange | null>(null);
  const [placements, setPlacements] = useState<Set<AdPlacement>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const togglePlacement = (p: AdPlacement) => {
    const newSet = new Set(placements);
    if (newSet.has(p)) {
      newSet.delete(p);
    } else {
      newSet.add(p);
    }
    setPlacements(newSet);
  };

  const missing = (body: string) => {
    showInfoToast(body, t('account.advertise.missingInfo', 'Missing Info'));
    return false;
  };

  const validate = (): boolean => {
    if (!name.trim()) return missing(t('account.advertise.needName', 'Please enter your name so we know who to talk to!'));
    if (!email.trim() || !email.includes('@')) return missing(t('account.advertise.needEmail', 'Double-check your email address? We want to make sure we can reach you.'));
    if (!company.trim()) return missing(t('account.advertise.needCompany', "Don't forget to tell us your company name!"));
    if (!budget) return missing(t('account.advertise.needBudget', 'Please select a budget range that works for you.'));
    if (placements.size === 0) return missing(t('account.advertise.needPlacement', 'Where would you like your ads to appear?'));
    return true;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await submitAdInquiry({
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        website: website.trim() || undefined,
        budget: budget!,
        placements: Array.from(placements),
        message: message.trim(),
      });
      setSubmitted(true);
    } catch (error: unknown) {
      showErrorToast(
        t('account.advertise.sendFailed', "Oops! We couldn't send your inquiry. Let's try once more?"),
        t('account.advertise.inquiryProblem', 'Inquiry Problem')
      );
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, company, website, budget, placements, message]);

  // ── Success State ──
  if (submitted) {
    return (
      <Screen
        bare
        footer={
          <CtaBar>
            <UButton label={t('account.advertise.backToSettings', 'Back to Settings')} onPress={() => router.back()} />
          </CtaBar>
        }
      >
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 16 }}>
          <View className="items-center justify-center bg-tag-g" style={{ width: 80, height: 80, borderRadius: 40 }}>
            <Icon name="check" size="lg" color="tag-g-fg" />
          </View>
          <Display size={28} center>
            {t('account.advertise.sent', 'Inquiry Sent!')}
          </Display>
          <Muted center>
            {t(
              'account.advertise.sentBody',
              "Thanks for your interest in advertising on SousChef. We'll review your inquiry and get back to you within 48 hours."
            )}
          </Muted>
        </View>
      </Screen>
    );
  }

  const stat = (value: string, label: string) => (
    <Text className="text-paper" style={{ fontFamily: FONT.sans, fontSize: 12, opacity: 0.85 }}>
      <Text style={{ fontFamily: FONT.sansMedium }}>{value}</Text> {label}
    </Text>
  );

  return (
    <Screen
      bare
      footer={
        <CtaBar fade vertical>
          <UButton
            variant="accent"
            label={submitting ? t('account.advertise.sending', 'Sending...') : t('account.advertise.send', 'Send Inquiry')}
            loading={submitting}
            onPress={handleSubmit}
          />
          <Muted small center>
            {t('account.advertise.reply', 'We reply within 48 hours.')}
          </Muted>
        </CtaBar>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 190 }}>
          <PhotoCard
            source={SAMPLE.veg}
            height={260}
            radius={0}
            fade="both"
            style={{ borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
          >
            <View style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, zIndex: 2 }}>
              <UIconButton icon="back" tone="glassDark" label={t('account.back', 'Back')} onPress={() => router.back()} />
            </View>
            <View style={{ position: 'absolute', left: 22, right: 22, bottom: 22, gap: 6, zIndex: 2 }}>
              <Text className="text-paper" style={{ fontFamily: FONT.display, fontSize: 26, letterSpacing: -0.52 }}>
                {t('account.advertise.hero', 'Reach home cooks')}
              </Text>
              <View className="flex-row flex-wrap" style={{ columnGap: 16, rowGap: 2 }}>
                {stat('10K+', t('account.advertise.statCooks', 'cooks'))}
                {stat('50K+', t('account.advertise.statRecipes', 'recipes/week'))}
                {stat('8 min', t('account.advertise.statSessions', 'sessions'))}
              </View>
            </View>
          </PhotoCard>

          <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 12 }}>
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1">
                <Field label={t('account.advertise.name', 'Your name *')} value={name} onChangeText={setName} placeholder="Jane Smith" autoCapitalize="words" />
              </View>
              <View className="flex-1">
                <Field label={t('account.advertise.email', 'Email *')} value={email} onChangeText={setEmail} placeholder="jane@brand.com" keyboardType="email-address" autoCapitalize="none" />
              </View>
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1">
                <Field label={t('account.advertise.company', 'Company *')} value={company} onChangeText={setCompany} placeholder="FreshCart Inc." autoCapitalize="words" />
              </View>
              <View className="flex-1">
                <Field label={t('account.advertise.website', 'Website')} value={website} onChangeText={setWebsite} placeholder="https://" keyboardType="url" autoCapitalize="none" />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <SectionLabel>{t('account.advertise.budget', 'Monthly budget *')}</SectionLabel>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {(Object.entries(AD_BUDGET_LABELS) as [AdBudgetRange, string][]).map(([key, label]) => (
                  <Chip key={key} label={label} on={budget === key} onPress={() => setBudget(key)} />
                ))}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Muted small style={{ paddingStart: 4 }}>
                {t('account.advertise.placements', 'Placements *')}
              </Muted>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {(Object.entries(AD_PLACEMENT_LABELS) as [AdPlacement, string][]).map(([key, label]) => (
                  <Chip key={key} label={label} on={placements.has(key)} onPress={() => togglePlacement(key)} />
                ))}
              </View>
            </View>

            <Field
              label={t('account.advertise.campaign', 'Your campaign')}
              value={message}
              onChangeText={setMessage}
              placeholder={t('account.advertise.campaignPlaceholder', 'What do you want to promote?')}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
