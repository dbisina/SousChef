import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Dim, H1, Muted, Title } from './Typography';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Tag } from './Chips';
import { UButton } from './UButton';
import { ToneBlock } from './tone';
import { FIXED, useThemeStore } from '@/stores/themeStore';
import { SponsoredAdCard } from './SponsoredAdCard';
import { useSubscription } from '@/hooks/useSubscription';
import { getTierFeatures } from '@/services/subscriptionService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;
const STORAGE_KEY = '@souschef_welcome_shown';

interface WelcomeModalProps {
  forceShow?: boolean;
  onDismiss?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ forceShow, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const translateY = useSharedValue(MODAL_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const { isSubscribed, isInitialized, subscriptionTier } = useSubscription();
  const features = getTierFeatures(subscriptionTier);
  const { t } = useTranslation();
  const theme = useThemeStore((st) => st.effectiveTheme);

  useEffect(() => {
    if (isInitialized) {
      checkIfShouldShow();
    }
  }, [forceShow, isInitialized, isSubscribed]);

  const checkIfShouldShow = async () => {
    if (forceShow) {
      showModal();
      return;
    }

    // Always show for free users (not subscribed)
    if (isInitialized && !isSubscribed) {
      // Small delay ensuring smooth mount
      setTimeout(() => {
        showModal();
      }, 500);
      return;
    }

    try {
      const hasShown = await AsyncStorage.getItem(STORAGE_KEY);
      if (!hasShown) {
        // Small delay to let the app load first
        setTimeout(() => {
          showModal();
        }, 500);
      }
    } catch (error) {
      console.error('Error checking welcome modal status:', error);
    }
  };

  const showModal = () => {
    setVisible(true);
    translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
    backdropOpacity.value = withTiming(1, { duration: 300 });
  };

  const hideModal = async () => {
    translateY.value = withTiming(MODAL_HEIGHT, { duration: 300 });
    backdropOpacity.value = withTiming(0, { duration: 300 }, () => {
      runOnJS(setVisible)(false);
    });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch (error) {
      console.error('Error saving welcome modal status:', error);
    }

    onDismiss?.();
  };

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={hideModal}>
      <ToneBlock tone={theme} style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: FIXED.scrim },
            animatedBackdropStyle,
          ]}
        />

        {/* Modal Content */}
        <View className="flex-1 justify-end">
          <Animated.View
            className="bg-ground"
            style={[
              { height: MODAL_HEIGHT, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
              animatedModalStyle,
            ]}
          >
            {/* Handle bar */}
            <View className="items-center" style={{ paddingTop: 12, paddingBottom: 8 }}>
              <View className="bg-line" style={{ width: 40, height: 4, borderRadius: 2 }} />
            </View>

            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20, gap: 14 }}
            >
              {/* Header */}
              <View style={{ gap: 8, paddingTop: 8 }}>
                <H1>
                  <Dim>{t('welcome.modal.line1', 'Welcome to')}</Dim>
                  {'\n'}
                  SousChef
                </H1>
                <Muted>{t('welcome.modal.subtitle', 'Your AI-powered cooking companion for delicious meals')}</Muted>
              </View>

              <FeatureItem
                icon="scan"
                title={t('welcome.modal.scanTitle', 'Scan Any Food')}
                description={t('welcome.modal.scanBody', 'Instantly get calorie info and nutritional breakdown')}
              />
              <FeatureItem
                icon="mic"
                title={t('welcome.modal.voiceTitle', 'Voice Control')}
                description={t('welcome.modal.voiceBody', 'Hands-free cooking with voice commands')}
              />

              {/* Sponsored Ad - hidden for ad-free subscribers */}
              {!features.adFree && <SponsoredAdCard placement="welcome_modal" />}

              <FeatureItem
                icon="grid"
                title={t('welcome.modal.planTitle', 'Meal Planning')}
                description={t('welcome.modal.planBody', 'Plan your week and generate shopping lists')}
              />

              {/* Upgrade to Pro */}
              <View className="bg-tag-o" style={{ borderRadius: 28, padding: 18, gap: 10 }}>
                <View className="flex-row items-center" style={{ gap: 14 }}>
                  <View className="items-center justify-center bg-accent" style={{ width: 46, height: 46, borderRadius: 23 }}>
                    <Icon name="star" color="accent-ink" />
                  </View>
                  <View className="flex-1" style={{ gap: 2 }}>
                    <Title className="text-tag-o-fg">{t('welcome.modal.proTitle', 'Upgrade to Pro')}</Title>
                    <Muted small className="text-tag-o-fg">
                      {t('welcome.modal.proBody', 'Unlock unlimited AI features and exclusive recipes!')}
                    </Muted>
                  </View>
                </View>
                <Tag tone="o" icon="check" label={t('welcome.modal.trial', '7-day free trial available')} />
              </View>
            </ScrollView>

            {/* Button */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12 }}>
              <UButton label={t('welcome.modal.ok', 'Okay, got it!')} onPress={hideModal} />
            </View>
          </Animated.View>
        </View>
      </ToneBlock>
    </Modal>
  );
};

interface FeatureItemProps {
  icon: IconName;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <View className="flex-row items-center bg-surface-2" style={{ borderRadius: 24, padding: 16, gap: 14 }}>
    <View className="items-center justify-center bg-surface-3" style={{ width: 46, height: 46, borderRadius: 23 }}>
      <Icon name={icon} />
    </View>
    <View className="flex-1" style={{ gap: 2 }}>
      <Title>{title}</Title>
      <Muted small>{description}</Muted>
    </View>
  </View>
);

// Helper to reset the welcome modal (for testing)
export const resetWelcomeModal = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting welcome modal:', error);
  }
};
