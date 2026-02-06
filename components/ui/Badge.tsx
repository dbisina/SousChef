import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  icon,
  className,
}) => {
  const baseStyles = 'rounded-full flex-row items-center';

  const variantStyles = {
    default: 'bg-neutral-100/80',
    primary: 'bg-primary-50',
    secondary: 'bg-secondary-50',
    success: 'bg-emerald-50',
    warning: 'bg-amber-50',
    danger: 'bg-red-50',
    info: 'bg-sky-50',
    glass: 'bg-white/60',
  };

  const textVariantStyles = {
    default: 'text-neutral-600',
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-sky-600',
    glass: 'text-neutral-700',
  };

  const iconColors = {
    default: '#57534E',
    primary: '#EA580C',
    secondary: '#16A34A',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',
    glass: '#44403C',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1',
    md: 'px-3 py-1.5',
    lg: 'px-4 py-2',
  };

  const textSizeStyles = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <View
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className || ''}
      `}
      style={variant === 'glass' ? styles.glassBadge : undefined}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={iconSizes[size]}
          color={iconColors[variant]}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        className={`
          font-semibold
          ${textVariantStyles[variant]}
          ${textSizeStyles[size]}
        `}
      >
        {label}
      </Text>
    </View>
  );
};

// Difficulty badge with color coding and icons
interface DifficultyBadgeProps {
  difficulty: 'easy' | 'medium' | 'hard';
  size?: 'sm' | 'md' | 'lg';
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  difficulty,
  size = 'md',
}) => {
  const config = {
    easy: {
      variant: 'success' as const,
      label: 'Easy',
      icon: 'leaf-outline' as const,
    },
    medium: {
      variant: 'warning' as const,
      label: 'Medium',
      icon: 'flame-outline' as const,
    },
    hard: {
      variant: 'danger' as const,
      label: 'Hard',
      icon: 'flash-outline' as const,
    },
  };

  const { variant, label, icon } = config[difficulty];

  return <Badge label={label} variant={variant} size={size} icon={icon} />;
};

// Calorie badge with icon
interface CalorieBadgeProps {
  calories: number;
  size?: 'sm' | 'md' | 'lg';
}

export const CalorieBadge: React.FC<CalorieBadgeProps> = ({
  calories,
  size = 'md',
}) => {
  return (
    <Badge
      label={`${calories} cal`}
      variant="info"
      size={size}
      icon="flame-outline"
    />
  );
};

// Time badge with icon
interface TimeBadgeProps {
  minutes: number;
  size?: 'sm' | 'md' | 'lg';
}

export const TimeBadge: React.FC<TimeBadgeProps> = ({ minutes, size = 'md' }) => {
  const formatTime = (mins: number): string => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  return (
    <Badge
      label={formatTime(minutes)}
      variant="default"
      size={size}
      icon="time-outline"
    />
  );
};

// Serving badge
interface ServingBadgeProps {
  servings: number;
  size?: 'sm' | 'md' | 'lg';
}

export const ServingBadge: React.FC<ServingBadgeProps> = ({ servings, size = 'md' }) => {
  return (
    <Badge
      label={`${servings} servings`}
      variant="primary"
      size={size}
      icon="people-outline"
    />
  );
};

// Premium badge
export const PremiumBadge: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  return (
    <Badge
      label="Premium"
      variant="primary"
      size={size}
      icon="star"
    />
  );
};

const styles = StyleSheet.create({
  glassBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
