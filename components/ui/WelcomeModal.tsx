import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
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

  useEffect(() => {
    checkIfShouldShow();
  }, [forceShow]);

  const checkIfShouldShow = async () => {
    if (forceShow) {
      showModal();
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

            {/* Sponsored Ad Section - 1:1 Image in the middle */}
            <View className="mx-6 mt-4">
              <Text className="text-xs text-neutral-400 text-center mb-2">SPONSORED</Text>
              <TouchableOpacity activeOpacity={0.9}>
                <View className="rounded-2xl overflow-hidden bg-neutral-100">
                  {/* 1:1 Aspect Ratio Image */}
                  <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=800&q=80' }}
                    className="w-full aspect-square"
                    resizeMode="cover"
                  />
                  {/* Ad overlay content */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    className="absolute bottom-0 left-0 right-0 p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-white font-bold text-lg">Fresh Ingredients</Text>
                        <Text className="text-white/80 text-sm">Get 20% off your first order</Text>
                      </View>
                      <View className="bg-secondary-500 px-4 py-2 rounded-full">
                        <Text className="text-white font-semibold">Shop Now</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            </View>

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
            <View className="mx-6 mt-2">
              <LinearGradient
                colors={['#FFF7ED', '#FFEDD5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-2xl p-4"
              >
                <View className="flex-row items-center">
                  <View className="w-14 h-14 rounded-xl bg-primary-500 items-center justify-center">
                    <Ionicons name="star" size={28} color="white" />
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="text-lg font-bold text-neutral-900">
                      Upgrade to Pro
                    </Text>
                    <Text className="text-sm text-neutral-600 mt-1">
                      Unlock unlimited AI features and exclusive recipes!
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center mt-3 pt-3 border-t border-primary-200">
                  <Ionicons name="checkmark-circle" size={16} color="#FF6B35" />
                  <Text className="text-primary-700 text-sm ml-2">7-day free trial available</Text>
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
  <View className="flex-row items-center mb-4">
    <View
      className="w-12 h-12 rounded-xl items-center justify-center"
      style={{ backgroundColor: `${color}15` }}
    >
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <View className="flex-1 ml-3">
      <Text className="font-semibold text-neutral-900">{title}</Text>
      <Text className="text-sm text-neutral-500">{description}</Text>
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
