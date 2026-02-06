import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  SharedValue,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useAuthStore } from '@/stores/authStore';
import { detectPlatform } from '@/services/recipeImportService';
import * as Clipboard from 'expo-clipboard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface URLImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (recipeTitle: string) => void;
}

interface PlatformInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string[];
}

const SUPPORTED_PLATFORMS: PlatformInfo[] = [
  { id: 'tiktok', name: 'TikTok', icon: 'logo-tiktok', color: '#000000', gradient: ['#00f2ea', '#ff0050'] },
  { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', color: '#E4405F', gradient: ['#833ab4', '#fd1d1d', '#fcb045'] },
  { id: 'youtube', name: 'YouTube', icon: 'logo-youtube', color: '#FF0000', gradient: ['#FF0000', '#cc0000'] },
  { id: 'pinterest', name: 'Pinterest', icon: 'logo-pinterest', color: '#BD081C', gradient: ['#BD081C', '#8c0615'] },
  { id: 'website', name: 'Website', icon: 'globe-outline', color: '#6366F1', gradient: ['#6366F1', '#8B5CF6'] },
];

// Separate component for platform icon to properly use hooks
const PlatformIcon = memo<{
  platform: PlatformInfo;
  animValue: SharedValue<number>;
  isActive: boolean;
}>(({ platform, animValue, isActive }) => {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: animValue.value },
      { translateY: interpolate(animValue.value, [0, 1], [20, 0]) },
    ],
    opacity: animValue.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <View className={`items-center ${isActive ? 'opacity-100' : 'opacity-60'}`}>
        <LinearGradient
          colors={platform.gradient as [string, string, ...string[]]}
          className="w-12 h-12 rounded-xl items-center justify-center mb-1"
          style={isActive ? { shadowColor: platform.color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 } : {}}
        >
          <Ionicons name={platform.icon as any} size={22} color="white" />
        </LinearGradient>
        <Text className={`text-xs ${isActive ? 'text-neutral-900 font-medium' : 'text-neutral-500'}`}>
          {platform.name}
        </Text>
      </View>
    </Animated.View>
  );
});

PlatformIcon.displayName = 'PlatformIcon';

export const URLImportModal: React.FC<URLImportModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [url, setUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { user } = useAuthStore();
  const { importFromURL, isImporting, importProgress, error, setError } = useWantToCookStore();

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.9);
  const inputScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);
  // Fixed number of shared values for platforms (must be stable across renders)
  const platformAnim0 = useSharedValue(0);
  const platformAnim1 = useSharedValue(0);
  const platformAnim2 = useSharedValue(0);
  const platformAnim3 = useSharedValue(0);
  const platformAnim4 = useSharedValue(0);
  const platformAnimations = [platformAnim0, platformAnim1, platformAnim2, platformAnim3, platformAnim4];

  useEffect(() => {
    if (visible) {
      setError(null);
      backdropOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withSpring(1, { damping: 20, stiffness: 300 });

      // Stagger platform icons
      platformAnimations.forEach((anim, index) => {
        anim.value = withDelay(100 + index * 50, withSpring(1, { damping: 15 }));
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      modalScale.value = withTiming(0.9, { duration: 200 });
      platformAnimations.forEach((anim) => {
        anim.value = 0;
      });
    }
  }, [visible]);

  useEffect(() => {
    if (isImporting) {
      // Animate progress bar
      progressWidth.value = withTiming(30, { duration: 500 });
      setTimeout(() => {
        progressWidth.value = withTiming(60, { duration: 1000 });
      }, 500);
      setTimeout(() => {
        progressWidth.value = withTiming(85, { duration: 1500 });
      }, 1500);
    } else {
      progressWidth.value = 0;
    }
  }, [isImporting]);

  const handlePaste = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setUrl(text);
        inputScale.value = withSequence(
          withSpring(1.02),
          withSpring(1)
        );
      }
    } catch (e) {
      console.error('Failed to paste:', e);
    }
  };

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert('Enter URL', 'Please paste a recipe URL to import.');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save recipes.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Keyboard.dismiss();

    const result = await importFromURL(url.trim(), user.id);

    if (result) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const title = result.importedRecipe?.title || 'Recipe';
      setUrl('');
      onClose();
      onSuccess?.(title);
    } else if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const detectedPlatform = url ? detectPlatform(url) : null;
  const platformInfo = SUPPORTED_PLATFORMS.find((p) => p.id === detectedPlatform);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: interpolate(modalScale.value, [0.9, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const inputStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop with blur */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          backdropStyle,
        ]}
      >
        <BlurView intensity={20} tint="dark" style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={onClose}
          />
        </BlurView>
      </Animated.View>

      {/* Modal Content */}
      <View className="flex-1 justify-center px-4">
        <Animated.View
          style={[
            {
              backgroundColor: 'white',
              borderRadius: 28,
              overflow: 'hidden',
              maxHeight: SCREEN_HEIGHT * 0.85,
            },
            modalStyle,
          ]}
        >
          {/* Header with gradient */}
          <LinearGradient
            colors={['#FF6B35', '#FF8F5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-6 pt-6 pb-8"
          >
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity
                onPress={onClose}
                className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={20} color="white" />
                <Text className="text-white/90 font-medium ml-1">AI Powered</Text>
              </View>
            </View>

            <View className="items-center">
              <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
                <Ionicons name="link" size={32} color="white" />
              </View>
              <Text className="text-2xl font-bold text-white text-center">
                Import Any Recipe
              </Text>
              <Text className="text-white/80 text-center mt-1">
                Paste a link and we'll extract everything
              </Text>
            </View>
          </LinearGradient>

          <View className="px-6 py-6">
            {/* Supported platforms */}
            <View className="flex-row justify-around mb-6">
              {SUPPORTED_PLATFORMS.map((platform, index) => (
                <PlatformIcon
                  key={platform.id}
                  platform={platform}
                  animValue={platformAnimations[index]}
                  isActive={detectedPlatform === platform.id}
                />
              ))}
            </View>

            {/* URL Input */}
            <Animated.View style={inputStyle}>
              <Text className="text-sm font-semibold text-neutral-700 mb-2 ml-1">
                Recipe URL
              </Text>
              <View
                className={`flex-row items-center rounded-2xl overflow-hidden border-2 transition-colors ${
                  isFocused ? 'border-primary-500 bg-primary-50/50' : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                <View className="p-4">
                  {platformInfo ? (
                    <LinearGradient
                      colors={platformInfo.gradient as [string, string, ...string[]]}
                      className="w-8 h-8 rounded-lg items-center justify-center"
                    >
                      <Ionicons
                        name={platformInfo.icon as any}
                        size={18}
                        color="white"
                      />
                    </LinearGradient>
                  ) : (
                    <View className="w-8 h-8 rounded-lg bg-neutral-200 items-center justify-center">
                      <Ionicons name="link-outline" size={18} color="#9CA3AF" />
                    </View>
                  )}
                </View>
                <TextInput
                  className="flex-1 py-4 pr-2 text-base text-neutral-900"
                  placeholder="https://..."
                  placeholderTextColor="#9CA3AF"
                  value={url}
                  onChangeText={setUrl}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleImport}
                  editable={!isImporting}
                />
                <TouchableOpacity
                  onPress={handlePaste}
                  className="px-4 py-4"
                  disabled={isImporting}
                >
                  <View className="bg-primary-500 px-3 py-2 rounded-xl">
                    <Text className="text-white font-semibold text-sm">Paste</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Platform detected badge */}
            {platformInfo && url && !isImporting && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                className="flex-row items-center mt-3 ml-1"
              >
                <View className="w-5 h-5 rounded-full bg-green-500 items-center justify-center">
                  <Ionicons name="checkmark" size={14} color="white" />
                </View>
                <Text className="text-sm text-green-600 font-medium ml-2">
                  {platformInfo.name} recipe detected
                </Text>
              </Animated.View>
            )}

            {/* Error message */}
            {error && !isImporting && (
              <Animated.View
                entering={FadeIn.duration(200)}
                className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4"
              >
                <View className="flex-row items-start">
                  <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center">
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  </View>
                  <Text className="text-red-600 ml-3 flex-1 font-medium">{error}</Text>
                </View>
              </Animated.View>
            )}

            {/* Import progress */}
            {isImporting && (
              <Animated.View
                entering={FadeIn.duration(200)}
                className="mt-4"
              >
                <View className="bg-primary-50 rounded-2xl p-4 border border-primary-100">
                  <View className="flex-row items-center mb-3">
                    <Animated.View
                      style={{
                        width: 24,
                        height: 24,
                      }}
                    >
                      <Ionicons name="sparkles" size={24} color="#FF6B35" />
                    </Animated.View>
                    <Text className="text-primary-700 ml-2 font-semibold">
                      {importProgress || 'Analyzing recipe...'}
                    </Text>
                  </View>
                  <View className="h-2 bg-primary-100 rounded-full overflow-hidden">
                    <Animated.View
                      style={[
                        {
                          height: '100%',
                          backgroundColor: '#FF6B35',
                          borderRadius: 999,
                        },
                        progressStyle,
                      ]}
                    />
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Import button */}
            <View className="mt-6">
              <TouchableOpacity
                onPress={handleImport}
                disabled={!url.trim() || isImporting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={!url.trim() || isImporting ? ['#D1D5DB', '#9CA3AF'] : ['#FF6B35', '#FF8F5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="py-4 rounded-2xl items-center justify-center flex-row"
                  style={{
                    shadowColor: '#FF6B35',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: url.trim() && !isImporting ? 0.3 : 0,
                    shadowRadius: 8,
                  }}
                >
                  {isImporting ? (
                    <>
                      <Ionicons name="hourglass-outline" size={20} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">
                        Importing...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={20} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">
                        Import Recipe
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Help text */}
            <View className="flex-row items-center justify-center mt-4">
              <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
              <Text className="text-neutral-400 text-sm ml-1">
                Works with most recipe websites and videos
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default URLImportModal;
