import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ViewToken,
  ViewStyle,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/stores/authStore';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_KEY = '@souschef_onboarding_complete';

// Check if onboarding has been completed (used by useAuth for routing)
export const isOnboardingComplete = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false;
  }
};

interface OnboardingSlide {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  image: string;
  gradient: [string, string, string]; // Top, Middle, Bottom
  accentColor: string;
  features: { icon: keyof typeof Ionicons.glyphMap; text: string; detail: string }[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    step: 'Step 1 of 3',
    title: 'Import Recipes\nFrom Anywhere',
    subtitle: 'Extract Instantly',
    description:
      'Found a recipe on TikTok, Instagram, or YouTube? Just share the link. Our AI extracts ingredients and steps in seconds.',
    icon: 'cloud-download-outline',
    iconColor: '#FFFFFF',
    iconBg: '#FF6B35',
    image: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80',
    gradient: ['#FF6B35', '#FF8F5A', '#FF9F7A'],
    accentColor: '#FF6B35',
    features: [
      { icon: 'logo-tiktok', text: 'TikTok & Instagram', detail: 'Works with short video formats' },
      { icon: 'logo-youtube', text: 'YouTube', detail: 'Extracts from long cooking videos' },
      { icon: 'camera', text: 'Cookbook Scan', detail: 'Digitize your physical books' },
    ],
  },
  {
    id: '2',
    step: 'Step 2 of 3',
    title: 'Smart Pantry\n& Shopping',
    subtitle: 'Shop Smarter',
    description:
      'Automatically match recipes to what you have at home. We build your shopping list so you never buy duplicates.',
    icon: 'basket-outline',
    iconColor: '#FFFFFF',
    iconBg: '#10B981',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80',
    gradient: ['#059669', '#10B981', '#34D399'],
    accentColor: '#10B981',
    features: [
      { icon: 'list', text: 'Auto Shopping List', detail: 'Grouped by aisle for speed' },
      { icon: 'checkmark-circle', text: 'Pantry Match', detail: 'Use what you already have' },
      { icon: 'alert-circle', text: 'Expiry Alerts', detail: 'Reduce food waste' },
    ],
  },
  {
    id: '3',
    step: 'Step 3 of 3',
    title: 'Cook Hands-Free\nWith AI Voice',
    subtitle: 'Chef Assistant',
    description:
      'Follow step-by-step instructions without touching your phone. Just speak to control the flow and set timers.',
    icon: 'mic-outline',
    iconColor: '#FFFFFF',
    iconBg: '#3B82F6',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=800&q=80',
    gradient: ['#2563EB', '#3B82F6', '#60A5FA'],
    accentColor: '#3B82F6',
    features: [
      { icon: 'mic', text: 'Voice Control', detail: '"Hey SousChef, next step"' },
      { icon: 'timer', text: 'Smart Timers', detail: 'Auto-set from recipe steps' },
      { icon: 'options', text: 'Substitutions', detail: 'AI suggests ingredient swaps' },
    ],
  },
];

const GraphicHero = ({ item, index }: { item: OnboardingSlide; index: number }) => {
  // Shared values for animations
  const blob1Pos = useSharedValue({ x: 0, y: 0 });
  const blob2Pos = useSharedValue({ x: 0, y: 0 });
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  React.useEffect(() => {
    // Gentle floating animation for background blobs
    blob1Pos.value = withRepeat(
      withSequence(
        withTiming({ x: 20, y: -20 }, { duration: 3000 }),
        withTiming({ x: -10, y: 10 }, { duration: 4000 }),
        withTiming({ x: 0, y: 0 }, { duration: 3000 })
      ),
      -1,
      true
    );

    blob2Pos.value = withRepeat(
      withSequence(
        withTiming({ x: -20, y: 20 }, { duration: 4000 }),
        withTiming({ x: 10, y: -10 }, { duration: 3000 }),
        withTiming({ x: 0, y: 0 }, { duration: 4000 })
      ),
      -1,
      true
    );

    // Subtle breathing/pulse for main element
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2500 }),
        withTiming(1, { duration: 2500 })
      ),
      -1,
      true
    );
    
    // Slow rotation for background elements
    rotate.value = withRepeat(
        withTiming(360, { duration: 20000 }),
        -1,
        false
    );
  }, []);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob1Pos.value.x },
      { translateY: blob1Pos.value.y }
    ],
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob2Pos.value.x },
      { translateY: blob2Pos.value.y }
    ],
  }));

  const mainIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotate.value}deg`}]
  }));

  return (
    <View className="flex-1 relative overflow-hidden items-center justify-center bg-white">
      {/* Dynamic Background Gradient Base */}
      <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[item.gradient[0] + '20', '#FFFFFF']} // Very light tint of main color
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
      </View>

      {/* Animated Blobs */}
      <Animated.View style={[blob1Style, { position: 'absolute', top: '10%', left: '-10%' }]}>
        <View style={{ width: 250, height: 250, borderRadius: 125, backgroundColor: item.gradient[0], opacity: 0.15, filter: 'blur(40px)' }} />
      </Animated.View>
      <Animated.View style={[blob2Style, { position: 'absolute', bottom: '20%', right: '-10%' }]}>
        <View style={{ width: 300, height: 300, borderRadius: 150, backgroundColor: item.gradient[2], opacity: 0.15, filter: 'blur(50px)' }} />
      </Animated.View>

      {/* Rotating Ring Pattern */}
      <Animated.View style={[rotateStyle, { position: 'absolute', opacity: 0.05 }]}>
         <View style={{ width: 400, height: 400, borderRadius: 200, borderWidth: 40, borderColor: item.gradient[1], borderStyle: 'dashed' }} />
      </Animated.View>

      {/* Glassmorphic Card Container */}
      <Animated.View style={mainIconStyle} className="items-center justify-center z-10">
        <View 
            style={{ 
                shadowColor: item.accentColor, 
                shadowOffset: { width: 0, height: 20 }, 
                shadowOpacity: 0.25, 
                shadowRadius: 30,
                elevation: 10 
            }}
        >
            <View className="rounded-[32px] overflow-hidden border-4 border-white bg-white">
                 <Image 
                    source={{ uri: item.image }} 
                    className="w-72 h-80"
                    resizeMode="cover"
                 />
                 <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.1)']}
                    style={StyleSheet.absoluteFill}
                 />

                 {/* Floating Badges */}
                 {index === 0 && (
                    <>
                        <BlurView intensity={80} tint="light" className="absolute top-4 right-4 rounded-xl overflow-hidden">
                             <View className="bg-white/60 p-2.5">
                                 <Ionicons name="cloud-download" size={20} color={item.accentColor} />
                             </View>
                        </BlurView>
                        <BlurView intensity={80} tint="light" className="absolute bottom-4 left-4 rounded-xl overflow-hidden">
                             <View className="bg-white/60 p-2.5">
                                 <Ionicons name="link" size={20} color={item.accentColor} />
                             </View>
                        </BlurView>
                    </>
                 )}
                 {index === 1 && (
                    <>
                        <BlurView intensity={80} tint="light" className="absolute top-4 left-4 rounded-xl overflow-hidden">
                             <View className="bg-white/60 p-2.5">
                                 <Ionicons name="cart" size={20} color={item.accentColor} />
                             </View>
                        </BlurView>
                        <BlurView intensity={80} tint="light" className="absolute bottom-4 right-4 rounded-xl overflow-hidden">
                             <View className="bg-white/60 p-2.5">
                                 <Ionicons name="nutrition" size={20} color={item.accentColor} />
                             </View>
                        </BlurView>
                    </>
                 )}
                 {index === 2 && (
                    <>
                         <BlurView intensity={80} tint="light" className="absolute top-4 right-4 rounded-xl overflow-hidden">
                             <View className="bg-white/60 p-2.5">
                                 <Ionicons name="volume-high" size={20} color={item.accentColor} />
                             </View>
                        </BlurView>
                        <BlurView intensity={80} tint="light" className="absolute bottom-4 left-4 rounded-xl overflow-hidden">
                             <View className="bg-white/60 p-2.5">
                                 <Ionicons name="mic" size={20} color={item.accentColor} />
                             </View>
                        </BlurView>
                    </>
                 )}
            </View>
        </View>
      </Animated.View>
    </View>
  );
};

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      // silently continue
    }
    router.replace('/auth/login');
  };

  const completeOnboardingAsGuest = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      // silently continue
    }
    useAuthStore.getState().continueAsGuest();
    router.replace('/(tabs)');
  };

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboardingAsGuest();
    }
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} className="bg-white">
      {/* Top 45% - Graphic Hero Section */}
      <View style={{ height: SCREEN_HEIGHT * 0.45 }}>
        <GraphicHero item={item} index={index} />
        
        {/* Skip Button (Absolute Top Right) */}
        <SafeAreaView className="absolute top-0 right-0 left-0" edges={['top']}>
          <View className="flex-row justify-between items-center px-6 pt-2">
             {/* Step Indicator Pits */}
            <View className="flex-row space-x-1.5 bg-black/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                {SLIDES.map((_, i) => (
                    <View 
                        key={i} 
                        className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white scale-125' : 'bg-white/50'}`} 
                    />
                ))}
            </View>

            <TouchableOpacity
              onPress={completeOnboarding}
              className="bg-black/10 px-4 py-2 rounded-full backdrop-blur-md"
            >
              <Text className="text-white font-semibold text-xs uppercase tracking-wider">Skip</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Bottom 55% - Content Section */}
      <View style={{ height: SCREEN_HEIGHT * 0.55 }} className="bg-white px-8 pt-8 rounded-t-[40px] -mt-10">
        <Animated.View 
            entering={FadeInUp.duration(600).delay(200)}
            className="flex-1"
        >
            {/* Typography */}
            <View className="mb-6">
                <Text className="text-primary-500 font-bold text-xs tracking-[4px] uppercase mb-3">
                    {item.subtitle}
                </Text>
                <Text className="text-3xl font-extrabold text-neutral-900 leading-tight mb-4">
                    {item.title}
                </Text>
                <Text className="text-base text-neutral-500 leading-relaxed">
                    {item.description}
                </Text>
            </View>

            {/* Features List */}
            <View className="space-y-4">
                {item.features.map((feature, i) => (
                    <Animated.View 
                        key={i}
                        entering={FadeInDown.delay(400 + (i * 100)).duration(500)}
                        className="flex-row items-center"
                    >
                        <View className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center mr-4">
                            <Ionicons name={feature.icon} size={20} color={item.accentColor} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-neutral-900 font-bold text-sm">{feature.text}</Text>
                            <Text className="text-neutral-400 text-xs">{feature.detail}</Text>
                        </View>
                    </Animated.View>
                ))}
            </View>
        </Animated.View>

        {/* Bottom Action Area */}
        <SafeAreaView edges={['bottom']} className="pb-6">
            <TouchableOpacity
                onPress={goNext}
                activeOpacity={0.9}
                style={styles.ctaButton}
                className="rounded-2xl overflow-hidden"
            >
                <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="flex-row items-center justify-center py-4 rounded-2xl"
                ><View className="p-4 flex-row items-center justify-center">
                    <Text className="text-white font-bold text-lg mr-2">
                        {index === SLIDES.length - 1 ? "Get Started" : "Continue"}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="white" />
                    </View>
                </LinearGradient>
            </TouchableOpacity>


        </SafeAreaView>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false} // Prevent bouncing to keep hero static feel
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ctaButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
});
