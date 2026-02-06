import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message,
  size = 'large',
  fullScreen = false,
}) => {
  const content = (
    <>
      <ActivityIndicator size={size} color="#FF6B35" />
      {message && (
        <Text className="mt-3 text-base text-neutral-600">{message}</Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        {content}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-8">
      {content}
    </View>
  );
};

// Skeleton loading component
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  className,
}) => {
  return (
    <View
      className={`bg-neutral-200 animate-pulse ${className || ''}`}
      style={{
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
        borderRadius,
      }}
    />
  );
};

// Recipe card skeleton
export const RecipeCardSkeleton: React.FC = () => {
  return (
    <View className="rounded-2xl bg-white overflow-hidden shadow-sm mb-4">
      <Skeleton height={160} borderRadius={0} />
      <View className="p-4">
        <Skeleton width="70%" height={20} className="mb-2" />
        <Skeleton width="90%" height={14} className="mb-2" />
        <Skeleton width="50%" height={14} />
        <View className="flex-row mt-3 space-x-2">
          <Skeleton width={60} height={24} borderRadius={12} />
          <Skeleton width={60} height={24} borderRadius={12} />
          <Skeleton width={80} height={24} borderRadius={12} />
        </View>
      </View>
    </View>
  );
};

// List loading component
interface ListLoadingProps {
  count?: number;
  ItemComponent?: React.FC;
}

export const ListLoading: React.FC<ListLoadingProps> = ({
  count = 3,
  ItemComponent = RecipeCardSkeleton,
}) => {
  return (
    <View className="px-4">
      {Array.from({ length: count }).map((_, index) => (
        <ItemComponent key={index} />
      ))}
    </View>
  );
};
