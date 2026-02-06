import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ingredient } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRecipe } from '@/hooks/useRecipes';
import { usePortionAnalysis, useCookingTips } from '@/hooks/useAI';
import { useRemainingUsage } from '@/hooks/useSubscription';
import { useVoiceControl, useCookingTimers, useVoiceCommandHandler, useRemainingVoiceUses } from '@/hooks/useVoice';
import { CameraCapture, PortionAnalysisResult, PortionAnalysisLoading } from '@/components/camera';
import { IngredientList, CookingModeInstruction, NutritionCard } from '@/components/recipe';
import { Loading, Card, Button } from '@/components/ui';
import { Paywall, UsageBadge } from '@/components/subscription';
import { VoiceButton, VoiceOverlay, FloatingTimerStrip } from '@/components/voice';
import { formatInstructionForSpeech } from '@/services/voiceService';

type CookingStage = 'prep' | 'cooking' | 'done';

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recipe, isLoading } = useRecipe(id);
  const { tips, fetchTips } = useCookingTips();
  const { result: portionResult, isAnalyzing, analyzeImage, clear: clearPortionResult, accessDenied } = usePortionAnalysis();
  const { remainingPortion } = useRemainingUsage();

  // Voice control hooks
  const {
    isInitialized: voiceInitialized,
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    lastCommand,
    error: voiceError,
    state: voiceState,
    accessDenied: voiceAccessDenied,
    isWakeWordMode,
    isWakeWordListening,
    toggleListening,
    speakText,
    checkVoiceAccess,
    clearError: clearVoiceError,
    enableWakeWordMode,
    disableWakeWordMode,
    toggleWakeWordMode,
  } = useVoiceControl();

  const {
    timers,
    createTimer,
    pauseTimer,
    resumeTimer,
    removeTimer,
    formatTime,
  } = useCookingTimers();

  const remainingVoice = useRemainingVoiceUses();

  const [stage, setStage] = useState<CookingStage>('prep');
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [showCamera, setShowCamera] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<'Portion Analysis' | 'Voice Hands-Free'>('Portion Analysis');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [servings, setServings] = useState(4);

  useEffect(() => {
    if (recipe) {
      setServings(recipe.servings);
      fetchTips(recipe);
    }
  }, [recipe]);

  // Cleanup wake word mode on unmount
  useEffect(() => {
    return () => {
      if (isWakeWordMode) {
        disableWakeWordMode();
      }
    };
  }, [isWakeWordMode]);

  const handleToggleIngredient = (name: string) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(name)) {
      newChecked.delete(name);
    } else {
      newChecked.add(name);
    }
    setCheckedIngredients(newChecked);
  };

  const handleNextStep = () => {
    if (recipe && currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setStage('done');
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartCooking = () => {
    setStage('cooking');
    setCurrentStep(0);
  };

  // Handle voice command for reading step
  useEffect(() => {
    if (lastCommand?.command === 'read_step' && recipe && stage === 'cooking') {
      const text = formatInstructionForSpeech(
        recipe.instructions[currentStep],
        currentStep + 1,
        recipe.instructions.length
      );
      speakText(text);
    }
  }, [lastCommand]);

  // Voice command handler
  useVoiceCommandHandler(
    currentStep,
    recipe?.instructions.length || 0,
    recipe?.ingredients || [],
    handleNextStep,
    handlePrevStep
  );

  const handleCapture = async (imageUri: string) => {
    setCapturedImage(imageUri);
    setShowCamera(false);
    if (recipe) {
      const result = await analyzeImage(imageUri, recipe);
      // If access was denied, show the paywall
      if (!result && accessDenied) {
        setPaywallFeature('Portion Analysis');
        setShowPaywall(true);
      }
    }
  };

  const handleVoicePress = async () => {
    // Check access first
    const access = await checkVoiceAccess();
    if (!access.allowed) {
      setPaywallFeature('Voice Hands-Free');
      setShowPaywall(true);
      return;
    }
    setShowVoiceOverlay(true);
  };

  const handleToggleVoiceListening = async () => {
    const started = await toggleListening();
    // If it failed and we have access denied, show paywall
    if (!started && voiceAccessDenied) {
      setPaywallFeature('Voice Hands-Free');
      setShowPaywall(true);
    }
  };

  const handleToggleHandsFreeMode = async () => {
    // Check access first
    const access = await checkVoiceAccess();
    if (!access.allowed) {
      setPaywallFeature('Voice Hands-Free');
      setShowPaywall(true);
      return;
    }

    if (isWakeWordMode) {
      await disableWakeWordMode();
    } else {
      await enableWakeWordMode();
    }
  };

  const handleExit = () => {
    Alert.alert(
      'Exit Cooking Mode',
      'Are you sure you want to exit? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const adjustServings = (delta: number) => {
    setServings(Math.max(1, servings + delta));
  };

  // Scale ingredients based on servings
  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    const scale = servings / recipe.servings;
    return recipe.ingredients.map((ingredient): Ingredient => ({
      ...ingredient,
      amount: Math.round(ingredient.amount * scale * 100) / 100, // Round to 2 decimal places
      calories: ingredient.calories ? Math.round(ingredient.calories * scale) : 0,
    }));
  }, [recipe, servings]);

  if (isLoading || !recipe) {
    return <Loading fullScreen message="Loading recipe..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'top', 'bottom']}>
      {/* Floating timer strip */}
      {timers.length > 0 && (
        <FloatingTimerStrip
          timers={timers}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onRemove={removeTimer}
          formatTime={formatTime}
        />
      )}

      {/* Header */}
      <View className={`flex-row items-center justify-between px-4 py-3 border-b border-neutral-100 ${timers.length > 0 ? 'mt-14' : ''}`}>
        <TouchableOpacity onPress={handleExit}>
          <Ionicons name="close" size={28} color="#404040" />
        </TouchableOpacity>
        <View className="items-center flex-1 mx-4">
          <Text className="text-lg font-bold text-neutral-900" numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text className="text-sm text-neutral-500">
            {stage === 'prep'
              ? 'Preparation'
              : stage === 'cooking'
              ? `Step ${currentStep + 1} of ${recipe.instructions.length}`
              : 'Complete!'}
          </Text>
        </View>
        <View className="flex-row items-center">
          {/* Voice button */}
          {voiceInitialized && (
            <TouchableOpacity onPress={handleVoicePress} className="mr-2">
              <View className="flex-row items-center">
                {remainingVoice !== 0 && (
                  <UsageBadge remaining={remainingVoice} size="small" />
                )}
                <View className="relative">
                  <Ionicons
                    name={isWakeWordMode ? 'radio' : isListening ? 'mic' : 'mic-outline'}
                    size={26}
                    color={isWakeWordMode ? '#22C55E' : isListening ? '#FF6B35' : remainingVoice === 0 ? '#D4D4D4' : '#FF6B35'}
                  />
                  {isWakeWordListening && (
                    <View className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          {/* Camera button */}
          <TouchableOpacity onPress={() => setShowCamera(true)} className="flex-row items-center">
            <UsageBadge remaining={remainingPortion} size="small" />
            <Ionicons name="camera-outline" size={26} color="#FF6B35" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      {stage === 'prep' && (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Recipe image */}
          <Image
            source={{ uri: recipe.imageURL }}
            className="w-full h-48"
            resizeMode="cover"
          />

          <View className="p-4">
            {/* Servings adjuster */}
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium text-neutral-900">
                  Servings
                </Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => adjustServings(-1)}
                    className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
                  >
                    <Ionicons name="remove" size={20} color="#404040" />
                  </TouchableOpacity>
                  <Text className="mx-4 text-xl font-bold text-neutral-900 w-8 text-center">
                    {servings}
                  </Text>
                  <TouchableOpacity
                    onPress={() => adjustServings(1)}
                    className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center"
                  >
                    <Ionicons name="add" size={20} color="#404040" />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Voice hint card with hands-free toggle */}
            {voiceInitialized && remainingVoice !== 0 && (
              <Card className={`mb-4 border ${isWakeWordMode ? 'bg-green-50 border-green-200' : 'bg-primary-50 border-primary-200'}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isWakeWordMode ? 'bg-green-100' : 'bg-primary-100'}`}>
                      <Ionicons name={isWakeWordMode ? 'radio' : 'mic'} size={20} color={isWakeWordMode ? '#22C55E' : '#FF6B35'} />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-semibold ${isWakeWordMode ? 'text-green-800' : 'text-primary-800'}`}>
                        {isWakeWordMode ? 'Hands-Free Mode Active' : 'Voice Control Available'}
                      </Text>
                      <Text className={`text-sm ${isWakeWordMode ? 'text-green-600' : 'text-primary-600'}`}>
                        {isWakeWordMode
                          ? 'Say "SousChef" followed by a command'
                          : 'Enable hands-free or tap mic to use voice'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleToggleHandsFreeMode}
                    className={`px-3 py-2 rounded-lg ${isWakeWordMode ? 'bg-green-200' : 'bg-primary-200'}`}
                  >
                    <Text className={`font-semibold text-sm ${isWakeWordMode ? 'text-green-800' : 'text-primary-800'}`}>
                      {isWakeWordMode ? 'Disable' : 'Hands-Free'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {isWakeWordListening && (
                  <View className="flex-row items-center mt-2 pt-2 border-t border-green-200">
                    <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                    <Text className="text-green-700 text-xs">
                      Listening for "SousChef"...
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Tips */}
            {tips.length > 0 && (
              <Card className="mb-4 bg-amber-50 border border-amber-200">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="bulb" size={20} color="#D97706" />
                  <Text className="text-amber-800 font-semibold ml-2">
                    Cooking Tips
                  </Text>
                </View>
                {tips.map((tip, idx) => (
                  <Text key={idx} className="text-amber-700 text-sm mb-1">
                    • {tip}
                  </Text>
                ))}
              </Card>
            )}

            {/* Ingredients checklist */}
            <Text className="text-xl font-bold text-neutral-900 mb-3">
              Gather Your Ingredients
              {servings !== recipe.servings && (
                <Text className="text-sm font-normal text-primary-500">
                  {' '}(scaled for {servings} servings)
                </Text>
              )}
            </Text>
            <Card variant="outlined">
              <IngredientList
                ingredients={scaledIngredients}
                checkedItems={checkedIngredients}
                onToggleItem={handleToggleIngredient}
                showCalories
              />
            </Card>

            {/* Captured image preview (shown during and after analysis) */}
            {capturedImage && !portionResult && !accessDenied && (
              <View className="mt-4">
                <Text className="text-lg font-bold text-neutral-900 mb-3">
                  {isAnalyzing ? 'Analyzing Your Photo...' : 'Captured Photo'}
                </Text>
                <Card>
                  <Image
                    source={{ uri: capturedImage }}
                    className="w-full h-48 rounded-lg"
                    resizeMode="cover"
                  />
                </Card>
              </View>
            )}

            {/* Portion analysis result */}
            {portionResult && capturedImage && (
              <View className="mt-4">
                <Text className="text-lg font-bold text-neutral-900 mb-3">
                  Portion Analysis
                </Text>
                <PortionAnalysisResult
                  imageUri={capturedImage}
                  analysis={portionResult}
                />
              </View>
            )}

            {/* Access denied message */}
            {accessDenied && capturedImage && !portionResult && (
              <Card className="mt-4 bg-amber-50 border border-amber-200">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="warning" size={20} color="#D97706" />
                  <Text className="text-amber-800 font-semibold ml-2">
                    Upgrade Required
                  </Text>
                </View>
                <Text className="text-amber-700 text-sm mb-3">
                  {accessDenied.reason === 'limit_reached'
                    ? `You've reached your daily limit of ${accessDenied.limit} portion analyses.`
                    : 'Portion analysis is a premium feature.'}
                </Text>
                <Button
                  title="Upgrade to Continue"
                  variant="primary"
                  size="sm"
                  onPress={() => {
                    setPaywallFeature('Portion Analysis');
                    setShowPaywall(true);
                  }}
                  leftIcon={<Ionicons name="star" size={16} color="white" />}
                />
              </Card>
            )}

            {/* Start button */}
            <View className="mt-6">
              <Button
                title="Start Cooking"
                onPress={handleStartCooking}
                fullWidth
                leftIcon={<Ionicons name="flame" size={20} color="white" />}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {stage === 'cooking' && (
        <View className="flex-1 p-4">
          <View className="flex-1 justify-center">
            <CookingModeInstruction
              instruction={recipe.instructions[currentStep]}
              stepNumber={currentStep + 1}
              totalSteps={recipe.instructions.length}
              onPrevious={handlePrevStep}
              onNext={handleNextStep}
              canGoPrevious={currentStep > 0}
              canGoNext={currentStep < recipe.instructions.length - 1}
            />
          </View>

          {/* Voice control hint during cooking */}
          {voiceInitialized && remainingVoice !== 0 && (
            <View className="items-center py-2 mb-2">
              <View className="flex-row items-center">
                <Ionicons
                  name={isWakeWordMode ? 'radio' : 'mic-outline'}
                  size={16}
                  color={isWakeWordMode ? '#22C55E' : '#737373'}
                />
                <Text className={`text-sm ml-1 ${isWakeWordMode ? 'text-green-600' : 'text-neutral-500'}`}>
                  {isWakeWordMode
                    ? 'Say "SousChef next" or "SousChef back"'
                    : 'Say "next" or "back" to navigate'}
                </Text>
              </View>
              {!isWakeWordMode && (
                <TouchableOpacity onPress={handleToggleHandsFreeMode} className="mt-1">
                  <Text className="text-primary-500 text-xs underline">
                    Enable hands-free mode
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick ingredient reference */}
          <TouchableOpacity
            onPress={() => setStage('prep')}
            className="flex-row items-center justify-center py-3 bg-neutral-100 rounded-xl mt-2"
          >
            <Ionicons name="list" size={20} color="#737373" />
            <Text className="text-neutral-600 ml-2">View Ingredients</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === 'done' && (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="items-center py-12 px-4">
            <View className="w-24 h-24 rounded-full bg-secondary-100 items-center justify-center mb-6">
              <Ionicons name="checkmark-circle" size={60} color="#22C55E" />
            </View>
            <Text className="text-2xl font-bold text-neutral-900 mb-2">
              Great job, Chef!
            </Text>
            <Text className="text-neutral-500 text-center mb-8">
              You've completed {recipe.title}. Enjoy your meal!
            </Text>

            {/* Nutrition summary */}
            <View className="w-full">
              <NutritionCard
                nutrition={recipe.nutrition}
                servings={servings}
                compact
              />
            </View>

            {/* Actions */}
            <View className="w-full mt-8 space-y-3">
              <Button
                title="Share Your Creation"
                variant="primary"
                fullWidth
                leftIcon={<Ionicons name="camera" size={20} color="white" />}
                onPress={() => setShowCamera(true)}
              />
              <Button
                title="Back to Home"
                variant="outline"
                fullWidth
                onPress={() => router.push('/(tabs)')}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Camera modal */}
      <CameraCapture
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCapture}
        title="Portion Analysis"
        description="Take a photo of your ingredients"
      />

      {/* Voice overlay modal */}
      <VoiceOverlay
        visible={showVoiceOverlay}
        onClose={() => setShowVoiceOverlay(false)}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isProcessing={isProcessing}
        state={voiceState}
        transcript={transcript}
        lastCommand={lastCommand}
        error={voiceError}
        onToggleListening={handleToggleVoiceListening}
        isWakeWordMode={isWakeWordMode}
        isWakeWordListening={isWakeWordListening}
        onToggleWakeWordMode={handleToggleHandsFreeMode}
      />

      {/* Loading overlay for portion analysis */}
      {isAnalyzing && (
        <View className="absolute inset-0 bg-white">
          <PortionAnalysisLoading />
        </View>
      )}

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={paywallFeature}
        requiredTier={
          paywallFeature === 'Voice Hands-Free'
            ? voiceAccessDenied?.upgradeRequired || 'premium'
            : accessDenied?.upgradeRequired || 'premium'
        }
      />
    </SafeAreaView>
  );
}
