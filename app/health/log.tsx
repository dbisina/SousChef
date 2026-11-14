import React, { useMemo, useState } from 'react';
import { Pressable, Text as RNText, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Chip,
  CtaBar,
  FONT,
  Icon,
  Muted,
  Screen,
  SectionLabel,
  Segmented,
  Tag,
  Thumb,
  Title,
  TopBar,
  UButton,
  UCard,
  useTokens,
} from '@/components/ui';
import { TIMING_OPTIONS, healthMealPhoto, timeText } from '@/components/health/format';
import { AFTER_MEAL_TARGET, FASTING_RANGE, glucoseStatus, isAfterMeal } from '@/lib/health';
import { mealsOn, useHealthStore } from '@/stores/healthStore';
import type { GlucoseTiming } from '@/types/health';

type Kind = 'glucose' | 'bp' | 'cholesterol';

const num = (s: string): number => Number(s.replace(',', '.'));

export default function LogReadingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const tokens = useTokens();
  const meals = useHealthStore((s) => s.meals);
  const logReading = useHealthStore((s) => s.logReading);

  const [kind, setKind] = useState<Kind>('glucose');
  const [glucose, setGlucose] = useState('');
  const [timing, setTiming] = useState<GlucoseTiming>('2h-after');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [ldl, setLdl] = useState('');
  const [unlinked, setUnlinked] = useState(false);

  const todayMeal = useMemo(() => {
    const now = Date.now();
    return mealsOn(meals, new Date())
      .filter((m) => new Date(m.at).getTime() <= now)
      .pop();
  }, [meals]);
  const canLink = timing === 'before-meal' || isAfterMeal(timing);
  const linked = canLink && !unlinked ? todayMeal : undefined;

  const mmol = num(glucose);
  const sys = Math.round(num(systolic));
  const dia = Math.round(num(diastolic));
  const ldlVal = num(ldl);
  const valid =
    kind === 'glucose'
      ? glucose !== '' && mmol >= 1 && mmol <= 40
      : kind === 'bp'
        ? systolic !== '' && diastolic !== '' && sys >= 60 && sys <= 260 && dia >= 30 && dia <= 160 && sys > dia
        : ldl !== '' && ldlVal >= 0.5 && ldlVal <= 15;

  const status = kind === 'glucose' && valid ? glucoseStatus(mmol, timing) : undefined;
  const statusLabel =
    status === 'in-range'
      ? t('health.log.inRange', 'In range')
      : status === 'high'
        ? isAfterMeal(timing)
          ? t('health.log.aboveAfter', 'Above your after-meal target (under {{n}})', { n: AFTER_MEAL_TARGET })
          : t('health.log.aboveRange', 'Above the range {{a}} to {{b}}', { a: FASTING_RANGE[0].toFixed(1), b: FASTING_RANGE[1].toFixed(1) })
        : status === 'low'
          ? t('health.log.belowRange', 'Below the range {{a}} to {{b}}', { a: FASTING_RANGE[0].toFixed(1), b: FASTING_RANGE[1].toFixed(1) })
          : undefined;

  const save = () => {
    if (!valid) return;
    if (kind === 'glucose') {
      logReading({ kind: 'glucose', mmol: Math.round(mmol * 10) / 10, timing, mealId: linked?.id });
      if (linked) {
        router.replace(`/health/meal/${linked.id}` as Href);
        return;
      }
    } else if (kind === 'bp') {
      logReading({ kind: 'bp', systolic: sys, diastolic: dia });
    } else {
      logReading({ kind: 'cholesterol', ldl: Math.round(ldlVal * 10) / 10 });
    }
    router.back();
  };

  const bigInput = (value: string, set: (v: string) => void, label: string, size: number, width?: number) => (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={(v) => set(v.replace(/[^0-9.,]/g, '').slice(0, 5))}
      keyboardType="decimal-pad"
      placeholder="0"
      placeholderTextColor={tokens.subtle}
      selectionColor={tokens.accent}
      maxLength={5}
      className="text-ink"
      style={{
        fontFamily: FONT.display,
        fontSize: size,
        lineHeight: size * 1.1,
        letterSpacing: -size * 0.04,
        textAlign: 'center',
        minWidth: width ?? 120,
        padding: 0,
      }}
    />
  );

  return (
    <Screen
      scroll
      bottomSpace={130}
      footer={
        <CtaBar>
          <UButton label={t('health.log.save', 'Save reading')} disabled={!valid} onPress={save} />
        </CtaBar>
      }
    >
      <TopBar
        variant="compact"
        title={t('health.log.title', 'Log a reading')}
        left={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('health.log.close', 'Close')}
            onPress={() => router.back()}
            className="items-center justify-center bg-surface-2"
            style={{ width: 46, height: 46, borderRadius: 23 }}
          >
            <Icon name="close" />
          </Pressable>
        }
      />

      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'glucose', label: t('health.log.glucose', 'Glucose') },
          { value: 'bp', label: t('health.log.bp', 'Blood pressure') },
          { value: 'cholesterol', label: t('health.log.cholesterol', 'Cholesterol') },
        ]}
      />

      {kind === 'glucose' ? (
        <>
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: 16 }}>
            {bigInput(glucose, setGlucose, t('health.log.glucoseValue', 'Glucose in mmol/L'), 76)}
            <Muted>mmol/L</Muted>
            {statusLabel ? (
              <View style={{ marginTop: 8 }}>
                <Tag tone={status === 'in-range' ? 'g' : status === 'high' ? 'o' : 'r'} label={statusLabel} />
              </View>
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            <SectionLabel>{t('health.log.when', 'When')}</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {TIMING_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={t(`health.timing.${o.value}`, o.label)}
                  on={timing === o.value}
                  onPress={() => setTiming(o.value)}
                />
              ))}
            </View>
          </View>

          {canLink && todayMeal ? (
            linked ? (
              <UCard
                style={{ borderRadius: 24, padding: 12 }}
                onPress={() => router.push(`/health/meal/${linked.id}` as Href)}
                accessibilityLabel={t('health.log.linkedMeal', 'Linked meal')}
              >
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <Thumb source={healthMealPhoto(linked)} name={linked.title} size={56} />
                  <View className="flex-1" style={{ minWidth: 0 }}>
                    <Muted small>{t('health.log.linkedMeal', 'Linked meal')}</Muted>
                    <Title numberOfLines={1}>{`${linked.title} · ${timeText(linked.at)}`}</Title>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('health.log.unlink', 'Unlink meal')}
                    onPress={() => setUnlinked(true)}
                    hitSlop={8}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <RNText className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                      {t('health.log.unlinkShort', 'Unlink')}
                    </RNText>
                  </Pressable>
                </View>
              </UCard>
            ) : (
              <UButton
                variant="ghost"
                icon="link"
                label={t('health.log.linkLatest', 'Link {{meal}}', { meal: todayMeal.title })}
                onPress={() => setUnlinked(false)}
              />
            )
          ) : null}
        </>
      ) : kind === 'bp' ? (
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 16 }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {bigInput(systolic, setSystolic, t('health.log.systolic', 'Systolic'), 64, 100)}
            <RNText className="text-subtle" style={{ fontFamily: FONT.display, fontSize: 52 }}>
              /
            </RNText>
            {bigInput(diastolic, setDiastolic, t('health.log.diastolic', 'Diastolic'), 64, 100)}
          </View>
          <Muted>mmHg</Muted>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 16 }}>
          {bigInput(ldl, setLdl, t('health.log.ldlValue', 'LDL cholesterol in mmol/L'), 76)}
          <Muted>{t('health.log.ldlUnit', 'LDL · mmol/L')}</Muted>
        </View>
      )}

      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Icon name="info" size="sm" color="muted" />
        <View className="flex-1">
          <Muted small>{t('health.log.appleHealth', 'Synced readings from Apple Health appear here automatically.')}</Muted>
        </View>
      </View>
    </Screen>
  );
}
