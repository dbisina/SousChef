import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  CtaBar,
  Dim,
  FONT,
  H1,
  Icon,
  ListRow,
  Muted,
  Rows,
  Screen,
  TopBar,
  UButton,
  UInput,
  UIconButton,
} from '@/components/ui';

const FAQ_ITEMS = [
  {
    q: 'How do I add a recipe?',
    a: 'Tap the "Add Recipe" button on the home screen or go to Profile > Create Recipe. Fill in the details, add a photo, and submit!',
  },
  {
    q: 'How do I scan food for calories?',
    a: 'Use the Scan tab (center button) to take a photo of any food. Our AI will analyze it and provide calorie estimates.',
  },
  {
    q: 'How do voice commands work?',
    a: 'In cooking mode, tap the microphone icon or enable hands-free mode. Say "SousChef" followed by commands like "next step" or "read ingredients".',
  },
  {
    q: "What's included in Premium?",
    a: 'Premium includes unlimited recipes, 20 AI features per day, voice control, meal planning, and ad-free experience.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Profile > Subscription > Manage Subscription. You can cancel anytime through your App Store or Play Store account.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Refunds are handled by Apple/Google. Contact their support or visit your subscription settings to request a refund.',
  },
  {
    q: 'How do I reset my password?',
    a: 'On the login screen, tap "Forgot Password" and enter your email. We\'ll send you a reset link.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Profile > Edit profile > Delete Account. Note that this action is irreversible and all your data will be permanently deleted.',
  },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleQuestion = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = FAQ_ITEMS.map((item, id) => ({ ...item, id })).filter(
    (item) => !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
  );

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@souschef.app?subject=SousChef Support Request');
  };

  const handleVisitWebsite = () => {
    Linking.openURL('https://souschef.app/help');
  };

  return (
    <Screen
      bare
      footer={
        <CtaBar fade>
          <UButton icon="mail" label={t('account.help.contact', 'Contact Support')} onPress={handleContactSupport} />
        </CtaBar>
      }
    >
      <TopBar variant="compact" title={t('account.help.title', 'Help Center')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, gap: 14 }}
      >
        <H1>
          <Dim>{t('account.help.line1', 'How can')}</Dim>
          {'\n'}
          {t('account.help.line2', 'we help?')}
        </H1>

        <UInput
          icon="search"
          label={t('account.help.searchLabel', 'Search help')}
          placeholder={t('account.help.searchPlaceholder', 'Search help articles...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          right={
            searchQuery.length > 0 ? (
              <UIconButton icon="close" size={44} label={t('account.help.clear', 'Clear search')} onPress={() => setSearchQuery('')} />
            ) : undefined
          }
        />

        {filtered.length > 0 ? (
          <Rows>
            {filtered.map((item) => {
              const open = expanded.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => toggleQuestion(item.id)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ minHeight: 64, justifyContent: 'center', paddingVertical: 10, gap: 8 }}>
                    <View className="flex-row items-center" style={{ gap: 14 }}>
                      <Text className="flex-1 text-ink" style={{ fontFamily: FONT.display, fontSize: 15, lineHeight: 20 }}>
                        {item.q}
                      </Text>
                      <Icon name={open ? 'close' : 'chevronDown'} color="subtle" />
                    </View>
                    {open ? <Muted>{item.a}</Muted> : null}
                  </View>
                </Pressable>
              );
            })}
          </Rows>
        ) : (
          <View className="items-center" style={{ paddingVertical: 24, gap: 4 }}>
            <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
              {t('account.help.noResults', 'No results found')}
            </Text>
            <Muted small>{t('account.help.tryDifferent', 'Try a different search term')}</Muted>
          </View>
        )}

        <Rows>
          <ListRow
            icon="globe"
            title={t('account.help.website', 'Website')}
            subtitle={t('account.help.websiteBody', 'More resources')}
            onPress={handleVisitWebsite}
          />
        </Rows>
      </ScrollView>
    </Screen>
  );
}
