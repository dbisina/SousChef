import React, { useState, useEffect, useRef, memo } from 'react';
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
  ScrollView,
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
  withRepeat,
  cancelAnimation,
  interpolate,
  Extrapolation,
  SharedValue,
  FadeIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';
import { ThinkingPhase } from '@/lib/gemini';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useAuthStore } from '@/stores/authStore';
import { detectPlatform } from '@/services/recipeImportService';
import * as Clipboard from 'expo-clipboard';
import { useThemeColors } from '@/stores/themeStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface URLImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (recipeTitle: string, recipeId?: string) => void;
  initialURL?: string;
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
  { id: 'x', name: 'X', icon: 'logo-twitter', color: '#000000', gradient: ['#1DA1F2', '#0d8bd9'] },
  { id: 'website', name: 'Any URL', icon: 'globe-outline', color: '#6366F1', gradient: ['#6366F1', '#8B5CF6'] },
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
          className="w-12 h-12 rounded-full items-center justify-center mb-1"
          style={isActive ? { shadowColor: platform.color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 } : {}}
        >
          <Ionicons name={platform.icon as any} size={22} color="white" />
        </LinearGradient>
        <Text className={`text-xs ${isActive ? 'text-neutral-900 dark:text-neutral-50 font-medium' : 'text-neutral-500 dark:text-neutral-400'}`}>
          {platform.name}
        </Text>
      </View>
    </Animated.View>
  );
});

PlatformIcon.displayName = 'PlatformIcon';

// ── Thinking Notes Sub-Components ──

const PulsingDot = memo<{ color: string }>(({ color }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800 }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, []);

  const style = useAnimatedStyle(() => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
    opacity: opacity.value,
  }));

  return <Animated.View style={style} />;
});
PulsingDot.displayName = 'PulsingDot';

const ThinkingNoteRow = memo<{ note: string; index: number; accentColor: string }>(({ note, index, accentColor }) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(300).springify()}
      className="flex-row items-start mb-2"
    >
      <View
        style={{ backgroundColor: accentColor, width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: 8 }}
      />
      <Text className="text-sm text-neutral-700 dark:text-neutral-300 flex-1" style={{ lineHeight: 20 }}>
        {note}
      </Text>
    </Animated.View>
  );
});
ThinkingNoteRow.displayName = 'ThinkingNoteRow';

const TypingIndicator = memo<{ color: string }>(({ color }) => {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    dot1.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);
    dot2.value = withDelay(150, withRepeat(withTiming(1, { duration: 500 }), -1, true));
    dot3.value = withDelay(300, withRepeat(withTiming(1, { duration: 500 }), -1, true));

    return () => {
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
    };
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  const dotStyle = { width: 5, height: 5, borderRadius: 2.5, backgroundColor: color, marginHorizontal: 2 };

  return (
    <View className="flex-row items-center mt-1 ml-[14px]">
      <Animated.View style={[dotStyle, s1]} />
      <Animated.View style={[dotStyle, s2]} />
      <Animated.View style={[dotStyle, s3]} />
    </View>
  );
});
TypingIndicator.displayName = 'TypingIndicator';

const PHASE_CONFIG: Record<ThinkingPhase, { label: string; icon: string }> = {
  idle: { label: '', icon: '' },
  watching: { label: 'Watching video...', icon: 'eye-outline' },
  reading: { label: 'Reading recipe...', icon: 'document-text-outline' },
  building: { label: 'Building recipe...', icon: 'construct-outline' },
  done: { label: 'Done!', icon: 'checkmark-circle-outline' },
};

/**
 * ThinkingNotesView subscribes to the store DIRECTLY for `thinkingNotes`
 * so that note-streaming updates only re-render this sub-tree, not the
 * entire URLImportModal (which contains many useAnimatedStyle hooks).
 */
const ThinkingNotesView: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const notes = useWantToCookStore((s) => s.thinkingNotes);
  const phase = useWantToCookStore((s) => s.thinkingPhase);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new notes arrive
    if (notes.length > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(t);
    }
  }, [notes.length]);

  const phaseInfo = PHASE_CONFIG[phase];

  return (
    <Animated.View entering={FadeIn.duration(300)} className="mt-4">
      <View
        className="rounded-2xl overflow-hidden border"
        style={{ backgroundColor: accentColor + '10', borderColor: accentColor + '30' }}
      >
        {/* Phase header */}
        <View className="flex-row items-center px-4 pt-3 pb-2">
          {phaseInfo.icon ? (
            <Ionicons name={phaseInfo.icon as any} size={18} color={accentColor} />
          ) : null}
          <Text className="ml-2 font-semibold text-sm" style={{ color: accentColor }}>
            {phaseInfo.label}
          </Text>
          {(phase === 'watching' || phase === 'reading') && (
            <View className="ml-auto">
              <PulsingDot color={accentColor} />
            </View>
          )}
          {phase === 'done' && (
            <Ionicons name="checkmark" size={16} color="#22C55E" style={{ marginLeft: 'auto' }} />
          )}
        </View>

        {/* Notes list */}
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: 160 }}
          className="px-4 pb-3"
          showsVerticalScrollIndicator={false}
        >
          {notes.map((note, i) => (
            <ThinkingNoteRow key={i} note={note} index={i} accentColor={accentColor} />
          ))}
          {(phase === 'watching' || phase === 'reading') && <TypingIndicator color={accentColor} />}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

export const URLImportModal: React.FC<URLImportModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialURL,
}) => {
  const [url, setUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const importFromURL = useWantToCookStore((s) => s.importFromURL);
  const isImporting = useWantToCookStore((s) => s.isImporting);
  const importProgress = useWantToCookStore((s) => s.importProgress);
  const error = useWantToCookStore((s) => s.error);
  const setError = useWantToCookStore((s) => s.setError);
  const thinkingPhase = useWantToCookStore((s) => s.thinkingPhase);

  // Pre-fill URL from share intent
  useEffect(() => {
    if (initialURL && visible) {
      setUrl(initialURL);
    }
  }, [initialURL, visible]);

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
        cancelAnimation(anim);
        anim.value = withTiming(0, { duration: 0 });
      });
    }
  }, [visible]);

  useEffect(() => {
    if (isImporting) {
      // Animate progress bar
      progressWidth.value = withTiming(30, { duration: 500 });
      const t1 = setTimeout(() => {
        progressWidth.value = withTiming(60, { duration: 1000 });
      }, 500);
      const t2 = setTimeout(() => {
        progressWidth.value = withTiming(85, { duration: 1500 });
      }, 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      cancelAnimation(progressWidth);
      progressWidth.value = withTiming(0, { duration: 0 });
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
      onSuccess?.(title, result.id);
    } else if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const detectedPlatform = url ? detectPlatform(url) : null;
  const platformInfo = SUPPORTED_PLATFORMS.find((p) => p.id === detectedPlatform);

  // Friendly label for detected source types not in the main platform icons
  const SOURCE_LABELS: Record<string, string> = {
    facebook: 'Facebook', pinterest: 'Pinterest', threads: 'Threads',
    reddit: 'Reddit', snapchat: 'Snapchat', pdf: 'PDF document',
    json: 'JSON data', xml: 'XML/RSS feed', text: 'Text file',
    image: 'Image', video: 'Video file', audio: 'Audio file',
    allrecipes: 'AllRecipes', foodnetwork: 'Food Network', bonappetit: 'Bon Appétit',
    seriouseats: 'Serious Eats', tasty: 'Tasty', delish: 'Delish',
    epicurious: 'Epicurious', nyt_cooking: 'NYT Cooking', bbc_food: 'BBC Food',
    simplyrecipes: 'Simply Recipes', food52: 'Food52', cookpad: 'Cookpad',
    yummly: 'Yummly', budgetbytes: 'Budget Bytes',
  };
  const detectedLabel = platformInfo?.name || (detectedPlatform ? SOURCE_LABELS[detectedPlatform] : null);

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
            colors={[colors.accent, colors.accent + 'CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-6 pt-8 pb-10"
          >
            <View className="flex-row items-center justify-between m-[20px]">
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

            <View className="items-center mb-[10px]">
              <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
                <Ionicons name="link" size={32} color="white" />
              </View>
              <Text className="text-2xl font-bold text-white text-center -mt-1">
                Import Any Recipe
              </Text>
              <Text className="text-white/80 text-center mt-1 mb-2">
                Links, videos, images, PDFs, JSON, text — we handle it all
              </Text>
            </View>
          </LinearGradient>

          <View className="px-6 py-6">
            {/* Supported platforms */}
            <View className="flex-row justify-between mb-3 p-[5px]">
              {SUPPORTED_PLATFORMS.map((platform, index) => (
                <PlatformIcon
                  key={platform.id}
                  platform={platform}
                  animValue={platformAnimations[index]}
                  isActive={detectedPlatform === platform.id}
                />
              ))}
            </View>
            <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center mb-5">
              +  more
            </Text>

            {/* URL Input */}
            <Animated.View style={inputStyle}>
              <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 ml-1">
                Recipe URL
              </Text>
              <View
                className={`flex-row items-center rounded-2xl overflow-hidden border-2 transition-colors ${
                  isFocused ? 'border-neutral-200 dark:border-neutral-600' : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'
                }`}
                style={isFocused ? { borderColor: colors.accent, backgroundColor: colors.accent + '10' } : {}}
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
                    <View className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 items-center justify-center">
                      <Ionicons name="link-outline" size={18} color="#9CA3AF" />
                    </View>
                  )}
                </View>
                <TextInput
                  className="flex-1 py-4 pr-2 text-base text-neutral-900 dark:text-neutral-50"
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
                  <View style={{ backgroundColor: colors.accent }} className="px-3 py-2 rounded-xl">
                    <Text className="text-white font-semibold text-sm">Paste</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Platform detected badge */}
            {detectedLabel && url && !isImporting && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                className="flex-row items-center mt-3 ml-1"
              >
                <View className="w-5 h-5 rounded-full bg-green-500 items-center justify-center">
                  <Ionicons name="checkmark" size={14} color="white" />
                </View>
                <Text className="text-sm text-green-600 font-medium ml-2">
                  {detectedLabel} recipe detected
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

            {/* Import progress -- thinking notes or simple progress bar */}
            {isImporting && thinkingPhase !== 'idle' ? (
              <ThinkingNotesView accentColor={colors.accent} />
            ) : isImporting ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                className="mt-4"
              >
                <View className="rounded-2xl p-4 border" style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }}>
                  <View className="flex-row items-center mb-3">
                    <Animated.View
                      style={{
                        width: 24,
                        height: 24,
                      }}
                    >
                      <Ionicons name="sparkles" size={24} color={colors.accent} />
                    </Animated.View>
                    <Text className="ml-2 font-semibold" style={{ color: colors.accent }}>
                      {importProgress || 'Analyzing recipe...'}
                    </Text>
                  </View>
                  <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.accent + '20' }}>
                    <Animated.View
                      style={[
                        {
                          height: '100%',
                          backgroundColor: colors.accent,
                          borderRadius: 999,
                        },
                        progressStyle,
                      ]}
                    />
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {/* Import button */}
            <View className="mt-6 rounded-2xl overflow-hidden">
              <TouchableOpacity
                onPress={handleImport}
                disabled={!url.trim() || isImporting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={!url.trim() || isImporting ? ['#D1D5DB', '#9CA3AF'] : [colors.accent, colors.accent + 'CC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="py-4 rounded-full w-full"
                  style={{
                    shadowColor: colors.accent,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: url.trim() && !isImporting ? 0.3 : 0,
                    shadowRadius: 8,
                  }}
                >
                  {isImporting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, }}>
                      <Ionicons name="hourglass-outline" size={24} color="white" />
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginLeft: 8 }}>
                        Importing...
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12,}}>
                      <Ionicons name="download-outline" size={24} color="white" />
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginLeft: 12 }}>
                        Import Recipe
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Help text */}
            <View className="flex-row items-center justify-center mt-4">
              <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
              <Text className="text-neutral-400 dark:text-neutral-500 text-sm ml-1">
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
