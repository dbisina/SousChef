/**
 * @fileoverview Food scanner - dark scan screen (FoodScanner.html) and the portion-analysis result state (ScanResult.html).
 *
 * Logic preserved: usePortionAnalysis (scan limits, access denied), remaining-scan counter from useSubscription,
 * CameraCapture modal, rescan with ingredient hints, Paywall.
 *
 * @module app/(tabs)/scan
 */

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SAMPLE } from '@/assets/sample';
import { usePortionAnalysis } from '@/hooks/useAI';
import { useRemainingUsage } from '@/hooks/useSubscription';
import { CameraCapture } from '@/components/camera';
import { foodPhoto } from '@/components/mealplan/foodPhoto';
import {
  CtaBar,
  H2,
  Icon,
  Muted,
  Rows,
  Screen,
  Sheet,
  Tag,
  Tile,
  Title,
  UAvatar,
  UButton,
  UIconButton,
  UInput,
  FONT,
  useColor,
} from '@/components/ui';
import { Paywall } from '@/components/subscription';
import { FIXED } from '@/stores/themeStore';

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const shutterFill = useColor('paper');
  const insets = useSafeAreaInsets();
  const {
    result: portionResult,
    isAnalyzing,
    analyzeImage,
    clear: clearPortionResult,
    accessDenied,
  } = usePortionAnalysis();
  const { remainingPortion } = useRemainingUsage();

  const [showCamera, setShowCamera] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showFix, setShowFix] = useState(false);
  const [hintInput, setHintInput] = useState('');
  const [hints, setHints] = useState<string[]>([]);

  const handleCapture = async (imageUri: string) => {
    setCapturedImage(imageUri);
    setShowCamera(false);
    // Analyze without a specific recipe - just general food analysis
    const result = await analyzeImage(imageUri);
    if (!result && accessDenied) {
      setShowPaywall(true);
    }
  };

  const resetScan = () => {
    setCapturedImage(null);
    setHints([]);
    setHintInput('');
    setShowFix(false);
    clearPortionResult();
  };

  const handleDismissResult = () => resetScan();

  const handleNewScan = () => {
    resetScan();
    setShowCamera(true);
  };

  const handleRescan = async (ingredientHints: string[]) => {
    if (!capturedImage) return;
    await analyzeImage(capturedImage, undefined, ingredientHints);
  };

  const handleStartScan = () => {
    if (remainingPortion === 0) {
      setShowPaywall(true);
      return;
    }
    setShowCamera(true);
  };

  const handlePickFromGallery = async () => {
    if (remainingPortion === 0) {
      setShowPaywall(true);
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!picked.canceled && picked.assets[0]) {
      await handleCapture(picked.assets[0].uri);
    }
  };

  const showTips = () =>
    Alert.alert(
      t('foodScan.tipsTitle', 'Tips for Better Results'),
      [
        t('foodScan.tip1', 'Use good lighting'),
        t('foodScan.tip2', 'Capture the entire plate'),
        t('foodScan.tip3', 'Avoid blurry images'),
        t('foodScan.tip4', 'Include a reference object for scale'),
      ]
        .map((s) => `• ${s}`)
        .join('\n'),
      [{ text: t('common.ok', 'OK') }]
    );

  const addHint = () => {
    const trimmed = hintInput.trim();
    if (trimmed && !hints.includes(trimmed)) {
      setHints((prev) => [...prev, trimmed]);
      setHintInput('');
    }
  };

  const leftLabel =
    remainingPortion === 'unlimited'
      ? t('foodScan.unlimited', 'Unlimited')
      : t('foodScan.left', '{{n}} left', { n: remainingPortion });

  const paywall = (
    <Paywall
      visible={showPaywall}
      onClose={() => setShowPaywall(false)}
      feature="Portion Analysis"
      requiredTier={accessDenied?.upgradeRequired || 'premium'}
    />
  );
  const camera = (
    <CameraCapture
      visible={showCamera}
      onClose={() => setShowCamera(false)}
      onCapture={handleCapture}
      title={t('foodScan.cameraTitle', 'Scan Food')}
      description={t('foodScan.cameraDesc', 'Take a photo of your food for calorie analysis')}
    />
  );

  // ── Result state (ScanResult.html) ───────────────────────────────────
  if (portionResult && capturedImage) {
    const items = portionResult.detectedItems ?? [];
    const avgConfidence =
      items.length > 0 ? Math.round((items.reduce((s, i) => s + (i.confidence ?? 0), 0) / items.length) * 100) : 0;
    const servings = portionResult.suggestedServings;

    return (
      <Screen
        bare
        footer={
          <CtaBar fade>
            <UButton
              variant="ghost"
              label={t('foodScan.fixItems', 'Fix items')}
              onPress={() => setShowFix(true)}
              disabled={isAnalyzing}
            />
            <UButton label={t('foodScan.scanAnother', 'Scan Another')} onPress={handleNewScan} />
          </CtaBar>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
          <View style={{ height: 330, overflow: 'hidden' }}>
            <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            <LinearGradient
              pointerEvents="none"
              colors={[FIXED.photoFadeTop, FIXED.photoFadeFrom, FIXED.photoFadeFrom, FIXED.photoFadeBottom]}
              locations={[0, 0.3, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View
              className="flex-row items-center justify-between"
              style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, right: 20 }}
            >
              <UIconButton icon="close" tone="glassDark" label={t('foodScan.dismiss', 'Dismiss')} onPress={handleDismissResult} />
              <Tag large tone="glassDark" label={t('foodScan.portion', 'Portion analysis')} />
              <View style={{ width: 46 }} />
            </View>
            <View style={{ position: 'absolute', left: 22, right: 22, bottom: 54, gap: 4 }}>
              <RNText
                numberOfLines={2}
                style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: FIXED.paper }}
              >
                {t('foodScan.yourPlate', 'Your plate')}
              </RNText>
              <RNText style={{ fontFamily: FONT.sans, fontSize: 12, color: FIXED.captionSub }}>
                {t('foodScan.found', '{{n}} items found · {{s}} serving', { n: items.length, s: servings })}
              </RNText>
            </View>
          </View>

          <View
            className="bg-ground"
            style={{
              marginTop: -34,
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              paddingTop: 24,
              paddingHorizontal: 20,
              gap: 14,
            }}
          >
            <View>
              <Muted small>{t('foodScan.total', 'Total')}</Muted>
              <RNText
                accessibilityLabel={`${portionResult.totalEstimatedCalories} kcal`}
                className="text-ink"
                style={{ fontFamily: FONT.display, fontSize: 34, letterSpacing: -0.68 }}
              >
                {portionResult.totalEstimatedCalories}{' '}
                <RNText className="text-muted" style={{ fontSize: 16 }}>
                  kcal
                </RNText>
              </RNText>
            </View>

            <View className="flex-row" style={{ gap: 10 }}>
              <View className="flex-1">
                <Tile value={items.length} label={t('foodScan.items', 'Items')} />
              </View>
              <View className="flex-1">
                <Tile value={servings} label={t('foodScan.servings', 'Servings')} />
              </View>
              <View className="flex-1">
                <Tile value={`${avgConfidence}%`} label={t('foodScan.confidence', 'Confidence')} />
              </View>
            </View>

            {portionResult.recommendations?.length > 0 ? (
              <View style={{ gap: 6 }}>
                {portionResult.recommendations.map((r, i) => (
                  <Muted key={i} small>{`• ${r}`}</Muted>
                ))}
              </View>
            ) : null}

            {items.length > 0 ? (
              <Rows>
                {items.map((item, i) => (
                  <View key={`${item.name}-${i}`} className="flex-row items-center" style={{ minHeight: 64, gap: 14 }}>
                    <UAvatar name={item.name} source={foodPhoto(item.name)} size={44} />
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <Title numberOfLines={1}>{item.name}</Title>
                      <Muted small numberOfLines={1}>
                        {`${item.estimatedAmount} ${item.unit}`}
                      </Muted>
                    </View>
                    <Muted>{`${item.estimatedCalories} kcal`}</Muted>
                  </View>
                ))}
              </Rows>
            ) : (
              <View className="items-center" style={{ paddingVertical: 12, gap: 8 }}>
                <Icon name="camera" size="lg" color="muted" />
                <Title>{t('foodScan.noItems', 'Could not identify food items')}</Title>
                <Muted small center>
                  {t('foodScan.noItemsHint', 'Try taking a clearer photo with better lighting, or move closer to the food')}
                </Muted>
              </View>
            )}
          </View>
        </ScrollView>

        <Sheet visible={showFix} onClose={() => setShowFix(false)} title={t('foodScan.fixItems', 'Fix items')}>
          <H2>{t('foodScan.fixTitle', 'Wrong ingredients?')}</H2>
          <Muted small>
            {t(
              'foodScan.fixHelp',
              'List the actual ingredients in your food. The AI will rescan with this context for better accuracy.'
            )}
          </Muted>
          {hints.length > 0 ? (
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {hints.map((hint, index) => (
                <Pressable
                  key={hint}
                  accessibilityRole="button"
                  accessibilityLabel={t('foodScan.removeHint', 'Remove {{name}}', { name: hint })}
                  onPress={() => setHints((prev) => prev.filter((_, i) => i !== index))}
                  className="flex-row items-center bg-surface-3"
                  style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, gap: 6 }}
                >
                  <RNText className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 13 }}>
                    {hint}
                  </RNText>
                  <Icon name="close" size="sm" color="muted" />
                </Pressable>
              ))}
            </View>
          ) : null}
          <UInput
            label={t('foodScan.addIngredient', 'Add ingredient')}
            placeholder={t('foodScan.addIngredientPh', 'Add an ingredient')}
            value={hintInput}
            onChangeText={setHintInput}
            onSubmitEditing={addHint}
            returnKeyType="done"
            right={<UIconButton icon="plus" tone="black" size={44} label={t('foodScan.add', 'Add')} onPress={addHint} />}
          />
          <UButton
            variant="accent"
            label={t('foodScan.rescan', 'Rescan')}
            loading={isAnalyzing}
            disabled={hints.length === 0}
            onPress={async () => {
              await handleRescan(hints);
              setShowFix(false);
            }}
          />
        </Sheet>

        {camera}
        {paywall}
      </Screen>
    );
  }

  // ── Scan state (FoodScanner.html, dark) ──────────────────────────────
  const denied = !!accessDenied && !!capturedImage && !isAnalyzing;
  const bottomPad = Math.max(insets.bottom, 24);

  return (
    <Screen tone="dark" bare>
      <Image
        source={capturedImage ? { uri: capturedImage } : SAMPLE.bowl}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessible={false}
      />

      <View
        className="flex-row items-center justify-between"
        style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, right: 20, zIndex: 2 }}
      >
        <UIconButton icon="back" tone="glassDark" label={t('common.back', 'Back')} onPress={() => router.back()} />
        <Tag large tone="glassDark" label={t('foodScan.title', 'Food Scanner')} />
        <Tag large tone="glassDark" label={leftLabel} />
      </View>

      <View
        className="bg-ground"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          paddingTop: 22,
          paddingHorizontal: 24,
          paddingBottom: bottomPad,
          minHeight: 220,
          gap: 20,
        }}
      >
        {denied ? (
          <View className="items-center" style={{ gap: 12 }}>
            <Icon name="lock" size="lg" color="accent" />
            <Title center>{t('foodScan.upgradeTitle', 'Upgrade Required')}</Title>
            <Muted small center>
              {accessDenied?.reason === 'limit_reached'
                ? t('foodScan.limitReached', "You've reached your daily limit of {{n}} scans.", { n: accessDenied.limit })
                : t('foodScan.premiumOnly', 'Food scanning is a premium feature.')}
            </Muted>
            <View style={{ alignSelf: 'stretch' }}>
              <UButton
                variant="accent"
                icon="star"
                label={t('foodScan.upgradeNow', 'Upgrade Now')}
                onPress={() => setShowPaywall(true)}
              />
            </View>
          </View>
        ) : (
          <View className="items-center" style={{ gap: 2 }}>
            <Title center style={{ fontSize: 18 }}>
              {isAnalyzing
                ? t('foodScan.analyzing', 'Analyzing your plate…')
                : t('foodScan.ready', 'Ready to scan')}
            </Title>
            <Muted small center>
              {isAnalyzing
                ? t('foodScan.analyzingHint', 'Identifying ingredients and portions')
                : t('foodScan.readyHint', 'Snap your plate for calories and nutrition')}
            </Muted>
          </View>
        )}

        <View className="flex-row items-center justify-between">
          <UIconButton
            icon="image"
            size={56}
            label={t('foodScan.gallery', 'Gallery')}
            disabled={isAnalyzing}
            onPress={handlePickFromGallery}
          />
          <View
            style={{ width: 92, height: 92, borderRadius: 46, marginVertical: -7, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: shutterFill }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('foodScan.scanFood', 'Scan food')}
              accessibilityState={{ disabled: isAnalyzing }}
              disabled={isAnalyzing}
              onPress={handleStartScan}
              style={({ pressed }) => ({
                backgroundColor: shutterFill,
                width: 78,
                height: 78,
                borderRadius: 39,
                opacity: isAnalyzing ? 0.4 : pressed ? 0.85 : 1,
              })}
            />
          </View>
          <UIconButton icon="help" size={56} label={t('foodScan.tips', 'Tips')} onPress={showTips} />
        </View>
      </View>

      {camera}
      {paywall}
    </Screen>
  );
}
