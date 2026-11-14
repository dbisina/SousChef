import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, UAvatar } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { useSocialStore } from '@/stores/socialStore';
import { timeAgo } from '@/lib/timeAgo';
import type { Comment } from '@/types/social';
import { photoOf } from './shared';

interface CommentItemProps {
  comment: Comment;
  reply?: boolean;
  onReply: (comment: Comment, handle: string) => void;
}

/** One comment (or an indented reply) with like and reply controls. */
export function CommentItem({ comment, reply, onReply }: CommentItemProps) {
  const { t } = useTranslation();
  const author = useSocialStore((s) => s.authors.find((a) => a.id === comment.authorId));
  const liked = useSocialStore((s) => s.likedCommentIds.includes(comment.id));
  const toggleLike = useSocialStore((s) => s.toggleLikeComment);
  if (!author) return null;
  const size = reply ? 30 : 36;
  return (
    <View className="flex-row items-start" style={{ gap: 12, paddingStart: reply ? 48 : 0 }}>
      <UAvatar source={photoOf(author.avatar)} name={author.displayName} size={size} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 12, lineHeight: 15 }}>
            {author.handle}
          </RNText>
          {comment.isAuthor ? (
            <View className="bg-surface-3 justify-center" style={{ height: 20, borderRadius: 10, paddingHorizontal: 11 }}>
              <RNText className="text-ink" style={{ fontFamily: FONT.sansMedium, fontSize: 10 }}>
                {t('post.author', 'Author')}
              </RNText>
            </View>
          ) : (
            <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 15 }}>
              {timeAgo(comment.createdAt)}
            </RNText>
          )}
        </View>
        <RNText className="text-ink" style={{ fontFamily: FONT.sans, fontSize: 14, lineHeight: 20 }}>
          {comment.text}
        </RNText>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('post.replyTo', 'Reply to {{name}}', { name: author.handle })}
            onPress={() => onReply(comment, author.handle)}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            style={{ justifyContent: 'center' }}
          >
            <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 15 }}>
              {t('post.reply', 'Reply')}
            </RNText>
          </Pressable>
          <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12, lineHeight: 15 }}>
            {`· ${t('post.likesCount', '{{n}} likes', { n: comment.likes })}`}
          </RNText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={liked ? t('post.unlikeComment', 'Unlike comment') : t('post.likeComment', 'Like comment')}
        accessibilityState={{ selected: liked }}
        onPress={() => toggleLike(comment.id)}
        hitSlop={12}
        style={{ minHeight: 44, minWidth: 28, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 }}
      >
        <Icon name="heart" size="sm" filled={liked} color={liked ? 'accent' : 'ink'} />
      </Pressable>
    </View>
  );
}
