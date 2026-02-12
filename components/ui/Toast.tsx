import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useToastStore, ToastType } from '@/stores/toastStore';
import { useThemeColors } from '@/stores/themeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TYPE_CONFIG: Record<ToastType, { icon: string; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' },
  error: { icon: 'alert-circle', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
  info: { icon: 'information-circle', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
  warning: { icon: 'warning', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
};

export const Toast: React.FC = memo(() => {
  const { visible, message, type, title, hideToast } = useToastStore();
  const colors = useThemeColors();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(Platform.OS === 'ios' ? 60 : 40, {
        damping: 15,
        stiffness: 120,
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(-100, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && opacity.value === 0) return null;

  const config = TYPE_CONFIG[type];

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      pointerEvents="none"
    >
      <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={colors.isDark ? 'dark' : 'light'} style={styles.blurContainer}>
        <View style={[styles.innerContainer, { borderColor: config.color + '40' }]}>
          <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={24} color={config.color} />
          </View>
          <View style={styles.content}>
            {title && (
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            )}
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 500,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});

export default Toast;
