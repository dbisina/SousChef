import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    <View className="space-y-4">
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
  const content = (
    <View className="flex-row">
      {/* Step number */}
      <View
        className={`
          w-8 h-8 rounded-full items-center justify-center mr-4
          ${isCompleted ? 'bg-secondary-500' : isActive ? 'bg-primary-500' : 'bg-neutral-200'}
        `}
      >
        {isCompleted ? (
          <Ionicons name="checkmark" size={18} color="white" />
        ) : (
          <Text
            className={`text-sm font-bold ${isActive ? 'text-white' : 'text-neutral-600'}`}
          >
            {stepNumber}
          </Text>
        )}
      </View>

      {/* Instruction text */}
      <View className="flex-1">
        <Text
          className={`
            text-base leading-relaxed
            ${isCompleted ? 'text-neutral-400' : 'text-neutral-800'}
          `}
        >
          {instruction}
        </Text>
      </View>

      {/* Remove button for edit mode */}
      {editable && onRemove && (
        <TouchableOpacity onPress={onRemove} className="ml-2 p-1">
          <Ionicons name="close-circle" size={22} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
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
  const visibleInstructions = instructions.slice(0, maxVisible);
  const remaining = instructions.length - maxVisible;

  return (
    <View>
      {visibleInstructions.map((instruction, index) => (
        <View key={index} className="flex-row items-start py-1">
          <Text className="text-sm font-medium text-primary-500 w-6">
            {index + 1}.
          </Text>
          <Text className="flex-1 text-sm text-neutral-700" numberOfLines={2}>
            {instruction}
          </Text>
        </View>
      ))}
      {remaining > 0 && (
        <Text className="text-sm text-neutral-400 mt-1 ml-6">
          +{remaining} more steps
        </Text>
      )}
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
  return (
    <View className="bg-white rounded-2xl p-6 shadow-lg">
      {/* Progress */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-sm font-medium text-neutral-500">
          Step {stepNumber} of {totalSteps}
        </Text>
        <View className="flex-row">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <View
              key={idx}
              className={`
                w-2 h-2 rounded-full mx-0.5
                ${idx < stepNumber ? 'bg-primary-500' : 'bg-neutral-200'}
              `}
            />
          ))}
        </View>
      </View>

      {/* Instruction */}
      <Text className="text-xl leading-relaxed text-neutral-900 mb-6">
        {instruction}
      </Text>

      {/* Navigation */}
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onPrevious}
          disabled={!canGoPrevious}
          className={`
            flex-row items-center px-4 py-2 rounded-lg
            ${canGoPrevious ? 'bg-neutral-100' : 'opacity-40'}
          `}
        >
          <Ionicons name="arrow-back" size={20} color="#404040" />
          <Text className="ml-2 font-medium text-neutral-700">Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNext}
          disabled={!canGoNext}
          className={`
            flex-row items-center px-4 py-2 rounded-lg
            ${canGoNext ? 'bg-primary-500' : 'bg-secondary-500'}
          `}
        >
          <Text className="mr-2 font-medium text-white">
            {canGoNext ? 'Next' : 'Done!'}
          </Text>
          <Ionicons
            name={canGoNext ? 'arrow-forward' : 'checkmark'}
            size={20}
            color="white"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};
