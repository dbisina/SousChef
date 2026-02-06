import { textModel } from '@/lib/gemini';
import {
  VoiceCommandType,
  VoiceParseResult,
  VoiceCommandParameters,
  VOICE_COMMAND_EXAMPLES,
} from '@/types/voice';
import { Ingredient } from '@/types';

// Prompt for Gemini to parse voice commands
const VOICE_PARSE_PROMPT = `You are a cooking assistant voice parser. Your job is to understand voice commands from someone cooking in a kitchen.

Parse the voice command into one of these actions:
- next_step: Move to the next instruction
- previous_step: Go back to previous instruction
- read_step: Read the current instruction aloud
- read_ingredients: Read the ingredient list
- set_timer: Set a cooking timer (extract minutes)
- current_step: Tell the user what step they're on
- substitute: Ask for ingredient substitution (extract ingredient name)
- help: List available commands
- unknown: Command not recognized

User said: "{transcript}"

Return ONLY a JSON object in this exact format (no markdown, no code blocks):
{"command": "...", "parameters": {"minutes": null, "ingredient": null}, "confidence": 0-100}

For set_timer, extract the number of minutes. Examples:
- "set timer 5 minutes" -> minutes: 5
- "timer for 10 min" -> minutes: 10
- "start a 3 minute timer" -> minutes: 3

For substitute, extract the ingredient name. Examples:
- "substitute for eggs" -> ingredient: "eggs"
- "what can I use instead of butter" -> ingredient: "butter"
- "replace the milk" -> ingredient: "milk"

Be lenient with understanding - users may speak casually or with background noise.`;

// Parse a voice transcript into a command
export const parseVoiceCommand = async (
  transcript: string
): Promise<VoiceParseResult> => {
  const cleanTranscript = transcript.trim().toLowerCase();

  // First try simple pattern matching for common commands
  const quickResult = quickParseCommand(cleanTranscript);
  if (quickResult && quickResult.confidence >= 80) {
    return {
      ...quickResult,
      rawTranscript: transcript,
    };
  }

  // Fall back to AI parsing for complex or ambiguous commands
  try {
    const prompt = VOICE_PARSE_PROMPT.replace('{transcript}', transcript);
    const result = await textModel.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      command: VoiceCommandType;
      parameters: VoiceCommandParameters;
      confidence: number;
    };

    return {
      command: parsed.command || 'unknown',
      parameters: parsed.parameters || {},
      confidence: parsed.confidence || 50,
      rawTranscript: transcript,
    };
  } catch (error) {
    console.error('Error parsing voice command:', error);

    // Return unknown if AI parsing fails
    return {
      command: 'unknown',
      parameters: {},
      confidence: 0,
      rawTranscript: transcript,
    };
  }
};

// Quick pattern matching for common commands
const quickParseCommand = (
  transcript: string
): Omit<VoiceParseResult, 'rawTranscript'> | null => {
  const text = transcript.toLowerCase().trim();

  // Next step patterns
  if (/^(next|continue|go next|next step|okay next|alright next)$/i.test(text)) {
    return { command: 'next_step', parameters: {}, confidence: 95 };
  }

  // Previous step patterns
  if (/^(back|previous|go back|last step|previous step)$/i.test(text)) {
    return { command: 'previous_step', parameters: {}, confidence: 95 };
  }

  // Read step patterns
  if (/^(read|repeat|read this|read step|what does it say|say that again)$/i.test(text)) {
    return { command: 'read_step', parameters: {}, confidence: 95 };
  }

  // Read ingredients patterns
  if (/^(ingredients|what ingredients|list ingredients|what do i need)$/i.test(text)) {
    return { command: 'read_ingredients', parameters: {}, confidence: 95 };
  }

  // Current step patterns
  if (/^(where am i|what step|current step|which step)$/i.test(text)) {
    return { command: 'current_step', parameters: {}, confidence: 95 };
  }

  // Help patterns
  if (/^(help|what can i say|commands|voice commands)$/i.test(text)) {
    return { command: 'help', parameters: {}, confidence: 95 };
  }

  // Timer patterns - extract minutes
  const timerMatch = text.match(
    /(?:set\s+)?timer\s+(?:for\s+)?(\d+)\s*(?:min(?:ute)?s?)?|(\d+)\s*(?:min(?:ute)?s?)\s*timer|start\s+(?:a\s+)?(\d+)\s*(?:min(?:ute)?s?)\s*timer/i
  );
  if (timerMatch) {
    const minutes = parseInt(timerMatch[1] || timerMatch[2] || timerMatch[3], 10);
    if (!isNaN(minutes) && minutes > 0) {
      return { command: 'set_timer', parameters: { minutes }, confidence: 90 };
    }
  }

  // Substitute patterns - extract ingredient
  const substituteMatch = text.match(
    /(?:substitute|replace|swap|what can i use instead of|what can replace)\s+(?:for\s+)?(?:the\s+)?(.+)/i
  );
  if (substituteMatch) {
    const ingredient = substituteMatch[1].trim();
    if (ingredient) {
      return { command: 'substitute', parameters: { ingredient }, confidence: 85 };
    }
  }

  return null;
};

// Generate help text for voice commands
export const getVoiceHelpText = (): string => {
  const commands = [
    '"Next" or "Continue" - Go to next step',
    '"Back" or "Previous" - Go to previous step',
    '"Read this" or "Repeat" - Read current step aloud',
    '"Ingredients" - Read the ingredient list',
    '"Where am I" - Tell me current step number',
    '"Timer 5 minutes" - Set a cooking timer',
    '"Substitute for eggs" - Get ingredient substitution',
    '"Help" - Hear available commands',
  ];

  return commands.join('\n');
};

// Generate spoken help text
export const getVoiceHelpSpeech = (): string => {
  return `You can say: next or continue to go forward. Back or previous to go back.
  Read this to hear the current step. Ingredients to hear the ingredient list.
  Where am I to know your current step. Timer followed by minutes to set a timer.
  Or substitute for an ingredient name to get alternatives.`;
};

// Format ingredients for TTS
export const formatIngredientsForSpeech = (ingredients: Ingredient[]): string => {
  if (ingredients.length === 0) {
    return 'No ingredients found for this recipe.';
  }

  const lines = ingredients.map((ing, idx) => {
    const optional = ing.optional ? ', optional' : '';
    return `${ing.amount} ${ing.unit} of ${ing.name}${optional}`;
  });

  return `You will need: ${lines.join('. ')}`;
};

// Format instruction for TTS
export const formatInstructionForSpeech = (
  instruction: string,
  stepNumber: number,
  totalSteps: number
): string => {
  return `Step ${stepNumber} of ${totalSteps}. ${instruction}`;
};

// Format current step announcement
export const formatCurrentStepSpeech = (
  stepNumber: number,
  totalSteps: number
): string => {
  if (stepNumber === totalSteps) {
    return `You are on step ${stepNumber}, the final step.`;
  }
  return `You are on step ${stepNumber} of ${totalSteps}.`;
};

// Format timer set confirmation
export const formatTimerSetSpeech = (minutes: number, timerName?: string): string => {
  const name = timerName ? ` for ${timerName}` : '';
  if (minutes === 1) {
    return `Timer set${name} for 1 minute.`;
  }
  return `Timer set${name} for ${minutes} minutes.`;
};

// Format timer completion announcement
export const formatTimerDoneSpeech = (timerName?: string): string => {
  if (timerName) {
    return `Your ${timerName} timer is complete!`;
  }
  return 'Your timer is complete!';
};

// Validate command result
export const isValidCommand = (result: VoiceParseResult): boolean => {
  // Require minimum confidence for action
  if (result.confidence < 50) {
    return false;
  }

  // Validate parameters for commands that need them
  if (result.command === 'set_timer') {
    return result.parameters.minutes !== undefined && result.parameters.minutes > 0;
  }

  if (result.command === 'substitute') {
    return result.parameters.ingredient !== undefined && result.parameters.ingredient.length > 0;
  }

  return result.command !== 'unknown';
};

// Get command examples for display
export const getCommandExamples = (command: VoiceCommandType): string[] => {
  return VOICE_COMMAND_EXAMPLES[command] || [];
};
