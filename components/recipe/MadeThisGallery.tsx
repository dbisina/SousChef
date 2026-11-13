import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { RecipeMadePost } from '@/types';
import { uploadImage } from '@/lib/cloudinary';
import { db, collection, doc, setDoc, getDocs, query, orderBy, limit, Timestamp } from '@/lib/firebase';
import { generateId } from '@/lib/firebase';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';
import { Icon, ToneBlock, UAvatar, UIconButton, FONT } from '@/components/ui';

interface MadeThisGalleryProps {
  recipeId: string;
}

export function MadeThisGallery({ recipeId }: MadeThisGalleryProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<RecipeMadePost[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<RecipeMadePost | null>(null);

  const { user } = useAuthStore();

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const fetchPosts = async () => {
    try {
      const postsRef = collection(db, 'recipes', recipeId, 'made-posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RecipeMadePost));
      setPosts(fetched);
    } catch (error) {
      console.error('Error fetching made-this posts:', error);
    }
  };

  const handleAddPost = async () => {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      setIsUploading(true);

      const imageURL = await uploadImage(result.assets[0].uri, `souschef/made-posts/${recipeId}`);

      const postId = generateId();
      const newPost: RecipeMadePost = {
        id: postId,
        recipeId,
        authorId: user.id,
        authorName: user.displayName || 'Anonymous',
        authorPhotoURL: user.photoURL,
        imageURL,
        likes: 0,
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'recipes', recipeId, 'made-posts', postId), newPost);

      setPosts((prev) => [newPost, ...prev]);
      showSuccessToast('Your photo has been posted!');
    } catch (error) {
      console.error('Error posting made-this photo:', error);
      showErrorToast('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderAddCard = () => (
    <Pressable
      onPress={handleAddPost}
      disabled={isUploading || !user}
      accessibilityRole="button"
      accessibilityLabel={t('cooking.addYours', 'Add Yours')}
      className="items-center justify-center bg-surface"
      style={{ width: 120, height: 120, borderRadius: 26, marginRight: 12, gap: 6, opacity: isUploading ? 0.5 : 1 }}
    >
      <Icon name="camera" size="lg" color="accent-text" />
      <Text className="text-accent-text" style={{ fontFamily: FONT.sansMedium, fontSize: 12 }}>
        {isUploading ? t('cooking.uploading', 'Uploading...') : t('cooking.addYours', 'Add Yours')}
      </Text>
    </Pressable>
  );

  const renderPostCard = ({ item }: { item: RecipeMadePost }) => (
    <Pressable
      onPress={() => setSelectedPost(item)}
      accessibilityRole="button"
      accessibilityLabel={item.authorName}
      className="overflow-hidden bg-surface-3"
      style={{ width: 120, height: 120, borderRadius: 26, marginRight: 12 }}
    >
      <Image source={{ uri: item.imageURL }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    </Pressable>
  );

  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 19, letterSpacing: -0.285 }}>
          {t('cooking.madeThis', 'I Made This')}
        </Text>
        <Text className="text-muted" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
          {t('cooking.photoCount', '{{count}} photos', { count: posts.length })}
        </Text>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPostCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        ListHeaderComponent={user ? renderAddCard : null}
        ListEmptyComponent={
          !user ? (
            <Text className="text-subtle" style={{ fontFamily: FONT.sans, fontSize: 13 }}>
              {t('cooking.signInToShare', 'Sign in to share your creation!')}
            </Text>
          ) : null
        }
      />

      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <ToneBlock tone="dark" className="bg-ground" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 58, right: 20, zIndex: 10 }}>
            <UIconButton
              icon="close"
              label={t('cooking.close', 'Close')}
              tone="glassDark"
              onPress={() => setSelectedPost(null)}
            />
          </View>

          {selectedPost ? (
            <View className="w-full items-center" style={{ paddingHorizontal: 20, gap: 14 }}>
              <Image
                source={{ uri: selectedPost.imageURL }}
                style={{ width: '100%', aspectRatio: 1, borderRadius: 30 }}
                contentFit="cover"
              />
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <UAvatar
                  source={selectedPost.authorPhotoURL ? { uri: selectedPost.authorPhotoURL } : null}
                  name={selectedPost.authorName}
                  size={32}
                />
                <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 15 }}>
                  {selectedPost.authorName}
                </Text>
              </View>
              {selectedPost.caption ? (
                <Text className="text-muted text-center" style={{ fontFamily: FONT.sans, fontSize: 14 }}>
                  {selectedPost.caption}
                </Text>
              ) : null}
            </View>
          ) : null}
        </ToneBlock>
      </Modal>
    </View>
  );
}
