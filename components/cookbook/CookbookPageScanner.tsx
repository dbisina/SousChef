import React, { useRef, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useAuthStore } from '@/stores/authStore';
import { FIXED } from '@/stores/themeStore';
import { Body, Field, H1, H2, Icon, LinkText, Muted, Screen, Tag, UButton, UIconButton } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';

const MAX_PAGES = 10;
const FRAME_TOP = 140;
const FRAME_SIDE = 34;
const FRAME_BOTTOM = 250;

interface CookbookPageScannerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (recipeTitle: string) => void;
}

/**
 * Dark full-screen cookbook page scanner (Scanner.html). Same behaviour as the
 * old import/CookbookScanner: capture or pick up to 10 pages, review them,
 * optionally name the book, then extract the recipe through wantToCookStore.
 */
export function CookbookPageScanner({ visible, onClose, onSuccess }: CookbookPageScannerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'camera' | 'review' | 'naming'>('camera');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [cookbookName, setCookbookName] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { user } = useAuthStore();
  const { importFromPhoto, importFromMultiplePhotos, isImporting, importProgress, error } = useWantToCookStore();

  const frameHeight = useSharedValue(0);
  const scanProgress = useSharedValue(0);

  React.useEffect(() => {
    if (visible && mode === 'camera') {
      scanProgress.value = 0;
      scanProgress.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
    }
  }, [visible, mode, scanProgress]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanProgress.value * Math.max(frameHeight.value - 2, 0) }],
  }));

  const haptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    if (capturedImages.length >= MAX_PAGES) {
      Alert.alert(
        t('cookbooks.scanner.maxTitle', 'Maximum pages'),
        t('cookbooks.scanner.maxBody', 'You can scan up to {{n}} pages per recipe.', { n: MAX_PAGES })
      );
      return;
    }
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (photo?.uri) setCapturedImages((prev) => [...prev, photo.uri]);
    } catch (e) {
      console.error('Failed to capture:', e);
      Alert.alert(
        t('cookbooks.scanner.captureFailedTitle', 'Error'),
        t('cookbooks.scanner.captureFailedBody', 'Failed to capture photo. Please try again.')
      );
    }
  };

  const handlePickImages = async () => {
    const remaining = MAX_PAGES - capturedImages.length;
    if (remaining <= 0) {
      Alert.alert(
        t('cookbooks.scanner.maxTitle', 'Maximum pages'),
        t('cookbooks.scanner.maxBody', 'You can scan up to {{n}} pages per recipe.', { n: MAX_PAGES })
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets.length > 0) {
      setCapturedImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleRemovePage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
    setPreviewIndex(0);
  };

  const handleDone = () => {
    if (capturedImages.length === 0) {
      Alert.alert(
        t('cookbooks.scanner.noPagesTitle', 'No pages'),
        t('cookbooks.scanner.noPagesBody', 'Capture at least one page before continuing.')
      );
      return;
    }
    setMode('review');
  };

  const handleClose = () => {
    setCapturedImages([]);
    setCookbookName('');
    setMode('camera');
    setPreviewIndex(0);
    setTorch(false);
    onClose();
  };

  const handleScan = async () => {
    if (capturedImages.length === 0 || !user) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);

    const result =
      capturedImages.length === 1
        ? await importFromPhoto(capturedImages[0], user.id, cookbookName || undefined)
        : await importFromMultiplePhotos(capturedImages, user.id, cookbookName || undefined);

    if (result) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const title = result.importedRecipe?.title || t('cookbooks.scanner.defaultRecipe', 'Recipe');
      handleClose();
      onSuccess?.(title);
    }
  };

  if (!visible) return null;

  const pageCount = capturedImages.length;
  const pagesLabel = t('cookbooks.scanner.pageCount', '{{count}} pages', { count: pageCount });

  // Camera permission not granted yet
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
        <Screen tone="dark" bare>
          <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 16 }}>
            <View className="items-center justify-center bg-surface-2" style={{ width: 80, height: 80, borderRadius: 40 }}>
              <Icon name="camera" size="lg" />
            </View>
            <H2 center>{t('cookbooks.scanner.permissionTitle', 'Camera access needed')}</H2>
            <Muted center>
              {t('cookbooks.scanner.permissionBody', 'To scan cookbook pages, we need access to your camera.')}
            </Muted>
            <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
              <UButton
                label={t('cookbooks.scanner.permissionAllow', 'Allow camera access')}
                variant="accent"
                onPress={requestPermission}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel', 'Cancel')}
                onPress={onClose}
                className="items-center justify-center"
                style={{ minHeight: 44 }}
              >
                <LinkText>{t('common.cancel', 'Cancel')}</LinkText>
              </Pressable>
            </View>
          </View>
        </Screen>
      </Modal>
    );
  }

  const topRow = (
    <View
      className="flex-row items-center justify-between"
      style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, right: 20, zIndex: 3 }}
    >
      <UIconButton icon="close" tone="glassDark" label={t('cookbooks.scanner.close', 'Close')} onPress={handleClose} />
      <Tag
        tone="glassDark"
        large
        label={
          pageCount > 0
            ? t('cookbooks.scanner.pagesCaptured', '{{count}} pages captured', { count: pageCount })
            : t('cookbooks.scanner.title', 'Cookbook scanner')
        }
      />
      <UIconButton
        icon="bulb"
        tone={torch ? 'accent' : 'glassDark'}
        label={t('cookbooks.scanner.flash', 'Flash')}
        onPress={() => setTorch((v) => !v)}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <Screen tone="dark" bare>
        {/* ── CAMERA ─────────────────────────────────────────── */}
        {mode === 'camera' && (
          <View style={{ flex: 1 }}>
            <CameraView
              ref={cameraRef}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              facing="back"
              enableTorch={torch}
            />

            {/* Dimmed surround with a clear page frame */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <View style={{ height: FRAME_TOP, backgroundColor: FIXED.scrim }} />
              <View style={{ flex: 1, flexDirection: 'row' }}>
                <View style={{ width: FRAME_SIDE, backgroundColor: FIXED.scrim }} />
                <View
                  style={{ flex: 1, borderRadius: 30, borderWidth: 2, borderColor: FIXED.paper, overflow: 'hidden' }}
                  onLayout={(e) => {
                    frameHeight.value = e.nativeEvent.layout.height;
                  }}
                >
                  <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 2 }, scanLineStyle]}>
                    <LinearGradient
                      colors={['transparent', FIXED.accent, 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: '100%' }}
                    />
                  </Animated.View>
                </View>
                <View style={{ width: FRAME_SIDE, backgroundColor: FIXED.scrim }} />
              </View>
              <View style={{ height: FRAME_BOTTOM, backgroundColor: FIXED.scrim }} />
            </View>

            {topRow}

            {/* Bottom panel */}
            <View
              className="bg-night"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                minHeight: 230,
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                paddingTop: 20,
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 16),
                gap: 18,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 10, minHeight: 52 }}>
                {pageCount > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0, maxWidth: '58%' }}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {capturedImages.map((uri, idx) => (
                      <Pressable
                        key={`${uri}-${idx}`}
                        accessibilityRole="button"
                        accessibilityLabel={t('cookbooks.scanner.reviewPage', 'Review page {{n}}', { n: idx + 1 })}
                        onPress={() => {
                          setPreviewIndex(idx);
                          setMode('review');
                        }}
                      >
                        <Image
                          source={{ uri }}
                          contentFit="cover"
                          style={{ width: 52, height: 52, borderRadius: 14 }}
                          accessible={false}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <Muted small style={{ flex: 1 }}>
                  {pageCount === 0
                    ? t('cookbooks.scanner.hint', 'Line the page up inside the frame')
                    : t('cookbooks.scanner.hintMore', 'Keep snapping or tap next')}
                </Muted>
              </View>

              <View className="flex-row items-center justify-between">
                <UIconButton
                  icon="image"
                  size={56}
                  label={t('cookbooks.scanner.gallery', 'Gallery')}
                  onPress={handlePickImages}
                />
                <View
                  className="items-center justify-center"
                  style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: FIXED.paper }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('cookbooks.scanner.capture', 'Capture page')}
                    onPress={handleCapture}
                    style={({ pressed }) => ({
                      width: 78,
                      height: 78,
                      borderRadius: 39,
                      backgroundColor: FIXED.paper,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  />
                </View>
                <UIconButton
                  icon="arrowRight"
                  size={56}
                  tone="accent"
                  label={t('cookbooks.scanner.next', 'Next')}
                  onPress={handleDone}
                />
              </View>
            </View>
          </View>
        )}

        {/* ── REVIEW ─────────────────────────────────────────── */}
        {mode === 'review' && (
          <View style={{ flex: 1 }}>
            <View
              className="flex-row items-center justify-between"
              style={{ paddingTop: Math.max(insets.top, 20) + 14, paddingBottom: 14, paddingHorizontal: 20, gap: 12 }}
            >
              <UButton
                label={t('cookbooks.scanner.addMore', 'Add more')}
                icon="camera"
                variant="ghost"
                size="sm"
                onPress={() => setMode('camera')}
              />
              <RNText className="text-ink" style={{ fontFamily: FONT.display, fontSize: 17 }}>
                {pagesLabel}
              </RNText>
              <UButton
                label={t('cookbooks.scanner.next', 'Next')}
                icon="arrowRight"
                variant="accent"
                size="sm"
                disabled={pageCount === 0}
                onPress={() => setMode('naming')}
              />
            </View>

            <FlatList
              data={capturedImages}
              numColumns={2}
              keyExtractor={(uri, idx) => `${uri}-${idx}`}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 16) }}
              renderItem={({ item: uri, index }) => (
                <View style={{ flex: 1, margin: 8, aspectRatio: 3 / 4 }}>
                  <Image
                    source={{ uri }}
                    contentFit="cover"
                    style={{ flex: 1, borderRadius: 26 }}
                    accessibilityLabel={t('cookbooks.scanner.pageN', 'Page {{n}}', { n: index + 1 })}
                  />
                  <View style={{ position: 'absolute', top: 10, left: 10 }}>
                    <Tag tone="glassDark" label={t('cookbooks.scanner.pageN', 'Page {{n}}', { n: index + 1 })} />
                  </View>
                  <View style={{ position: 'absolute', top: 6, right: 6 }}>
                    <UIconButton
                      icon="trash"
                      tone="glassDark"
                      size={40}
                      label={t('cookbooks.scanner.removePage', 'Remove page {{n}}', { n: index + 1 })}
                      onPress={() => handleRemovePage(index)}
                    />
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View className="items-center" style={{ paddingVertical: 80, gap: 12 }}>
                  <Icon name="image" size="lg" color="muted" />
                  <Muted>{t('cookbooks.scanner.noPages', 'No pages captured')}</Muted>
                </View>
              }
            />
          </View>
        )}

        {/* ── NAMING ─────────────────────────────────────────── */}
        {mode === 'naming' && pageCount > 0 && (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <Image
                source={{ uri: capturedImages[Math.min(previewIndex, pageCount - 1)] }}
                contentFit="contain"
                style={{ flex: 1 }}
                accessible={false}
              />
              <View
                className="flex-row items-center justify-between"
                style={{ position: 'absolute', top: Math.max(insets.top, 20) + 14, left: 20, right: 20 }}
              >
                <UIconButton
                  icon="back"
                  tone="glassDark"
                  label={t('cookbooks.scanner.backToReview', 'Back to review')}
                  onPress={() => setMode('review')}
                />
                <Tag tone="glassDark" large label={pagesLabel} />
              </View>
              {pageCount > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ position: 'absolute', bottom: 48, left: 0, right: 0 }}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                >
                  {capturedImages.map((uri, idx) => (
                    <Pressable
                      key={`${uri}-${idx}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('cookbooks.scanner.previewPage', 'Preview page {{n}}', { n: idx + 1 })}
                      onPress={() => setPreviewIndex(idx)}
                    >
                      <Image
                        source={{ uri }}
                        contentFit="cover"
                        style={{
                          width: 48,
                          height: 64,
                          borderRadius: 12,
                          borderWidth: previewIndex === idx ? 2 : 0,
                          borderColor: FIXED.accent,
                        }}
                        accessible={false}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            <View
              className="bg-ground"
              style={{
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                marginTop: -34,
                paddingTop: 24,
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 20),
                gap: 14,
              }}
            >
              <View style={{ gap: 4 }}>
                <H1 style={{ fontSize: 24, lineHeight: 27, letterSpacing: -0.72 }}>
                  {t('cookbooks.scanner.almostThere', 'Almost there')}
                </H1>
                <Muted>
                  {pageCount > 1
                    ? t('cookbooks.scanner.analyzeAll', 'We will read all {{n}} pages together to extract the full recipe.', { n: pageCount })
                    : t('cookbooks.scanner.nameOptional', 'Optionally name the cookbook this recipe is from.')}
                </Muted>
              </View>

              <Field
                label={t('cookbooks.scanner.nameLabel', 'Cookbook name (optional)')}
                placeholder={t('cookbooks.scanner.namePlaceholder', 'e.g. Salt, Fat, Acid, Heat')}
                value={cookbookName}
                onChangeText={setCookbookName}
              />

              {error ? <Body className="text-tag-r-fg">{error}</Body> : null}

              {isImporting ? (
                <View className="flex-row items-center bg-surface" style={{ borderRadius: 22, padding: 14, gap: 10 }}>
                  <Icon name="refresh" color="muted" />
                  <Body className="flex-1">
                    {importProgress || t('cookbooks.scanner.extracting', 'Extracting recipe...')}
                  </Body>
                </View>
              ) : null}

              <UButton
                label={
                  isImporting
                    ? t('cookbooks.scanner.scanning', 'Scanning...')
                    : pageCount > 1
                      ? t('cookbooks.scanner.extractMany', 'Extract from {{n}} pages', { n: pageCount })
                      : t('cookbooks.scanner.extractOne', 'Extract recipe')
                }
                variant="accent"
                loading={isImporting}
                onPress={handleScan}
              />
            </View>
          </View>
        )}
      </Screen>
    </Modal>
  );
}

export default CookbookPageScanner;
