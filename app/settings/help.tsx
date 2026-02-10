import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';
import { Card, Button } from '@/components/ui';

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'How do I add a recipe?',
        a: 'Tap the "Add Recipe" button on the home screen or go to Profile > Create Recipe. Fill in the details, add a photo, and submit!',
      },
      {
        q: 'How do I scan food for calories?',
        a: 'Use the Scan tab (center button) to take a photo of any food. Our AI will analyze it and provide calorie estimates.',
      },
      {
        q: 'How do I use voice commands while cooking?',
        a: 'In cooking mode, tap the microphone icon or enable hands-free mode. Say "SousChef" followed by commands like "next step" or "read ingredients".',
      },
    ],
  },
  {
    category: 'Subscription',
    questions: [
      {
        q: 'What features are included in Premium?',
        a: 'Premium includes unlimited recipes, 20 AI features per day, voice control, meal planning, and ad-free experience.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'Go to Profile > Subscription > Manage Subscription. You can cancel anytime through your App Store or Play Store account.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Refunds are handled by Apple/Google. Contact their support or visit your subscription settings to request a refund.',
      },
    ],
  },
  {
    category: 'Account',
    questions: [
      {
        q: 'How do I reset my password?',
        a: 'On the login screen, tap "Forgot Password" and enter your email. We\'ll send you a reset link.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Profile > Settings > Delete Account. Note that this action is irreversible and all your data will be permanently deleted.',
      },
    ],
  },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  const filteredFAQ = FAQ_ITEMS.map((category) => ({
    ...category,
    questions: category.questions.filter(
      (q) =>
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.questions.length > 0);

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@souschef.app?subject=SousChef Support Request');
  };

  const handleVisitWebsite = () => {
    Linking.openURL('https://souschef.app/help');
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          Help Center
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Search */}
          <View className="flex-row items-center bg-white dark:bg-neutral-800 rounded-xl px-4 py-3 mb-6 border border-neutral-200 dark:border-neutral-700">
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              className="flex-1 ml-2 text-neutral-900 dark:text-neutral-100"
              placeholder="Search help articles..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Actions */}
          <View className="flex-row mb-6">
            <TouchableOpacity
              onPress={handleContactSupport}
              className="flex-1 mr-2"
            >
              <Card className="items-center py-4">
                <View className="w-12 h-12 rounded-full items-center justify-center mb-2" style={{ backgroundColor: colors.accent + '20' }}>
                  <Ionicons name="mail" size={24} color={colors.accent} />
                </View>
                <Text className="font-medium text-neutral-900 dark:text-neutral-100">Email Us</Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">Get support</Text>
              </Card>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleVisitWebsite}
              className="flex-1 ml-2"
            >
              <Card className="items-center py-4">
                <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2">
                  <Ionicons name="globe" size={24} color="#3B82F6" />
                </View>
                <Text className="font-medium text-neutral-900 dark:text-neutral-100">Website</Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">More resources</Text>
              </Card>
            </TouchableOpacity>
          </View>

          {/* FAQ */}
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase mb-3">
            Frequently Asked Questions
          </Text>

          {filteredFAQ.length > 0 ? (
            filteredFAQ.map((category) => (
              <View key={category.category} className="mb-4">
                <Text className="font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  {category.category}
                </Text>
                <Card padding="none">
                  {category.questions.map((item, index) => {
                    const questionId = `${category.category}-${index}`;
                    const isExpanded = expandedQuestions.has(questionId);

                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => toggleQuestion(questionId)}
                        className={`px-4 py-3 ${
                          index < category.questions.length - 1
                            ? 'border-b border-neutral-100 dark:border-neutral-700'
                            : ''
                        }`}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="flex-1 font-medium text-neutral-900 dark:text-neutral-100 pr-2">
                            {item.q}
                          </Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#A3A3A3"
                          />
                        </View>
                        {isExpanded && (
                          <Text className="text-neutral-600 dark:text-neutral-400 mt-2 text-sm leading-relaxed">
                            {item.a}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </Card>
              </View>
            ))
          ) : (
            <Card className="items-center py-8">
              <Ionicons name="search-outline" size={40} color="#A3A3A3" />
              <Text className="text-neutral-500 dark:text-neutral-400 mt-2">No results found</Text>
              <Text className="text-neutral-400 dark:text-neutral-500 text-sm">Try a different search term</Text>
            </Card>
          )}

          {/* Still need help */}
          <Card className="bg-primary-50 border border-primary-200 mt-4">
            <View className="items-center">
              <Text className="font-semibold text-primary-800 mb-1">
                Still need help?
              </Text>
              <Text className="text-primary-600 text-sm text-center mb-3">
                Our support team is here to help you
              </Text>
              <Button
                title="Contact Support"
                variant="primary"
                size="sm"
                onPress={handleContactSupport}
                leftIcon={<Ionicons name="chatbubble" size={16} color="white" />}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
