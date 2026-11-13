import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Icon, Tag, ToneScope, UButton, UIconButton, FONT } from '@/components/ui';

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
  title,
  description,
}) => {
  const { t } = useTranslation();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const heading = title ?? t('cooking.takePhoto', 'Take a Photo');
  const sub = description ?? t('cooking.positionIngredients', 'Position your ingredients in the frame');

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
      <ToneScope tone="dark">
        {/* Header - always shows the close button */}
        <View
          className="flex-row items-center justify-between"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: 58, paddingHorizontal: 20, gap: 12 }}
        >
          <UIconButton icon="close" label={t('cooking.close', 'Close')} tone="glassDark" onPress={onClose} />
          {permission.granted ? (
            <View className="items-center" style={{ gap: 4, flexShrink: 1 }}>
              <Tag label={heading} tone="glassDark" large />
              <Text className="text-muted text-center" style={{ fontFamily: FONT.sans, fontSize: 12 }}>
                {sub}
              </Text>
            </View>
          ) : null}
          <View style={{ width: 46 }} />
        </View>

        {!permission.granted ? (
          <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 32, gap: 12 }}>
            <View className="items-center justify-center bg-surface-3" style={{ width: 88, height: 88, borderRadius: 44 }}>
              <Icon name="camera" size="lg" color="muted" />
            </View>
            <Text className="text-ink text-center" style={{ fontFamily: FONT.display, fontSize: 22 }}>
              {t('cooking.cameraNeeded', 'Camera Access Needed')}
            </Text>
            <Text className="text-muted text-center" style={{ fontFamily: FONT.sans, fontSize: 14, marginBottom: 16 }}>
              {t('cooking.cameraWhy', 'To analyze your ingredients or food, SousChef needs access to your camera.')}
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <UButton label={t('cooking.continue', 'Continue')} variant="accent" onPress={requestPermission} />
            </View>
          </View>
        ) : capturedImage ? (
          <View className="flex-1">
            <Image source={{ uri: capturedImage }} style={{ flex: 1 }} contentFit="contain" />

            <View style={{ position: 'absolute', bottom: 48, left: 20, right: 20, flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 120 }}>
                <UButton label={t('cooking.retake', 'Retake')} variant="ghost" icon="refresh" onPress={handleRetake} />
              </View>
              <View className="flex-1">
                <UButton label={t('cooking.usePhoto', 'Use Photo')} variant="accent" icon="check" onPress={handleConfirm} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              ref={cameraRef}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              facing={facing}
            />

            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
              {/* Center guide */}
              <View className="flex-1 items-center justify-center" pointerEvents="none">
                <View
                  className="border-paper"
                  style={{ width: 288, height: 288, borderRadius: 30, borderWidth: 2, opacity: 0.3 }}
                />
              </View>

              {/* Camera controls */}
              <View
                className="flex-row items-center justify-between"
                style={{ position: 'absolute', bottom: 48, left: 32, right: 32 }}
              >
                <UIconButton icon="image" label={t('cooking.gallery', 'Choose from gallery')} tone="glassDark" size={56} onPress={handlePickImage} />

                <Pressable
                  onPress={handleCapture}
                  accessibilityRole="button"
                  accessibilityLabel={t('cooking.capture', 'Take photo')}
                  className="items-center justify-center border-paper"
                  style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 4 }}
                >
                  <View className="bg-paper" style={{ width: 62, height: 62, borderRadius: 31 }} />
                </Pressable>

                <UIconButton icon="refresh" label={t('cooking.flipCamera', 'Flip camera')} tone="glassDark" size={56} onPress={toggleCameraFacing} />
              </View>
            </View>
          </View>
        )}
      </ToneScope>
    </Modal>
  );
};
