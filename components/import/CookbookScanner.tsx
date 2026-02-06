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
  const [mode, setMode] = useState<'camera' | 'preview' | 'naming'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cookbookName, setCookbookName] = useState('');
  const cameraRef = useRef<CameraView>(null);

  const { user } = useAuthStore();
  const { importFromPhoto, isImporting, importProgress, error } = useWantToCookStore();

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

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedImage(photo.uri);
        setMode('naming');
      }
    } catch (error) {
      console.error('Failed to capture:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      setMode('naming');
    }
  };

  const handleScan = async () => {
    if (!capturedImage || !user) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const result = await importFromPhoto(capturedImage, user.id, cookbookName || undefined);

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
    setCapturedImage(null);
    setCookbookName('');
    setMode('camera');
    onClose();
  };

  const handleRetake = () => {
    setCapturedImage(null);
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
        {mode === 'camera' && (
          <View style={{ flex: 1 }}>
            {/* Camera View - rendered without children */}
            <CameraView
              ref={cameraRef}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              facing="back"
            />

            {/* Overlay UI - absolutely positioned on top */}
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
                </View>

                <TouchableOpacity
                  onPress={handlePickImage}
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
                  <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white/80 rounded-tl-lg" />
                  <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white/80 rounded-tr-lg" />
                  <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white/80 rounded-bl-lg" />
                  <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white/80 rounded-br-lg" />
                </View>

                <Text className="text-white/80 text-center mt-6">
                  Position the recipe page within the frame
                </Text>
              </View>

              {/* Capture button */}
              <View className="items-center pb-12">
                <Animated.View style={pulseStyle}>
                  <TouchableOpacity
                    onPress={handleCapture}
                    activeOpacity={0.8}
                  >
                    <View className="w-20 h-20 rounded-full bg-white items-center justify-center">
                      <View className="w-16 h-16 rounded-full bg-primary-500 items-center justify-center">
                        <Ionicons name="scan" size={32} color="white" />
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
                <Text className="text-white/60 mt-3">Tap to scan</Text>
              </View>
            </View>
          </View>
        )}

        {mode === 'naming' && capturedImage && (
          <View className="flex-1 bg-neutral-900">
            {/* Preview image */}
            <View className="flex-1 relative">
              <Image
                source={{ uri: capturedImage }}
                className="flex-1"
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
                  onPress={handleRetake}
                  className="flex-row items-center bg-white/20 px-4 py-2 rounded-full"
                >
                  <Ionicons name="refresh" size={18} color="white" />
                  <Text className="text-white font-medium ml-2">Retake</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom sheet */}
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
              <Text className="text-xl font-bold text-neutral-900 mb-2">
                Almost there!
              </Text>
              <Text className="text-neutral-500 mb-6">
                Optionally name the cookbook this recipe is from
              </Text>

              <View className="mb-6">
                <Text className="text-sm font-medium text-neutral-700 mb-2">
                  Cookbook Name (optional)
                </Text>
                <TextInput
                  className="bg-neutral-100 rounded-xl px-4 py-4 text-base text-neutral-900"
                  placeholder="e.g., Salt Fat Acid Heat"
                  placeholderTextColor="#9CA3AF"
                  value={cookbookName}
                  onChangeText={setCookbookName}
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
                    {isImporting ? 'Scanning...' : 'Extract Recipe'}
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
