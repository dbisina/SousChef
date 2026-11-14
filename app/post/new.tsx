import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Field,
  Icon,
  ListRow,
  Muted,
  PhotoCard,
  Rows,
  Screen,
  Segmented,
  Sheet,
  Tag,
  TopBar,
  UButton,
  UIconButton,
} from '@/components/ui';
import { useSocialStore } from '@/stores/socialStore';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { photoOf } from '@/components/feed/shared';
import type { PhotoRef, PostKind } from '@/types/social';

const PHOTOS: PhotoRef[] = ['gnocchi', 'pasta', 'penne'];

type PickerKind = 'recipe' | 'community' | null;

export default function NewPostScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const createPost = useSocialStore((s) => s.createPost);
  const communities = useSocialStore((s) => s.communities);
  const wantToCook = useWantToCookStore((s) => s.items);

  const [kind, setKind] = useState<PostKind>('recipe');
  const [photo, setPhoto] = useState<PhotoRef>('gnocchi');
  const [caption, setCaption] = useState('');
  const [recipe, setRecipe] = useState<{ id: string; title: string } | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerKind>(null);

  const saved = useMemo(
    () =>
      wantToCook
        .filter((i) => i.importedRecipe)
        .map((i) => ({ id: i.recipeId ?? i.id, title: i.importedRecipe?.title ?? '' })),
    [wantToCook],
  );
  const community = communities.find((c) => c.id === communityId);
  const others = PHOTOS.filter((p) => p !== photo);
  const canShare = caption.trim().length > 0;

  const share = () => {
    if (!canShare) return;
    const post = createPost({
      kind,
      photo,
      caption: caption.trim(),
      title: recipe?.title,
      recipeId: recipe?.id,
      communityId: communityId ?? undefined,
    });
    router.replace(`/post/${post.id}` as Href);
  };

  return (
    <Screen bare>
      <TopBar
        variant="compact"
        title={t('newPost.title', 'New post')}
        left={<UIconButton icon="close" label={t('newPost.close', 'Close')} onPress={() => router.back()} />}
        right={<UButton size="sm" variant="accent" label={t('newPost.share', 'Share')} onPress={share} disabled={!canShare} />}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Segmented<PostKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'recipe', label: t('newPost.kindRecipe', 'Recipe') },
            { value: 'made-this', label: t('newPost.kindMadeThis', 'Made this') },
            { value: 'video', label: t('newPost.kindVideo', 'Video') },
            { value: 'plan', label: t('newPost.kindPlan', 'Plan') },
          ]}
        />

        <View className="flex-row" style={{ gap: 8 }}>
          <View style={{ flex: 2 }}>
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 22, borderWidth: 2, zIndex: 1 }}
              className="border-ink"
            />
            <PhotoCard source={photoOf(photo)} height={308} radius={20} fade="none" accessibilityLabel={t('newPost.selectedPhoto', 'Selected photo')}>
              <View
                pointerEvents="none"
                className="items-center justify-center bg-ink"
                style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14 }}
              >
                <Icon name="check" size="sm" color="ink-inverse" />
              </View>
            </PhotoCard>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {others.map((p) => (
              <PhotoCard
                key={p}
                source={photoOf(p)}
                height={150}
                radius={20}
                fade="none"
                onPress={() => setPhoto(p)}
                accessibilityLabel={t('newPost.pickPhoto', 'Use this photo')}
              />
            ))}
          </View>
        </View>

        <Field
          label={t('newPost.caption', 'Caption')}
          placeholder={t('newPost.captionPlaceholder', 'Say something about this dish…')}
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <Rows>
          <ListRow
            icon="book"
            title={t('newPost.attachRecipe', 'Attach recipe')}
            subtitle={recipe ? recipe.title : t('newPost.optional', 'Optional')}
            onPress={() => setPicker('recipe')}
          />
          <ListRow
            icon="people"
            title={t('newPost.shareCommunity', 'Share to a community')}
            subtitle={community ? community.name : t('newPost.optional', 'Optional')}
            onPress={() => setPicker('community')}
          />
          <ListRow
            icon="globe"
            title={t('newPost.whoCanSee', 'Who can see this')}
            right={<Tag label={t('newPost.everyone', 'Everyone')} />}
          />
        </Rows>
      </ScrollView>

      <Sheet visible={picker === 'recipe'} onClose={() => setPicker(null)} title={t('newPost.attachRecipe', 'Attach recipe')}>
        <Rows>
          <ListRow
            title={t('newPost.none', 'None')}
            onPress={() => {
              setRecipe(null);
              setPicker(null);
            }}
            right={!recipe ? <Icon name="check" /> : undefined}
          />
          {saved.map((r) => (
            <ListRow
              key={r.id}
              title={r.title}
              subtitle={t('newPost.fromSaved', 'From your saved')}
              onPress={() => {
                setRecipe(r);
                setPicker(null);
              }}
              right={recipe?.id === r.id ? <Icon name="check" /> : undefined}
            />
          ))}
        </Rows>
        {saved.length === 0 ? <Muted>{t('newPost.noSaved', 'Import or save a recipe and it will show up here.')}</Muted> : null}
      </Sheet>

      <Sheet visible={picker === 'community'} onClose={() => setPicker(null)} title={t('newPost.shareCommunity', 'Share to a community')}>
        <Rows>
          <ListRow
            title={t('newPost.none', 'None')}
            onPress={() => {
              setCommunityId(null);
              setPicker(null);
            }}
            right={!communityId ? <Icon name="check" /> : undefined}
          />
          {communities.map((c) => (
            <ListRow
              key={c.id}
              title={c.name}
              subtitle={t('newPost.members', '{{n}} members', { n: c.memberCount })}
              onPress={() => {
                setCommunityId(c.id);
                setPicker(null);
              }}
              right={communityId === c.id ? <Icon name="check" /> : undefined}
            />
          ))}
        </Rows>
      </Sheet>
    </Screen>
  );
}
