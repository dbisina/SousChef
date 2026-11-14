import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { RecipeComment } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { Icon, UAvatar, UIconButton, UInput, FONT } from '@/components/ui';

interface RecipeCommentsProps {
  recipeId: string;
}

export const RecipeComments: React.FC<RecipeCommentsProps> = ({ recipeId }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { addComment, fetchComments } = useRecipeStore();

  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const loadComments = async () => {
    const result = await fetchComments(recipeId);
    setComments(result);
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

  const openAuthor = (authorId: string) => router.push(`/user/${authorId}` as never);

  return (
    <View style={{ gap: 14 }}>
      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 19, letterSpacing: -0.285 }}>
        {t('cooking.commentsTitle', 'Comments ({{count}})', { count: comments.length })}
      </Text>

      {comments.length > 0 ? (
        <View style={{ gap: 16 }}>
          {comments.map((item) => (
            <View key={item.id} className="flex-row" style={{ gap: 12 }}>
              <Pressable
                onPress={() => openAuthor(item.authorId)}
                accessibilityRole="button"
                accessibilityLabel={item.authorName}
              >
                <UAvatar
                  source={item.authorPhotoURL ? { uri: item.authorPhotoURL } : null}
                  name={item.authorName}
                  size={44}
                />
              </Pressable>
              <View className="flex-1" style={{ gap: 3 }}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Pressable onPress={() => openAuthor(item.authorId)} accessibilityRole="button">
                    <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                      {item.authorName}
                    </Text>
                  </Pressable>
                  <Text className="text-subtle" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                <Text className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
                  {item.text}
                </Text>
                {item.rating ? (
                  <View className="flex-row items-center" style={{ gap: 2, marginTop: 2 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon
                        key={star}
                        name="star"
                        size={13}
                        color={star <= (item.rating ?? 0) ? 'accent' : 'line'}
                        filled={star <= (item.rating ?? 0)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="items-center bg-surface" style={{ borderRadius: 24, paddingVertical: 24, gap: 8 }}>
          <Icon name="chat" size="lg" color="subtle" />
          <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
            {t('cooking.noComments', 'No comments yet. Be the first!')}
          </Text>
        </View>
      )}

      {user ? (
        <UInput
          label={t('cooking.addComment', 'Add a comment...')}
          placeholder={t('cooking.addComment', 'Add a comment...')}
          value={newComment}
          onChangeText={setNewComment}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          right={
            <UIconButton
              icon="send"
              label={t('cooking.sendComment', 'Send comment')}
              tone={newComment.trim() ? 'accent' : 'default'}
              disabled={!newComment.trim() || isSending}
              onPress={handleSend}
              size={44}
            />
          }
        />
      ) : null}
    </View>
  );
};
