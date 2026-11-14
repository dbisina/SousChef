import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Divider, Icon, Muted, PhotoCard, Screen, SheetPanel, UAvatar, UButton, UIconButton, UInput, H2 } from '@/components/ui';
import { FONT } from '@/components/ui/fonts';
import { CURRENT_USER } from '@/data/sample/social';
import { useSocialStore } from '@/stores/socialStore';
import { Action, AuthorRow, photoOf, shareText } from '@/components/feed/shared';
import { CommentItem } from '@/components/feed/CommentItem';
import type { Comment, PhotoRef } from '@/types/social';

interface Item {
  source: 'post' | 'reel';
  id: string;
  authorId: string;
  photo: PhotoRef;
  title: string;
  caption: string;
  recipeId?: string;
  likes: number;
  commentCount: number;
  saves: number;
  createdAt: string;
}

/** Post detail. Reel ids are accepted too so a reel's comment button lands here. */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const posts = useSocialStore((s) => s.posts);
  const reels = useSocialStore((s) => s.reels);
  const comments = useSocialStore((s) => s.comments);
  const authors = useSocialStore((s) => s.authors);
  const likedPostIds = useSocialStore((s) => s.likedPostIds);
  const savedPostIds = useSocialStore((s) => s.savedPostIds);
  const likedReelIds = useSocialStore((s) => s.likedReelIds);
  const savedReelIds = useSocialStore((s) => s.savedReelIds);
  const toggleLikePost = useSocialStore((s) => s.toggleLikePost);
  const toggleSavePost = useSocialStore((s) => s.toggleSavePost);
  const toggleLikeReel = useSocialStore((s) => s.toggleLikeReel);
  const toggleSaveReel = useSocialStore((s) => s.toggleSaveReel);
  const addComment = useSocialStore((s) => s.addComment);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; handle: string } | null>(null);

  const item: Item | undefined = useMemo(() => {
    const p = posts.find((x) => x.id === id);
    if (p) return { source: 'post', id: p.id, authorId: p.authorId, photo: p.photo, title: p.title, caption: p.caption, recipeId: p.recipeId, likes: p.likes, commentCount: p.commentCount, saves: p.saves, createdAt: p.createdAt };
    const r = reels.find((x) => x.id === id);
    if (r) return { source: 'reel', id: r.id, authorId: r.authorId, photo: r.photo, title: r.title, caption: r.caption, likes: r.likes, commentCount: r.commentCount, saves: r.saves, createdAt: r.createdAt };
    return undefined;
  }, [posts, reels, id]);

  const thread = useMemo(() => comments.filter((c) => c.postId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [comments, id]);
  const roots = useMemo(() => thread.filter((c) => !c.parentId), [thread]);

  if (!item) {
    return (
      <Screen bare>
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 14 }}>
          <H2 center>{t('post.notFound', 'Post not found')}</H2>
          <UButton size="sm" label={t('post.goBack', 'Go back')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const author = authors.find((a) => a.id === item.authorId);
  const isPost = item.source === 'post';
  const liked = isPost ? likedPostIds.includes(item.id) : likedReelIds.includes(item.id);
  const saved = isPost ? savedPostIds.includes(item.id) : savedReelIds.includes(item.id);
  const top = Math.max(insets.top, 20) + 14;
  const bottom = Math.max(insets.bottom, 20);

  const send = () => {
    const added = addComment(item.id, draft, replyTo?.id);
    if (added) {
      setDraft('');
      setReplyTo(null);
    }
  };
  const startReply = (c: Comment, handle: string) => {
    // Replies hang off the top-level comment.
    setReplyTo({ id: c.parentId ?? c.id, handle });
  };

  return (
    <Screen bare>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: bottom + 150 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoCard source={photoOf(item.photo)} height={380} radius={0} fade="none" accessibilityLabel={item.title}>
          <View className="flex-row justify-between" style={{ position: 'absolute', top, left: 20, right: 20 }}>
            <UIconButton tone="glassDark" icon="back" label={t('common.back', 'Back')} onPress={() => router.back()} />
            <UIconButton
              tone="glassDark"
              icon="bookmark"
              filled={saved}
              label={saved ? t('post.unsave', 'Remove from saved') : t('post.save', 'Save')}
              onPress={() => (isPost ? toggleSavePost(item.id) : toggleSaveReel(item.id))}
            />
          </View>
        </PhotoCard>

        <SheetPanel>
          {author ? (
            <AuthorRow
              photo={author.avatar}
              name={author.handle}
              sub={item.title}
              onPress={() => router.push(`/user/${author.id}` as Href)}
              right={
                <UButton
                  size="sm"
                  label={t('post.cookThis', 'Cook this')}
                  onPress={() => router.push((item.recipeId ? `/recipe/${item.recipeId}` : '/(tabs)/browse') as Href)}
                />
              }
            />
          ) : null}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center" style={{ gap: 18 }}>
              <Action
                icon="heart"
                label={t('post.like', 'Like')}
                active={liked}
                count={item.likes}
                onPress={() => (isPost ? toggleLikePost(item.id) : toggleLikeReel(item.id))}
              />
              <Action icon="chat" label={t('post.comments', 'Comments')} count={Math.max(item.commentCount, thread.length)} />
              <Action icon="send" label={t('post.share', 'Share')} onPress={() => shareText(`${item.title} · ${item.caption}`)} />
            </View>
            <Muted small>{t('post.saves', '{{n}} saves', { n: item.saves })}</Muted>
          </View>
          <Divider />
          <View style={{ gap: 16 }}>
            {roots.length === 0 ? (
              <Muted>{t('post.noComments', 'No comments yet. Say something nice.')}</Muted>
            ) : (
              roots.map((c) => (
                <View key={c.id} style={{ gap: 16 }}>
                  <CommentItem comment={c} onReply={startReply} />
                  {thread
                    .filter((r) => r.parentId === c.id)
                    .map((r) => (
                      <CommentItem key={r.id} comment={r} reply onReply={startReply} />
                    ))}
                </View>
              ))
            )}
          </View>
        </SheetPanel>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
      >
        <View className="bg-ground" style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: bottom, gap: 8 }}>
          {replyTo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('post.cancelReply', 'Cancel reply')}
              onPress={() => setReplyTo(null)}
              className="flex-row items-center"
              style={{ gap: 6, minHeight: 32 }}
            >
              <Muted small>{t('post.replyingTo', 'Replying to {{name}}', { name: replyTo.handle })}</Muted>
              <Icon name="close" size="sm" color="muted" />
            </Pressable>
          ) : null}
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <UAvatar source={photoOf(CURRENT_USER.avatar)} name={CURRENT_USER.displayName} size={40} />
            <View className="flex-1">
              <UInput
                height={50}
                label={t('post.addComment', 'Add a comment')}
                placeholder={t('post.addCommentPlaceholder', 'Add a comment…')}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={send}
                returnKeyType="send"
              />
            </View>
            <UIconButton icon="send" tone="black" label={t('post.postComment', 'Post comment')} onPress={send} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
