import React from 'react';
import { View, TouchableOpacity, ViewProps, TouchableOpacityProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

interface CardProps extends ViewProps {
  variant?: 'default' | 'glass' | 'elevated' | 'outlined' | 'soft';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  intensity?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'glass',
  padding = 'md',
  intensity = 60,
  className,
  style,
  ...props
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantBaseStyles = {
    default: 'bg-white rounded-3xl',
    glass: 'rounded-3xl overflow-hidden',
    elevated: 'bg-white rounded-3xl shadow-glass',
    outlined: 'bg-white/80 rounded-3xl border border-neutral-200/50',
    soft: 'bg-primary-50/80 rounded-3xl',
  };

  if (variant === 'glass') {
    return (
      <View
        className={`rounded-3xl overflow-hidden ${className || ''}`}
        style={style}
        {...props}
      >
        <BlurView
          intensity={intensity}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View
          className={`bg-white/70 ${paddingStyles[padding]}`}
          style={styles.glassInner}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      className={`
        ${variantBaseStyles[variant]}
        ${paddingStyles[padding]}
        ${className || ''}
      `}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};

interface PressableCardProps extends TouchableOpacityProps {
  variant?: 'default' | 'glass' | 'elevated' | 'outlined' | 'soft';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  intensity?: number;
}

export const PressableCard: React.FC<PressableCardProps> = ({
  children,
  variant = 'glass',
  padding = 'md',
  intensity = 60,
  className,
  style,
  ...props
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantBaseStyles = {
    default: 'bg-white rounded-3xl',
    glass: 'rounded-3xl overflow-hidden',
    elevated: 'bg-white rounded-3xl shadow-glass',
    outlined: 'bg-white/80 rounded-3xl border border-neutral-200/50',
    soft: 'bg-primary-50/80 rounded-3xl',
  };

  if (variant === 'glass') {
    return (
      <TouchableOpacity
        className={`rounded-3xl overflow-hidden ${className || ''}`}
        style={style}
        activeOpacity={0.8}
        {...props}
      >
        <BlurView
          intensity={intensity}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View
          className={`bg-white/70 ${paddingStyles[padding]}`}
          style={styles.glassInner}
        >
          {children}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      className={`
        ${variantBaseStyles[variant]}
        ${paddingStyles[padding]}
        ${className || ''}
      `}
      style={style}
      activeOpacity={0.8}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

// Glass card with gradient border effect
export const GlassCard: React.FC<CardProps> = ({
  children,
  padding = 'md',
  intensity = 50,
  className,
  style,
  ...props
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <View
      className={`rounded-3xl overflow-hidden ${className || ''}`}
      style={[styles.glassOuter, style]}
      {...props}
    >
      <BlurView
        intensity={intensity}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      <View
        className={`bg-white/60 ${paddingStyles[padding]}`}
        style={styles.glassContent}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  glassInner: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  glassOuter: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  glassContent: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
});
