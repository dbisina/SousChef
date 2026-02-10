import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Modal } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { useThemeColors } from '@/stores/themeStore';

interface CameraCaptureProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (imageUri: string) => void;
  title?: string;
  description?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  visible,
  onClose,
  onCapture,
  title = 'Take a Photo',
  description = 'Position your ingredients in the frame',
}) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const colors = useThemeColors();

  const handleCapture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        setCapturedImage(photo.uri);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      setCapturedImage(null);
      onClose();
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  if (!permission) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="absolute top-12 left-0 right-0 z-10 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-white text-lg font-bold">{title}</Text>
              <Text className="text-white/70 text-sm">{description}</Text>
            </View>
            <View className="w-10" />
          </View>
        </View>

        {!permission.granted ? (
          // Permission request
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
            <Text className="text-white text-lg font-semibold mt-4 text-center">
              Camera Permission Required
            </Text>
            <Text className="text-neutral-400 dark:text-neutral-500 text-center mt-2 mb-6">
              We need camera access to analyze your ingredients
            </Text>
            <Button title="Grant Permission" onPress={requestPermission} />
          </View>
        ) : capturedImage ? (
          // Preview captured image
          <View className="flex-1">
            <Image
              source={{ uri: capturedImage }}
              className="flex-1"
              resizeMode="contain"
            />

            {/* Action buttons */}
            <View className="absolute bottom-12 left-0 right-0 px-8">
              <View className="flex-row justify-between">
                <TouchableOpacity
                  onPress={handleRetake}
                  className="w-16 h-16 rounded-full bg-white/20 items-center justify-center"
                >
                  <Ionicons name="refresh" size={28} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirm}
                  className="w-20 h-20 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Ionicons name="checkmark" size={36} color="white" />
                </TouchableOpacity>

                <View className="w-16" />
              </View>
            </View>
          </View>
        ) : (
          // Camera view - no children, overlay is positioned absolutely
          <View style={{ flex: 1 }}>
            <CameraView
              ref={cameraRef}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              facing={facing}
            />

            {/* Overlay UI - absolutely positioned */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {/* Center guide */}
              <View className="flex-1 items-center justify-center">
                <View className="w-72 h-72 border-2 border-white/30 rounded-3xl" />
              </View>

              {/* Camera controls */}
              <View className="absolute bottom-12 left-0 right-0 px-8">
                <View className="flex-row items-center justify-between">
                  {/* Gallery button */}
                  <TouchableOpacity
                    onPress={handlePickImage}
                    className="w-14 h-14 rounded-full bg-white/20 items-center justify-center"
                  >
                    <Ionicons name="images-outline" size={24} color="white" />
                  </TouchableOpacity>

                  {/* Capture button */}
                  <TouchableOpacity
                    onPress={handleCapture}
                    className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
                  >
                    <View className="w-16 h-16 rounded-full bg-white" />
                  </TouchableOpacity>

                  {/* Flip camera button */}
                  <TouchableOpacity
                    onPress={toggleCameraFacing}
                    className="w-14 h-14 rounded-full bg-white/20 items-center justify-center"
                  >
                    <Ionicons name="camera-reverse-outline" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};
