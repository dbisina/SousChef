import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  style,
  ...props
}) => {
  const baseStyles = 'flex-row items-center justify-center';

  const variantStyles = {
    primary: 'bg-primary-500 rounded-2xl',
    secondary: 'bg-secondary-500 rounded-2xl',
    outline: 'border-2 border-primary-500 bg-transparent rounded-2xl',
    ghost: 'bg-transparent rounded-2xl',
    danger: 'bg-red-500 rounded-2xl',
    glass: 'rounded-2xl overflow-hidden',
  };

  const activeVariantStyles = {
    primary: 'active:bg-primary-600',
    secondary: 'active:bg-secondary-600',
    outline: 'active:bg-primary-50',
    ghost: 'active:bg-neutral-100',
    danger: 'active:bg-red-600',
    glass: '',
  };

  const disabledStyles = {
    primary: 'bg-neutral-200',
    secondary: 'bg-neutral-200',
    outline: 'border-neutral-300 bg-transparent',
    ghost: 'bg-transparent',
    danger: 'bg-neutral-200',
    glass: 'opacity-50',
  };

  const textVariantStyles = {
    primary: 'text-white',
    secondary: 'text-white',
    outline: 'text-primary-500',
    ghost: 'text-primary-500',
    danger: 'text-white',
    glass: 'text-neutral-800',
  };

  const disabledTextStyles = 'text-neutral-400';

  const sizeStyles = {
    sm: 'px-4 py-2.5',
    md: 'px-6 py-3.5',
    lg: 'px-8 py-4',
  };

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const isDisabled = disabled || isLoading;

  // Glass variant with blur effect
  if (variant === 'glass') {
    return (
      <TouchableOpacity
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${isDisabled ? disabledStyles[variant] : ''}
          ${fullWidth ? 'w-full' : ''}
          ${className || ''}
        `}
        style={[styles.glassButton, style]}
        disabled={isDisabled}
        activeOpacity={0.85}
        {...props}
      >
        <BlurView
          intensity={40}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View className={`flex-row items-center justify-center bg-white/50 ${sizeStyles[size]}`} style={styles.glassInner}>
          {isLoading ? (
            <ActivityIndicator color="#292524" size="small" />
          ) : (
            <View className="flex-row items-center">
              {leftIcon && <View className="mr-2">{leftIcon}</View>}
              <Text
                className={`
                  font-semibold tracking-wide
                  ${textSizeStyles[size]}
                  ${isDisabled ? disabledTextStyles : textVariantStyles[variant]}
                `}
              >
                {title}
              </Text>
              {rightIcon && <View className="ml-2">{rightIcon}</View>}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      className={`
        ${baseStyles}
        ${isDisabled ? disabledStyles[variant] : variantStyles[variant]}
        ${!isDisabled ? activeVariantStyles[variant] : ''}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className || ''}
      `}
      style={[styles.button, style]}
      disabled={isDisabled}
      activeOpacity={0.85}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? '#F97316' : '#FFFFFF'}
          size="small"
        />
      ) : (
        <View className="flex-row items-center">
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Text
            className={`
              font-semibold tracking-wide
              ${textSizeStyles[size]}
              ${isDisabled ? disabledTextStyles : textVariantStyles[variant]}
            `}
          >
            {title}
          </Text>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Icon-only button variant
interface IconButtonProps extends TouchableOpacityProps {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  style,
  ...props
}) => {
  const sizeStyles = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  };

  const variantStyles = {
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    ghost: 'bg-neutral-100',
    glass: 'bg-white/60',
  };

  return (
    <TouchableOpacity
      className={`
        items-center justify-center rounded-xl
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className || ''}
      `}
      style={[styles.iconButton, style]}
      activeOpacity={0.8}
      {...props}
    >
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  glassButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  glassInner: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
  },
  iconButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
