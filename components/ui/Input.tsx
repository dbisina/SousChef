import React, { forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerClassName?: string;
  variant?: 'default' | 'glass';
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerClassName,
      className,
      variant = 'default',
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    if (variant === 'glass') {
      return (
        <View className={`mb-4 ${containerClassName || ''}`}>
          {label && (
            <Text className="mb-2 text-sm font-medium text-neutral-700 tracking-wide">
              {label}
            </Text>
          )}

          <View
            className="rounded-2xl overflow-hidden"
            style={styles.glassContainer}
          >
            <BlurView
              intensity={50}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <View
              className={`
                flex-row items-center px-4 bg-white/60
                ${hasError ? 'border-2 border-red-400' : 'border border-white/40'}
              `}
              style={styles.glassInner}
            >
              {leftIcon && (
                <Ionicons
                  name={leftIcon}
                  size={20}
                  color={hasError ? '#F87171' : '#78716C'}
                  style={{ marginRight: 12 }}
                />
              )}

              <TextInput
                ref={ref}
                className={`flex-1 py-4 text-base text-neutral-800 ${className || ''}`}
                placeholderTextColor="#A8A29E"
                {...props}
              />

              {rightIcon && (
                <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress}>
                  <Ionicons
                    name={rightIcon}
                    size={20}
                    color={hasError ? '#F87171' : '#78716C'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {error && (
            <Text className="mt-2 text-sm text-red-500 font-medium">{error}</Text>
          )}

          {hint && !error && (
            <Text className="mt-2 text-sm text-neutral-500">{hint}</Text>
          )}
        </View>
      );
    }

    return (
      <View className={`mb-4 ${containerClassName || ''}`}>
        {label && (
          <Text className="mb-2 text-sm font-medium text-neutral-700 tracking-wide">
            {label}
          </Text>
        )}

        <View
          className={`
            flex-row items-center rounded-2xl bg-white px-4
            ${hasError ? 'border-2 border-red-400' : 'border border-neutral-200'}
          `}
          style={styles.inputContainer}
        >
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={hasError ? '#F87171' : '#78716C'}
              style={{ marginRight: 12 }}
            />
          )}

          <TextInput
            ref={ref}
            className={`flex-1 py-4 text-base text-neutral-800 ${className || ''}`}
            placeholderTextColor="#A8A29E"
            {...props}
          />

          {rightIcon && (
            <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress}>
              <Ionicons
                name={rightIcon}
                size={20}
                color={hasError ? '#F87171' : '#78716C'}
              />
            </TouchableOpacity>
          )}
        </View>

        {error && (
          <Text className="mt-2 text-sm text-red-500 font-medium">{error}</Text>
        )}

        {hint && !error && (
          <Text className="mt-2 text-sm text-neutral-500">{hint}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

// Search input with glass effect
interface SearchInputProps extends TextInputProps {
  onClear?: () => void;
}

export const SearchInput = forwardRef<TextInput, SearchInputProps>(
  ({ onClear, value, className, ...props }, ref) => {
    return (
      <View
        className="flex-row items-center rounded-2xl overflow-hidden"
        style={styles.searchContainer}
      >
        <BlurView
          intensity={40}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View className="flex-row items-center flex-1 px-4 py-3 bg-white/70" style={styles.searchInner}>
          <Ionicons name="search-outline" size={20} color="#78716C" />
          <TextInput
            ref={ref}
            className={`flex-1 mx-3 text-base text-neutral-800 ${className || ''}`}
            placeholderTextColor="#A8A29E"
            value={value}
            {...props}
          />
          {value && value.length > 0 && onClear && (
            <TouchableOpacity onPress={onClear}>
              <Ionicons name="close-circle" size={20} color="#A8A29E" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
  inputContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  glassContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  glassInner: {
    borderRadius: 16,
  },
  searchContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  searchInner: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
  },
});
