import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  Image,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useWantToCookStore } from '@/stores/wantToCookStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_SIZE = 64;
const MAX_PAGES = 10;

interface CookbookScannerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (recipeTitle: string) => void;
}

export const CookbookScanner: React.FC<CookbookScannerProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'camera' | 'review' | 'naming'>('camera');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [cookbookName, setCookbookName] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const { user } = useAuthStore();
  const { importFromPhoto, importFromMultiplePhotos, isImporting, importProgress, error } = useWantToCookStore();

  // Animation values
  const scanLineY = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (visible && mode === 'camera') {
      // Scanning line animation
      scanLineY.value = withRepeat(
        withTiming(200, { duration: 2000 }),
        -1,
        true
      );
      // Pulse animation for capture button
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1
      );
    }
  }, [visible, mode]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    if (capturedImages.length >= MAX_PAGES) {
      Alert.alert('Maximum Pages', `You can scan up to ${MAX_PAGES} pages per recipe.`);
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedImages((prev) => [...prev, photo.uri]);
      }
    } catch (error) {
      console.error('Failed to capture:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handlePickImages = async () => {
    const remaining = MAX_PAGES - capturedImages.length;
    if (remaining <= 0) {
      Alert.alert('Maximum Pages', `You can scan up to ${MAX_PAGES} pages per recipe.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri);
      setCapturedImages((prev) => [...prev, ...newUris]);
    }
  };

  const handleRemovePage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
    if (previewIndex === index) setPreviewIndex(null);
  };

  const handleDone = () => {
    if (capturedImages.length === 0) {
      Alert.alert('No Pages', 'Capture at least one page before continuing.');
      return;
    }
    setMode('review');
  };

  const handleScan = async () => {
    if (capturedImages.length === 0 || !user) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    let result;
    if (capturedImages.length === 1) {
      // Single page — use original method
      result = await importFromPhoto(capturedImages[0], user.id, cookbookName || undefined);
    } else {
      // Multiple pages — use batch method
      result = await importFromMultiplePhotos(capturedImages, user.id, cookbookName || undefined);
    }

    if (result) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const title = result.importedRecipe?.title || 'Recipe';
      handleClose();
      onSuccess?.(title);
    }
  };

  const handleClose = () => {
    setCapturedImages([]);
    setCookbookName('');
    setMode('camera');
    setPreviewIndex(null);
    onClose();
  };

  const handleBackToCamera = () => {
    setMode('camera');
  };

  if (!visible) return null;

  // Permission not granted
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View className="flex-1 bg-neutral-900 items-center justify-center p-8">
          <View className="w-20 h-20 rounded-full bg-white/10 items-center justify-center mb-6">
            <Ionicons name="camera-outline" size={40} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white text-center mb-2">
            Camera Access Needed
          </Text>
          <Text className="text-white/70 text-center mb-8">
            To scan cookbook pages, we need access to your camera.
          </Text>
          <Button
            title="Allow Camera Access"
            onPress={requestPermission}
            fullWidth
          />
          <TouchableOpacity onPress={onClose} className="mt-4 py-3">
            <Text className="text-white/60">Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View className="flex-1 bg-black">
        {/* ─── CAMERA MODE ─────────────────────────────────── */}
        {mode === 'camera' && (
          <View style={{ flex: 1 }}>
            {/* Camera View */}
            <CameraView
              ref={cameraRef}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              facing="back"
            />

            {/* Overlay UI */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {/* Top bar */}
              <View className="pt-14 px-4 flex-row items-center justify-between">
                <TouchableOpacity
                  onPress={handleClose}
                  className="w-12 h-12 rounded-full bg-black/40 items-center justify-center"
                >
                  <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>

                <View className="flex-row items-center bg-black/40 px-4 py-2 rounded-full">
                  <Ionicons name="book-outline" size={18} color="white" />
                  <Text className="text-white font-medium ml-2">Cookbook Scanner</Text>
                  {capturedImages.length > 0 && (
                    <View className="bg-primary-500 rounded-full w-6 h-6 items-center justify-center ml-2">
                      <Text className="text-white text-xs font-bold">{capturedImages.length}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handlePickImages}
                  className="w-12 h-12 rounded-full bg-black/40 items-center justify-center"
                >
                  <Ionicons name="images-outline" size={24} color="white" />
                </TouchableOpacity>
              </View>

              {/* Scan frame */}
              <View className="flex-1 items-center justify-center px-8">
                <View
                  className="w-full aspect-[3/4] rounded-3xl overflow-hidden"
                  style={{
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.5)',
                  }}
                >
                  {/* Scanning line */}
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: 2,
                      },
                      scanLineStyle,
                    ]}
                  >
                    <LinearGradient
                      colors={['transparent', '#FF6B35', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: '100%' }}
                    />
                  </Animated.View>

                  {/* Corner decorations */}
                  <View className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white/90 rounded-tl-2xl shadow-sm" />
                  <View className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white/90 rounded-tr-2xl shadow-sm" />
                  <View className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white/90 rounded-bl-2xl shadow-sm" />
                  <View className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white/90 rounded-br-2xl shadow-sm" />
                </View>

                <Text className="text-white/80 text-center mt-6">
                  {capturedImages.length === 0
                    ? 'Position the recipe page within the frame'
                    : `${capturedImages.length} page${capturedImages.length !== 1 ? 's' : ''} captured — keep snapping or tap Done`}
                </Text>
              </View>

              {/* Captured page thumbnails strip */}
              {capturedImages.length > 0 && (
                <View className="px-4 mb-3">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {capturedImages.map((uri, idx) => (
                      <View key={idx} className="mr-2 relative">
                        <Image
                          source={{ uri }}
                          style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 12 }}
                          resizeMode="cover"
                        />
                        <View className="absolute -top-1 -left-1 bg-primary-500 rounded-full w-5 h-5 items-center justify-center">
                          <Text className="text-white text-[10px] font-bold">{idx + 1}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemovePage(idx)}
                          className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
                        >
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Bottom controls */}
              <View className="flex-row items-center justify-center pb-12 px-6">
                {/* Capture button */}
                <View className="flex-1 items-center">
                  <Animated.View style={pulseStyle}>
                    <TouchableOpacity
                      onPress={handleCapture}
                      activeOpacity={0.8}
                    >
                      <View className="w-20 h-20 rounded-full bg-white items-center justify-center">
                        <View className="w-16 h-16 rounded-full bg-primary-500 items-center justify-center border-4 border-white/30">
                          <Ionicons name="scan" size={32} color="white" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                  <Text className="text-white/60 mt-2 text-sm">
                    {capturedImages.length === 0 ? 'Tap to scan' : 'Add page'}
                  </Text>
                </View>

                {/* Done button (visible when pages > 0) */}
                {capturedImages.length > 0 && (
                  <TouchableOpacity
                    onPress={handleDone}
                    className="absolute right-6 bottom-14 bg-primary-500 px-5 py-3 rounded-full flex-row items-center"
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text className="text-white font-bold ml-2">Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ─── REVIEW MODE ─────────────────────────────────── */}
        {mode === 'review' && (
          <View className="flex-1 bg-neutral-900">
            {/* Header */}
            <View className="pt-14 px-4 pb-4 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={handleBackToCamera}
                className="flex-row items-center bg-white/15 px-4 py-2 rounded-full"
              >
                <Ionicons name="camera" size={18} color="white" />
                <Text className="text-white font-medium ml-2">Add More</Text>
              </TouchableOpacity>

              <Text className="text-white font-bold text-lg">
                {capturedImages.length} Page{capturedImages.length !== 1 ? 's' : ''}
              </Text>

              <TouchableOpacity
                onPress={() => setMode('naming')}
                className="flex-row items-center bg-primary-500 px-4 py-2 rounded-full"
              >
                <Ionicons name="arrow-forward" size={18} color="white" />
                <Text className="text-white font-medium ml-1">Next</Text>
              </TouchableOpacity>
            </View>

            {/* Page grid */}
            <FlatList
              data={capturedImages}
              numColumns={2}
              keyExtractor={(_, idx) => idx.toString()}
              contentContainerStyle={{ padding: 8 }}
              renderItem={({ item: uri, index }) => (
                <View className="flex-1 m-2 relative" style={{ aspectRatio: 3 / 4 }}>
                  <Image
                    source={{ uri }}
                    style={{ flex: 1, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                  {/* Page number */}
                  <View className="absolute top-2 left-2 bg-black/60 rounded-full px-3 py-1">
                    <Text className="text-white text-sm font-bold">Page {index + 1}</Text>
                  </View>
                  {/* Remove button */}
                  <TouchableOpacity
                    onPress={() => handleRemovePage(index)}
                    className="absolute top-2 right-2 bg-red-500/90 rounded-full w-8 h-8 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View className="items-center py-20">
                  <Ionicons name="document-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text className="text-white/50 mt-4">No pages captured</Text>
                </View>
              }
            />
          </View>
        )}

        {/* ─── NAMING MODE ─────────────────────────────────── */}
        {mode === 'naming' && capturedImages.length > 0 && (
          <View className="flex-1 bg-neutral-900">
            {/* Preview of first page */}
            <View className="flex-1 relative">
              <Image
                source={{ uri: capturedImages[previewIndex ?? 0] }}
                style={{ flex: 1, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
                resizeMode="contain"
              />

              {/* Overlay gradient */}
              <LinearGradient
                colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']}
                className="absolute inset-0"
              />

              {/* Top bar */}
              <View className="absolute top-14 left-4 right-4 flex-row items-center justify-between">
                <TouchableOpacity
                  onPress={() => setMode('review')}
                  className="flex-row items-center bg-white/20 px-4 py-2 rounded-full"
                >
                  <Ionicons name="arrow-back" size={18} color="white" />
                  <Text className="text-white font-medium ml-2">Review</Text>
                </TouchableOpacity>

                <View className="bg-black/50 px-3 py-1.5 rounded-full">
                  <Text className="text-white font-medium">
                    {capturedImages.length} page{capturedImages.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {/* Mini page selector */}
              {capturedImages.length > 1 && (
                <View className="absolute bottom-4 left-0 right-0">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {capturedImages.map((uri, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setPreviewIndex(idx)}
                        className="mr-2"
                      >
                        <Image
                          source={{ uri }}
                          style={{
                            width: 48,
                            height: 64,
                            borderRadius: 8,
                            borderWidth: (previewIndex ?? 0) === idx ? 2 : 0,
                            borderColor: '#FF6B35',
                          }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Bottom sheet */}
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <Text className="text-xl font-bold text-neutral-900 mb-2">
                Almost there!
              </Text>
              <Text className="text-neutral-500 mb-6">
                {capturedImages.length > 1
                  ? `AI will analyze all ${capturedImages.length} pages together to extract the full recipe`
                  : 'Optionally name the cookbook this recipe is from'}
              </Text>

              <View className="mb-6">
                <Text className="text-sm font-medium text-neutral-700 mb-2">
                  Cookbook Name (optional)
                </Text>
                <TextInput
                  className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 text-base text-neutral-900 font-medium"
                  placeholder="e.g., Salt Fat Acid Heat"
                  placeholderTextColor="#9CA3AF"
                  value={cookbookName}
                  onChangeText={setCookbookName}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                />
              </View>

              {/* Error */}
              {error && (
                <Animated.View
                  entering={FadeIn}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4"
                >
                  <Text className="text-red-600">{error}</Text>
                </Animated.View>
              )}

              {/* Progress */}
              {isImporting && (
                <Animated.View
                  entering={FadeIn}
                  className="bg-primary-50 rounded-xl p-4 mb-4"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="sparkles" size={20} color="#FF6B35" />
                    <Text className="text-primary-700 ml-2 font-medium">
                      {importProgress || 'Extracting recipe...'}
                    </Text>
                  </View>
                </Animated.View>
              )}

              <TouchableOpacity
                onPress={handleScan}
                disabled={isImporting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isImporting ? ['#D1D5DB', '#9CA3AF'] : ['#FF6B35', '#FF8F5A']}
                  className="py-4 rounded-2xl items-center justify-center flex-row"
                >
                  <Ionicons name="sparkles" size={20} color="white" />
                  <Text className="text-white font-bold text-lg ml-2">
                    {isImporting
                      ? 'Scanning...'
                      : capturedImages.length > 1
                        ? `Extract from ${capturedImages.length} Pages`
                        : 'Extract Recipe'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default CookbookScanner;
