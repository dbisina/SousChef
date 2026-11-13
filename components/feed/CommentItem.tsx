import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Tag, UAvatar } from '@/components/ui';
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
      <View className="flex-1" style={{ gap: 2, minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <RNText className="text-ink" style={{ fontFamily: FONT.sansSemi, fontSize: 12 }}>
            {author.handle}
          </RNText>
          {comment.isAuthor ? (
            <View style={{ transform: [{ scale: 0.85 }], marginLeft: -4 }}>
              <Tag label={t('post.author', 'Author')} />
            </View>
          ) : (
            <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
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
            hitSlop={8}
            style={{ minHeight: 32, justifyContent: 'center' }}
          >
            <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
              {t('post.reply', 'Reply')}
            </RNText>
          </Pressable>
          <RNText className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
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
        <Icon name="heart" size="sm" filled={liked} color={liked ? 'accent' : 'muted'} />
      </Pressable>
    </View>
  );
}
