import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, UButton, FONT } from '@/components/ui';

interface InstructionListProps {
  instructions: string[];
  currentStep?: number;
  onStepPress?: (stepIndex: number) => void;
  editable?: boolean;
  onRemoveStep?: (index: number) => void;
}

export const InstructionList: React.FC<InstructionListProps> = ({
  instructions,
  currentStep,
  onStepPress,
  editable = false,
  onRemoveStep,
}) => {
  return (
    <View style={{ gap: 16 }}>
      {instructions.map((instruction, index) => (
        <InstructionStep
          key={index}
          stepNumber={index + 1}
          instruction={instruction}
          isActive={currentStep === index}
          isCompleted={currentStep !== undefined && index < currentStep}
          onPress={onStepPress ? () => onStepPress(index) : undefined}
          editable={editable}
          onRemove={onRemoveStep ? () => onRemoveStep(index) : undefined}
        />
      ))}
    </View>
  );
};

interface InstructionStepProps {
  stepNumber: number;
  instruction: string;
  isActive?: boolean;
  isCompleted?: boolean;
  onPress?: () => void;
  editable?: boolean;
  onRemove?: () => void;
}

export const InstructionStep: React.FC<InstructionStepProps> = ({
  stepNumber,
  instruction,
  isActive = false,
  isCompleted = false,
  onPress,
  editable = false,
  onRemove,
}) => {
  const { t } = useTranslation();
  const badge = isCompleted ? 'bg-ink' : isActive ? 'bg-accent' : 'bg-surface-3';
  const content = (
    <View className="flex-row" style={{ gap: 14 }}>
      <View className={`items-center justify-center ${badge}`} style={{ width: 32, height: 32, borderRadius: 16 }}>
        {isCompleted ? (
          <Icon name="check" size="sm" color="ink-inverse" />
        ) : (
          <Text
            className={isActive ? 'text-accent-ink' : 'text-muted'}
            style={{ fontFamily: FONT.display, fontSize: 13 }}
          >
            {stepNumber}
          </Text>
        )}
      </View>

      <View className="flex-1" style={{ paddingTop: 5 }}>
        <Text
          className={isCompleted ? 'text-subtle' : 'text-ink'}
          style={{ fontFamily: FONT.sans, fontSize: 15, lineHeight: 22 }}
        >
          {instruction}
        </Text>
      </View>

      {editable && onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('cooking.removeStep', 'Remove step')}
          className="items-center justify-center bg-surface-3"
          style={{ width: 34, height: 34, borderRadius: 17 }}
          hitSlop={5}
        >
          <Icon name="close" size="sm" />
        </Pressable>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
};

// Compact instruction list for previews
interface CompactInstructionListProps {
  instructions: string[];
  maxVisible?: number;
}

export const CompactInstructionList: React.FC<CompactInstructionListProps> = ({
  instructions,
  maxVisible = 3,
}) => {
  const { t } = useTranslation();
  const visibleInstructions = instructions.slice(0, maxVisible);
  const remaining = instructions.length - maxVisible;

  return (
    <View style={{ gap: 4 }}>
      {visibleInstructions.map((instruction, index) => (
        <View key={index} className="flex-row items-start" style={{ gap: 8 }}>
          <Text className="text-accent-text" style={{ fontFamily: FONT.sansMedium, fontSize: 13, width: 20 }}>
            {index + 1}.
          </Text>
          <Text className="flex-1 text-ink" style={{ fontFamily: FONT.sans, fontSize: 13 }} numberOfLines={2}>
            {instruction}
          </Text>
        </View>
      ))}
      {remaining > 0 ? (
        <Text className="text-subtle" style={{ fontFamily: FONT.sans, fontSize: 12, marginLeft: 28 }}>
          {t('cooking.moreSteps', '+{{count}} more steps', { count: remaining })}
        </Text>
      ) : null}
    </View>
  );
};

// Interactive cooking mode instruction display
interface CookingModeInstructionProps {
  instruction: string;
  stepNumber: number;
  totalSteps: number;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
}

export const CookingModeInstruction: React.FC<CookingModeInstructionProps> = ({
  instruction,
  stepNumber,
  totalSteps,
  onPrevious,
  onNext,
  canGoPrevious = true,
  canGoNext = true,
}) => {
  const { t } = useTranslation();
  return (
    <View className="bg-surface" style={{ borderRadius: 28, padding: 18, gap: 16 }}>
      <Text className="text-muted" style={{ fontFamily: FONT.sansMedium, fontSize: 12 }}>
        {t('cooking.stepOf', 'Step {{current}} of {{total}}', { current: stepNumber, total: totalSteps })}
      </Text>
      <Text className="text-ink" style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 }}>
        {instruction}
      </Text>
      <View className="flex-row" style={{ gap: 10 }}>
        <View style={{ width: 120 }}>
          <UButton
            label={t('cooking.prev', 'Prev')}
            variant="ghost"
            size="sm"
            onPress={onPrevious}
            disabled={!canGoPrevious}
          />
        </View>
        <View className="flex-1">
          <UButton
            label={canGoNext ? t('cooking.nextStep', 'Next Step') : t('cooking.finish', 'Finish')}
            variant="accent"
            size="sm"
            onPress={onNext}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </View>
    </View>
  );
};
