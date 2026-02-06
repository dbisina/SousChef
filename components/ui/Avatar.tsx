import React from 'react';
import { View, Text, Image } from 'react-native';
import { stringToColor, getInitials } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = '',
  imageUrl,
  size = 'md',
  className,
}) => {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  const backgroundColor = stringToColor(name);
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={`rounded-full ${sizeStyles[size]} ${className || ''}`}
      />
    );
  }

  return (
    <View
      className={`
        rounded-full items-center justify-center
        ${sizeStyles[size]}
        ${className || ''}
      `}
      style={{ backgroundColor }}
    >
      <Text className={`font-bold text-white ${textSizeStyles[size]}`}>
        {initials}
      </Text>
    </View>
  );
};

// Avatar group for showing multiple avatars
interface AvatarGroupProps {
  avatars: Array<{ name?: string; imageUrl?: string }>;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 3,
  size = 'md',
}) => {
  const visibleAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const overlapStyles = {
    sm: '-ml-2',
    md: '-ml-3',
    lg: '-ml-4',
  };

  return (
    <View className="flex-row items-center">
      {visibleAvatars.map((avatar, index) => (
        <View
          key={index}
          className={`border-2 border-white rounded-full ${index > 0 ? overlapStyles[size] : ''}`}
        >
          <Avatar name={avatar.name} imageUrl={avatar.imageUrl} size={size} />
        </View>
      ))}
      {remaining > 0 && (
        <View
          className={`
            items-center justify-center rounded-full bg-neutral-200 border-2 border-white
            ${overlapStyles[size]}
            ${size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : 'w-14 h-14'}
          `}
        >
          <Text className="text-xs font-medium text-neutral-600">+{remaining}</Text>
        </View>
      )}
    </View>
  );
};
