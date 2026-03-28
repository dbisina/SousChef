import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useThemeColors } from '@/stores/themeStore';
import { RecipeComment } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface RecipeCommentsProps {
  recipeId: string;
}

export const RecipeComments: React.FC<RecipeCommentsProps> = ({ recipeId }) => {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const { addComment, fetchComments } = useRecipeStore();

  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadComments();
  }, [recipeId]);

  const loadComments = async () => {
    setIsLoading(true);
    const result = await fetchComments(recipeId);
    setComments(result);
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!newComment.trim() || !user || isSending) return;
    setIsSending(true);
    try {
      await addComment(recipeId, {
        recipeId,
        authorId: user.id,
        authorName: user.displayName,
        authorPhotoURL: user.photoURL,
        text: newComment.trim(),
      });
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderComment = ({ item }: { item: RecipeComment }) => (
    <View className="flex-row px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
      <TouchableOpacity onPress={() => router.push(`/user/${item.authorId}` as any)}>
        {item.authorPhotoURL ? (
          <Image source={{ uri: item.authorPhotoURL }} className="w-9 h-9 rounded-full" />
        ) : (
          <View
            className="w-9 h-9 rounded-full items-center justify-center bg-neutral-200 dark:bg-neutral-700"
          >
            <Text className="text-sm font-bold text-neutral-500">
              {item.authorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.push(`/user/${item.authorId}` as any)}>
            <Text className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
              {item.authorName}
            </Text>
          </TouchableOpacity>
          <Text className="text-xs text-neutral-400 ml-2">
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
        <Text className="text-neutral-700 dark:text-neutral-300 text-sm mt-1">
          {item.text}
        </Text>
        {item.rating && (
          <View className="flex-row mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= item.rating! ? 'star' : 'star-outline'}
                size={12}
                color="#F59E0B"
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View className="mt-4">
      <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 px-4 mb-3">
        Comments ({comments.length})
      </Text>

      {comments.length > 0 ? (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          scrollEnabled={false}
        />
      ) : (
        <View className="items-center py-6">
          <Ionicons name="chatbubble-outline" size={32} color="#9CA3AF" />
          <Text className="text-neutral-400 text-sm mt-2">No comments yet. Be the first!</Text>
        </View>
      )}

      {/* Comment input */}
      {user && (
        <View className="flex-row items-center px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
          <TextInput
            className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-full px-4 py-2.5 text-neutral-900 dark:text-neutral-100"
            placeholder="Add a comment..."
            placeholderTextColor="#9CA3AF"
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!newComment.trim() || isSending}
            className="ml-2 p-2"
          >
            <Ionicons
              name="send"
              size={24}
              color={newComment.trim() ? colors.accent : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
