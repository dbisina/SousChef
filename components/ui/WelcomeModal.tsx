import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Dim, H1, LinkText, Muted } from './Typography';
import { UIconButton } from './IconButton';
import { Rows, ListRow } from './Lists';
import { UButton } from './UButton';
import { ToneBlock, useColor } from './tone';
import { FIXED, useThemeStore } from '@/stores/themeStore';
import { SponsoredAdCard } from './SponsoredAdCard';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierFeatures } from '@/services/subscriptionService';
import { isReviewWelcome } from '@/lib/designReview';

const STORAGE_KEY = '@souschef_welcome_last_shown';
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const CLOSE_FALLBACK_MS = 350;
const CLOSE_DURATION_MS = 260;

/**
 * Module-level: survives remounts of Home, resets only on a cold app launch.
 * Once the sheet has been evaluated (shown or skipped) it is never evaluated again this launch.
 */
let sessionHandled = false;

interface WelcomeModalProps {
  /** Open regardless of the 3 day cooldown (still respects the once per launch flag unless forced). */
  forceShow?: boolean;
  onDismiss?: () => void;
}

/**
 * Welcome bottom sheet. Show logic: at most once per app launch, and only if it was not
 * shown in the last 3 days (AsyncStorage timestamp). Subscription state changes never re-trigger it.
 */
export const WelcomeModal: React.FC<WelcomeModalProps> = ({ forceShow: forceShowProp, onDismiss }) => {
  const forceShow = forceShowProp || isReviewWelcome();
  const [visible, setVisible] = useState(false);
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const theme = useThemeStore((st) => st.effectiveTheme);
  const { subscriptionTier } = useSubscription();
  const adFree = getTierFeatures(subscriptionTier).adFree;
  const grabber = useColor('divider');
  const sheetFill = useColor('ground');

  const sheetH = useSharedValue(screenH);
  const translateY = useSharedValue(screenH);
  const backdrop = useSharedValue(0);
  const closing = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Evaluate once on mount. Deliberately no dependency on subscription state.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (sessionHandled && !forceShow) return;
      sessionHandled = true;
      if (!forceShow) {
        try {
          const last = Number(await AsyncStorage.getItem(STORAGE_KEY));
          if (last && Date.now() - last < COOLDOWN_MS) return;
        } catch {
          // storage unavailable: still show once this launch
        }
      }
      if (cancelled) return;
      closing.current = false;
      setVisible(true);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slide in when the Modal mounts.
  useEffect(() => {
    if (!visible) return;
    translateY.value = sheetH.value || screenH;
    translateY.value = withSpring(0, { damping: 22, stiffness: 170 });
    backdrop.value = withTiming(1, { duration: 250 });
    AsyncStorage.setItem(STORAGE_KEY, String(Date.now())).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const finish = useCallback(() => {
    if (fallback.current) {
      clearTimeout(fallback.current);
      fallback.current = null;
    }
    setVisible(false);
    onDismissRef.current?.();
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const target = sheetH.value || screenH;
    translateY.value = withTiming(target, { duration: CLOSE_DURATION_MS, easing: Easing.out(Easing.cubic) });
    backdrop.value = withTiming(0, { duration: CLOSE_DURATION_MS });
    // Never rely on the UI-thread callback alone: always hide the Modal.
    fallback.current = setTimeout(finish, CLOSE_FALLBACK_MS);
  }, [finish, screenH, sheetH, translateY, backdrop]);

  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      backdrop.value = Math.max(0, 1 - translateY.value / (sheetH.value || 1));
    })
    .onEnd((e) => {
      const h = sheetH.value || 1;
      if (translateY.value > h * 0.25 || e.velocityY > 900) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 170 });
        backdrop.value = withTiming(1, { duration: 150 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ToneBlock tone={theme} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: FIXED.scrim }, backdropStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Close')}
              onPress={close}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View
              accessibilityViewIsModal
              onLayout={(e) => {
                sheetH.value = e.nativeEvent.layout.height;
              }}
              style={[
                {
                  backgroundColor: sheetFill,
                  maxHeight: Math.round(screenH * 0.7),
                  borderTopLeftRadius: 34,
                  borderTopRightRadius: 34,
                  paddingTop: 24,
                  paddingHorizontal: 20,
                  paddingBottom: Math.max(insets.bottom, 20),
                  gap: 16,
                },
                sheetStyle,
              ]}
            >
              <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: grabber }} />
              </View>
              <View style={{ position: 'absolute', right: 12, top: 10, zIndex: 1 }}>
                <UIconButton icon="close" label={t('common.close', 'Close')} size={44} onPress={close} />
              </View>

              <View style={{ gap: 6 }}>
                <H1>
                  <Dim>{t('welcome.modal.line1', 'Welcome to')}</Dim>
                  {'\n'}
                  SousChef
                </H1>
                <Muted>{t('welcome.modal.subtitle', 'Your AI cooking companion.')}</Muted>
              </View>

              <Rows>
                <ListRow
                  icon="scan"
                  title={t('welcome.modal.scanTitle', 'Scan your plate')}
                  subtitle={t('welcome.modal.scanBody', 'Calories and nutrition in a snap.')}
                />
                <ListRow
                  icon="mic"
                  title={t('welcome.modal.voiceTitle', 'Cook hands-free')}
                  subtitle={t('welcome.modal.voiceBody', 'Voice guidance while you cook.')}
                />
                <ListRow
                  icon="grid"
                  title={t('welcome.modal.planTitle', 'Plan your week')}
                  subtitle={t('welcome.modal.planBody', 'Meals and shopping lists, sorted.')}
                />
              </Rows>

              {!adFree ? (
                <View style={{ marginHorizontal: -16, marginTop: -12 }}>
                  <SponsoredAdCard placement="welcome_modal" compact />
                </View>
              ) : null}

              <View style={{ gap: 4 }}>
                <UButton label={t('welcome.modal.ok', 'Get started')} onPress={close} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('welcome.modal.later', 'Maybe later')}
                  onPress={close}
                  style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <LinkText>{t('welcome.modal.later', 'Maybe later')}</LinkText>
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
        </ToneBlock>
      </GestureHandlerRootView>
    </Modal>
  );
};

/** Reset the cooldown (for testing). */
export const resetWelcomeModal = async () => {
  sessionHandled = false;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting welcome modal:', error);
  }
};
