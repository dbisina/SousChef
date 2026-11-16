import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Divider,
  FONT,
  H1,
  Icon,
  ListRow,
  Muted,
  Rows,
  Screen,
  Segmented,
  Title,
  TopBar,
} from '@/components/ui';

const SUPPORT_EMAIL = 'danbis664@gmail.com';

interface LegalLayoutProps {
  active: 'terms' | 'privacy';
  updated: string;
  children: React.ReactNode;
}

/** Legal (Terms + Privacy as one design with a two-tab switch). Both routes keep working. */
export const LegalLayout: React.FC<LegalLayoutProps> = ({ active, updated, children }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const heading =
    active === 'terms'
      ? t('account.legal.terms', 'Terms of Service')
      : t('account.legal.privacy', 'Privacy Policy');

  return (
    <Screen bare>
      <TopBar variant="compact" title={t('account.legal.title', 'Legal')} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
        <Segmented<'terms' | 'privacy'>
          value={active}
          onChange={(v) => {
            if (v !== active) router.replace(v === 'terms' ? '/settings/terms' : '/settings/privacy');
          }}
          options={[
            { value: 'terms', label: t('account.legal.terms', 'Terms of Service') },
            { value: 'privacy', label: t('account.legal.privacy', 'Privacy Policy') },
          ]}
        />
        <H1 style={{ fontSize: 28, lineHeight: 31 }}>{heading}</H1>
        <Muted small>{t('account.legal.updated', 'Last updated: {{date}}', { date: updated })}</Muted>

        {children}

        <Divider />
        <Rows>
          <ListRow
            title={t('account.legal.questions', 'Questions?')}
            subtitle={SUPPORT_EMAIL}
            right={<Icon name="mail" color="subtle" />}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
        </Rows>
      </ScrollView>
    </Screen>
  );
};

export const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const parts = React.Children.toArray(children);
  const plain = parts.length > 0 && parts.every((c) => typeof c === 'string' || typeof c === 'number');
  return (
    <View style={{ gap: 6 }}>
      <Title>{title}</Title>
      {plain ? <Muted>{parts.join('')}</Muted> : children}
    </View>
  );
};

export const LegalBullets: React.FC<{ items: string[] }> = ({ items }) => (
  <View style={{ gap: 4 }}>
    {items.map((item, index) => (
      <View key={index} className="flex-row" style={{ gap: 8 }}>
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
          {'•'}
        </Text>
        <Muted className="flex-1">{item}</Muted>
      </View>
    ))}
  </View>
);
