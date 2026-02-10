import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Button } from './Button';
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
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
          animatedBackdropStyle,
        ]}
      />

      {/* Modal Content */}
      <View className="flex-1 justify-end">
        <Animated.View
          style={[
            {
              height: MODAL_HEIGHT,
              backgroundColor: 'white',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            },
            animatedModalStyle,
          ]}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-neutral-300" />
          </View>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Header */}
            <View className="items-center px-6 pt-4">
              <View className="w-20 h-20 rounded-full bg-primary-100 items-center justify-center mb-4">
                <Ionicons name="restaurant" size={40} color="#FF6B35" />
              </View>
              <Text className="text-2xl font-bold text-neutral-900 text-center">
                Welcome to SousChef!
              </Text>
              <Text className="text-neutral-500 text-center mt-2 px-4">
                Your AI-powered cooking companion for delicious meals
              </Text>
            </View>

            {/* Features highlight - Top 2 */}
            <View className="px-6 mt-6">
              <FeatureItem
                icon="scan-outline"
                title="Scan Any Food"
                description="Instantly get calorie info and nutritional breakdown"
                color="#FF6B35"
              />
              <FeatureItem
                icon="mic-outline"
                title="Voice Control"
                description="Hands-free cooking with voice commands"
                color="#22C55E"
              />
            </View>

            {/* Sponsored Ad — hidden for ad-free subscribers */}
            {!features.adFree && (
              <SponsoredAdCard placement="welcome_modal" />
            )}

            {/* Feature - Bottom */}
            <View className="px-6 mt-4">
              <FeatureItem
                icon="calendar-outline"
                title="Meal Planning"
                description="Plan your week and generate shopping lists"
                color="#3B82F6"
              />
            </View>

            {/* Upgrade to Pro Section */}
            <View className="mx-6 mt-6  bg-amber-100/50 rounded-3xl">
              <LinearGradient
                colors={['#FFF7ED', '#FFEDD5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-[15px] rounded-3xl"
                style={{
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 10,
                  elevation: 4,
                }}
              >
                <View className=" pl-4 pt-4 flex-row items-center ">
                  <View className="w-14 h-14 rounded-2xl bg-primary-500 items-center justify-center shadow-sm">
                    <Ionicons name="star" size={28} color="white" />
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="text-lg font-bold text-neutral-900">
                      Upgrade to Pro
                    </Text>
                    <Text className="text-sm text-neutral-600 mt-1 leading-5">
                      Unlock unlimited AI features and exclusive recipes!
                    </Text>
                  </View>
                </View>
                <View className="p-4 flex-row items-center mt-4 pt-4 border-t border-primary-200/50">
                  <View className="bg-primary-100 px-2 py-1 rounded-md mr-2">
                     <Ionicons name="checkmark" size={12} color="#C2410C" />
                  </View>
                  <Text className="text-primary-800 font-medium text-sm">7-day free trial available</Text>
                </View>
              </LinearGradient>
            </View>
          </ScrollView>

          {/* Button */}
          <View className="px-6 pb-8 pt-4 border-t border-neutral-100">
            <Button
              title="Okay, got it!"
              onPress={hideModal}
              fullWidth
              size="lg"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description, color }) => (
  <View className="flex-row items-center p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
    <View
      className="w-12 h-12 rounded-xl items-center justify-center"
      style={{ backgroundColor: `${color}15` }}
    >
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <View className="flex-1 ml-3">
      <Text className="font-bold text-neutral-900 text-base">{title}</Text>
      <Text className="text-sm text-neutral-500 leading-5 mt-0.5">{description}</Text>
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
