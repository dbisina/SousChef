import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeColors } from '@/stores/themeStore';
import { RecipeMadePost } from '@/types';
import { uploadImage } from '@/lib/cloudinary';
import { db, collection, doc, setDoc, getDocs, query, orderBy, limit, Timestamp } from '@/lib/firebase';
import { generateId } from '@/lib/firebase';
import { showSuccessToast, showErrorToast } from '@/stores/toastStore';

interface MadeThisGalleryProps {
  recipeId: string;
}

export function MadeThisGallery({ recipeId }: MadeThisGalleryProps) {
  const [posts, setPosts] = useState<RecipeMadePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<RecipeMadePost | null>(null);

  const { user } = useAuthStore();
  const colors = useThemeColors();

  useEffect(() => {
    fetchPosts();
  }, [recipeId]);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const postsRef = collection(db, 'recipes', recipeId, 'made-posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as RecipeMadePost));
      setPosts(fetched);
    } catch (error) {
      console.error('Error fetching made-this posts:', error);
    } finally {
      setIsLoading(false);
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

      const imageURL = await uploadImage(
        result.assets[0].uri,
        `souschef/made-posts/${recipeId}`
      );

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
    <TouchableOpacity
      onPress={handleAddPost}
      disabled={isUploading || !user}
      className="w-[120px] h-[120px] rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 items-center justify-center mr-3"
      style={isUploading ? { opacity: 0.5 } : undefined}
    >
      <Ionicons
        name={isUploading ? 'hourglass-outline' : 'camera-outline'}
        size={28}
        color={colors.accent}
      />
      <Text
        className="text-xs font-medium mt-1"
        style={{ color: colors.accent }}
      >
        {isUploading ? 'Uploading...' : 'Add Yours'}
      </Text>
    </TouchableOpacity>
  );

  const renderPostCard = ({ item }: { item: RecipeMadePost }) => (
    <TouchableOpacity
      onPress={() => setSelectedPost(item)}
      className="w-[120px] h-[120px] rounded-xl overflow-hidden mr-3"
    >
      <Image
        source={{ uri: item.imageURL }}
        className="w-full h-full"
        resizeMode="cover"
      />
      <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
        <Text className="text-white text-[10px] font-medium" numberOfLines={1}>
          {item.authorName}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="mt-6">
      {/* Section Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Ionicons name="images-outline" size={20} color={colors.text} />
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50 ml-2">
            I Made This
          </Text>
        </View>
        <Text className="text-neutral-500 dark:text-neutral-400 text-sm">
          {posts.length} {posts.length === 1 ? 'photo' : 'photos'}
        </Text>
      </View>

      {/* Gallery */}
      <FlatList
        data={posts}
        renderItem={renderPostCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        ListHeaderComponent={user ? renderAddCard : null}
        ListEmptyComponent={
          !user ? (
            <Text className="text-neutral-400 dark:text-neutral-500 text-sm py-4">
              Sign in to share your creation!
            </Text>
          ) : null
        }
      />

      {/* Full-screen Modal */}
      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View className="flex-1 bg-black/90 items-center justify-center">
          {/* Close button */}
          <TouchableOpacity
            onPress={() => setSelectedPost(null)}
            className="absolute top-14 right-4 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>

          {selectedPost && (
            <View className="w-full items-center px-4">
              <Image
                source={{ uri: selectedPost.imageURL }}
                className="w-full aspect-square rounded-xl"
                resizeMode="contain"
              />
              <View className="flex-row items-center mt-4">
                {selectedPost.authorPhotoURL ? (
                  <Image
                    source={{ uri: selectedPost.authorPhotoURL }}
                    className="w-8 h-8 rounded-full mr-2"
                  />
                ) : (
                  <View className="w-8 h-8 rounded-full bg-neutral-600 items-center justify-center mr-2">
                    <Ionicons name="person" size={16} color="white" />
                  </View>
                )}
                <Text className="text-white font-medium">
                  {selectedPost.authorName}
                </Text>
              </View>
              {selectedPost.caption && (
                <Text className="text-neutral-300 text-center mt-2">
                  {selectedPost.caption}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
