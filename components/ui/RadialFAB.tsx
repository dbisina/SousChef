import React, { useState, memo } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';

export interface FABAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  gradient: [string, string];
  onPress: () => void;
}

interface RadialFABProps {
  actions: FABAction[];
}

// Separate component for action button to properly use hooks
const ActionButton = memo<{
  action: FABAction;
  index: number;
  totalActions: number;
  isOpen: SharedValue<number>;
  onPress: () => void;
}>(({ action, index, totalActions, isOpen, onPress }) => {
  // Arc from left → top → right (fan opening upward)
  // Angle goes from 180° (left) to 0° (right), with top at 90°
  const startAngle = Math.PI; // 180° - left side
  const endAngle = 0; // 0° - right side
  const angleStep = (startAngle - endAngle) / (totalActions - 1);
  const angle = startAngle - angleStep * index;
  const radius = 120; // Distance from center
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius; // Negative to go upward

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(isOpen.value, [0, 1], [0, x]) },
      { translateY: interpolate(isOpen.value, [0, 1], [0, -y]) },
      { scale: isOpen.value },
    ],
    opacity: isOpen.value,
  }));

  return (
    <Animated.View
      style={[
        styles.actionButtonContainer,
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.actionButton}
      >
        <LinearGradient
          colors={action.gradient}
          style={styles.actionGradient}
        >
          <Ionicons name={action.icon as any} size={24} color="white" />
        </LinearGradient>
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{action.label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

ActionButton.displayName = 'ActionButton';

export const RadialFAB: React.FC<RadialFABProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openValue = useSharedValue(0);
  const rotation = useSharedValue(0);

  const handleToggle = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (isOpen) {
      openValue.value = withTiming(0, { duration: 250 });
      rotation.value = withTiming(0, { duration: 250 });
    } else {
      openValue.value = withTiming(1, { duration: 300 });
      rotation.value = withTiming(45, { duration: 300 });
    }
    setIsOpen(!isOpen);
  };

  const handleActionPress = (action: FABAction) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Close menu first
    openValue.value = withTiming(0, { duration: 200 });
    rotation.value = withTiming(0, { duration: 200 });
    setIsOpen(false);

    // Then trigger action
    setTimeout(() => {
      action.onPress();
    }, 100);
  };

  const fabRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: openValue.value * 0.5,
    pointerEvents: openValue.value > 0 ? 'auto' : 'none',
  }));

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, backdropStyle]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleToggle} />
      </Animated.View>

      {/* Action buttons container */}
      <View style={styles.actionsContainer} pointerEvents="box-none">
        {actions.map((action, index) => (
          <ActionButton
            key={action.id}
            action={action}
            index={index}
            totalActions={actions.length}
            isOpen={openValue}
            onPress={() => handleActionPress(action)}
          />
        ))}
      </View>

      {/* Main FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.9}>
          <View style={styles.fabOuterRing}>
            <Animated.View style={[styles.fab, fabRotationStyle]}>
              <Ionicons name="add" size={32} color="white" />
            </Animated.View>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    zIndex: 998,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 148,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  actionButtonContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  labelContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 88 : 76,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  fabOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
});

export default RadialFAB;
