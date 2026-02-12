import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePortionAnalysis } from '@/hooks/useAI';
import { useRemainingUsage } from '@/hooks/useSubscription';
import { CameraCapture, PortionAnalysisResult, PortionAnalysisLoading } from '@/components/camera';
import { Card, Button } from '@/components/ui';
import { Paywall, UsageBadge } from '@/components/subscription';

export default function ScanScreen() {
  const router = useRouter();
  const { result: portionResult, isAnalyzing, analyzeImage, clear: clearPortionResult, accessDenied } = usePortionAnalysis();
  const { remainingPortion } = useRemainingUsage();

  const [showCamera, setShowCamera] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const handleCapture = async (imageUri: string) => {
    setCapturedImage(imageUri);
    setShowCamera(false);
    // Analyze without a specific recipe - just general food analysis
    const result = await analyzeImage(imageUri);
    if (!result && accessDenied) {
      setShowPaywall(true);
    }
  };

  const handleDismissResult = () => {
    setCapturedImage(null);
    clearPortionResult();
  };

  const handleNewScan = () => {
    setCapturedImage(null);
    clearPortionResult();
    setShowCamera(true);
  };

  const handleRescan = async (ingredientHints: string[]) => {
    if (!capturedImage) return;
    await analyzeImage(capturedImage, undefined, ingredientHints);
  };

  const handleStartScan = () => {
    if (remainingPortion === 0) {
      setShowPaywall(true);
      return;
    }
    setShowCamera(true);
  };

  return (
    <View className="flex-1 bg-neutral-50">
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* Integrated Hero Header */}
        <View className="w-full h-80 relative overflow-hidden">
          <LinearGradient
            colors={['#FF6B35', '#FF8F5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0"
          />
          
          {/* Decorative AR Scanning Elements */}
          <View className="absolute inset-8 border border-white/20 rounded-3xl" />
          <View className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/40 m-12 rounded-tl-lg" />
          <View className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/40 m-12 rounded-tr-lg" />
          <View className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/40 m-12 rounded-bl-lg" />
          <View className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/40 m-12 rounded-br-lg" />

          {/* Header Content (Overlaid on Image) */}
          <SafeAreaView edges={['top']} className="px-6 pt-6">
            <View className="flex-row items-center">
              <TouchableOpacity 
                onPress={() => router.back()} 
                className="w-10 h-10 items-center justify-center -ml-2 bg-white/20 rounded-full"
              >
                <Ionicons name="chevron-back" size={28} color="white" />
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-white ml-2">
                Food Scanner
              </Text>
              <View className="flex-1" />
              <View className="flex-row items-center bg-white/20 px-3 py-1.5 rounded-full">
                <Ionicons name="scan" size={16} color="white" />
                <Text className="text-white text-sm font-medium ml-1">
                  {remainingPortion === 'unlimited' ? 'Unlimited' : `${remainingPortion} left`}
                </Text>
              </View>
            </View>
          </SafeAreaView>

          {/* Hero Graphic */}
          <View className="flex-1 items-center justify-center -mt-6">
            <View className="w-24 h-24 rounded-full bg-white/10 items-center justify-center mb-3">
              <Ionicons name="nutrition" size={48} color="white" />
            </View>
            <Text className="text-white text-xl font-bold">Food Analysis</Text>
            <Text className="text-white/80 text-sm px-12 text-center mt-1">
              Instant calorie estimates and nutritional breakdown
            </Text>
          </View>
        </View>

        <View className="px-4 -mt-8">
          {/* Main scan card */}
          {!capturedImage && !portionResult && (
            <Card className="bg-white shadow-lg">
              <View className="items-center py-8">
                <View className="w-24 h-24 rounded-full bg-primary-100 items-center justify-center mb-4">
                  <Ionicons name="camera" size={48} color="#FF6B35" />
                </View>
                <Text className="text-xl font-bold text-neutral-900 mb-2">
                  Ready to Scan
                </Text>
                <Text className="text-neutral-500 text-center mb-6 px-4">
                  Take a photo of your food to get instant calorie estimates and nutritional breakdown
                </Text>
                <Button
                  title="Start Scanning"
                  onPress={handleStartScan}
                  fullWidth
                  leftIcon={<Ionicons name="scan" size={20} color="white" />}
                />
              </View>
            </Card>
          )}

          {/* Captured image preview during analysis */}
          {capturedImage && isAnalyzing && (
            <Card className="bg-white shadow-lg">
              <Image
                source={{ uri: capturedImage }}
                className="w-full h-64 mb-4"
                style={{ borderRadius: 24 }}
                resizeMode="cover"
              />
              <View className="items-center py-4">
                <View className="flex-row items-center">
                  <Ionicons name="nutrition" size={24} color="#FF6B35" />
                  <Text className="text-lg font-semibold text-neutral-900 ml-2">
                    Analyzing your food...
                  </Text>
                </View>
                <Text className="text-neutral-500 text-sm mt-2">
                  Identifying ingredients and calculating nutrition
                </Text>
              </View>
            </Card>
          )}

          {/* Analysis results */}
          {portionResult && capturedImage && (
            <View>
              <PortionAnalysisResult
                imageUri={capturedImage}
                analysis={portionResult}
                onClose={handleDismissResult}
                onRescan={handleRescan}
                isRescanning={isAnalyzing}
              />
              <View className="mt-4">
                <Button
                  title="Scan Another Food"
                  variant="outline"
                  onPress={handleNewScan}
                  fullWidth
                  leftIcon={<Ionicons name="camera-outline" size={20} color="#FF6B35" />}
                />
              </View>
            </View>
          )}

          {/* Access denied state */}
          {accessDenied && capturedImage && !portionResult && !isAnalyzing && (
            <Card className="bg-amber-50 border border-amber-200">
              <View className="items-center py-6">
                <View className="w-16 h-16 rounded-full bg-amber-100 items-center justify-center mb-4">
                  <Ionicons name="lock-closed" size={32} color="#D97706" />
                </View>
                <Text className="text-lg font-bold text-amber-800 mb-2">
                  Upgrade Required
                </Text>
                <Text className="text-amber-700 text-center mb-4 px-4">
                  {accessDenied.reason === 'limit_reached'
                    ? `You've reached your daily limit of ${accessDenied.limit} scans.`
                    : 'Food scanning is a premium feature.'}
                </Text>
                <Button
                  title="Upgrade Now"
                  onPress={() => setShowPaywall(true)}
                  leftIcon={<Ionicons name="star" size={20} color="white" />}
                />
              </View>
            </Card>
          )}

          {/* How it works */}
          {!capturedImage && !portionResult && (
            <View className="mt-6">
              <Text className="text-lg font-bold text-neutral-900 mb-4">
                How It Works
              </Text>
              <View className="space-y-3">
                <HowItWorksStep
                  number={1}
                  icon="camera-outline"
                  title="Take a Photo"
                  description="Snap a picture of any food or meal"
                />
                <HowItWorksStep
                  number={2}
                  icon="sparkles"
                  title="AI Analysis"
                  description="Our AI identifies ingredients and portions"
                />
                <HowItWorksStep
                  number={3}
                  icon="nutrition-outline"
                  title="Get Results"
                  description="View calories and nutritional breakdown"
                />
              </View>
            </View>
          )}

          {/* Quick tips */}
          {!capturedImage && !portionResult && (
            <Card className="mt-6 bg-blue-50 border border-blue-200 mb-32">
              <View className="flex-row items-start">
                <Ionicons name="bulb" size={20} color="#2563EB" />
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-blue-800 mb-1">
                    Tips for Better Results
                  </Text>
                  <Text className="text-blue-700 text-sm">
                    {'\u2022'} Use good lighting{'\n'}
                    {'\u2022'} Capture the entire plate{'\n'}
                    {'\u2022'} Avoid blurry images{'\n'}
                    {'\u2022'} Include a reference object for scale
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Full screen loading overlay */}
      {isAnalyzing && (
        <View className="absolute inset-0 bg-white">
          <PortionAnalysisLoading />
        </View>
      )}

      {/* Camera modal */}
      <CameraCapture
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCapture}
        title="Scan Food"
        description="Take a photo of your food for calorie analysis"
      />

      {/* Paywall modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="Portion Analysis"
        requiredTier={accessDenied?.upgradeRequired || 'premium'}
      />
    </View>
  );
}

interface HowItWorksStepProps {
  number: number;
  icon: string;
  title: string;
  description: string;
}

const HowItWorksStep: React.FC<HowItWorksStepProps> = ({ number, icon, title, description }) => (
  <Card variant="outlined" className="flex-row items-center p-3">
    <View className="w-10 h-10 rounded-full bg-primary-100 items-center justify-center">
      <Text className="text-primary-600 font-bold">{number}</Text>
    </View>
    <View className="flex-1 ml-3">
      <View className="flex-row items-center">
        <Ionicons name={icon as any} size={16} color="#FF6B35" />
        <Text className="font-semibold text-neutral-900 ml-1">{title}</Text>
      </View>
      <Text className="text-neutral-500 text-sm">{description}</Text>
    </View>
  </Card>
);
