import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/stores/themeStore';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">
          Privacy Policy
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Last updated: February 2026
        </Text>

        <Text className="text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
          At SousChef, we are committed to protecting your privacy. This Privacy Policy
          explains how we collect, use, and safeguard your information when you use our
          mobile application.
        </Text>

        <Section title="1. Information We Collect">
          <BulletList items={[
            'Account Information: Email address, name, profile photo when you create an account',
            'Recipe Data: Recipes you create, save, or interact with',
            'Pantry Information: Items you add to your pantry',
            'Usage Data: How you interact with the app, features used, time spent',
            'Device Information: Device type, operating system, app version',
            'Photos: Images you capture for portion analysis (processed but not stored)',
            'Voice Data: Voice commands (processed in real-time, not stored)',
          ]} />
        </Section>

        <Section title="2. How We Use Your Information">
          <BulletList items={[
            'Provide and improve our services',
            'Personalize your experience and recipe recommendations',
            'Process your subscription and payments',
            'Send important updates and notifications',
            'Analyze usage patterns to improve the app',
            'Provide customer support',
            'Ensure security and prevent fraud',
          ]} />
        </Section>

        <Section title="3. AI Processing">
          When you use AI-powered features (portion analysis, voice commands, substitutions),
          your data is processed by our AI partners (Google Gemini). This processing happens
          in real-time and images/voice data are not permanently stored. Results may be cached
          temporarily to improve performance.
        </Section>

        <Section title="4. Data Sharing">
          We do not sell your personal information. We may share data with:{'\n\n'}
          • Service Providers: Cloud hosting (Firebase), payment processing (RevenueCat),
          AI services (Google){'\n'}
          • Legal Requirements: When required by law or to protect our rights{'\n'}
          • Business Transfers: In the event of a merger or acquisition
        </Section>

        <Section title="5. Data Storage and Security">
          Your data is stored securely using Firebase services with encryption at rest and
          in transit. We implement industry-standard security measures including:{'\n\n'}
          • SSL/TLS encryption{'\n'}
          • Secure authentication{'\n'}
          • Regular security audits{'\n'}
          • Access controls and monitoring
        </Section>

        <Section title="6. Your Rights">
          You have the right to:{'\n\n'}
          • Access your personal data{'\n'}
          • Correct inaccurate data{'\n'}
          • Delete your account and data{'\n'}
          • Export your data{'\n'}
          • Opt out of marketing communications{'\n'}
          • Withdraw consent for optional processing
        </Section>

        <Section title="7. Data Retention">
          We retain your data for as long as your account is active. After account deletion,
          we may retain some data for up to 30 days for backup purposes, and certain data
          may be retained longer for legal compliance.
        </Section>

        <Section title="8. Children's Privacy">
          SousChef is not intended for children under 13. We do not knowingly collect
          information from children under 13. If you believe we have collected such
          information, please contact us immediately.
        </Section>

        <Section title="9. Third-Party Services">
          Our app integrates with third-party services that have their own privacy policies:{'\n\n'}
          • Firebase (Google) - Authentication and database{'\n'}
          • RevenueCat - Subscription management{'\n'}
          • Google Gemini - AI processing{'\n'}
          • Cloudinary - Image hosting
        </Section>

        <Section title="10. Cookies and Tracking">
          We use local storage and analytics to improve your experience. You can disable
          analytics in the app settings. We do not use third-party advertising cookies.
        </Section>

        <Section title="11. International Transfers">
          Your data may be transferred to and processed in countries other than your own.
          We ensure appropriate safeguards are in place for such transfers.
        </Section>

        <Section title="12. Changes to This Policy">
          We may update this Privacy Policy periodically. We will notify you of significant
          changes through the app or via email. Continued use after changes constitutes
          acceptance.
        </Section>

        <Section title="13. Contact Us">
          For privacy-related questions or to exercise your rights:{'\n\n'}
          Email: danbis664@gmail.com
        </Section>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="mb-6">
    <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">{title}</Text>
    <Text className="text-neutral-600 dark:text-neutral-400 leading-relaxed">{children}</Text>
  </View>
);

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <View>
    {items.map((item, index) => (
      <View key={index} className="flex-row mb-1">
        <Text className="text-neutral-600 dark:text-neutral-400">• </Text>
        <Text className="text-neutral-600 dark:text-neutral-400 flex-1">{item}</Text>
      </View>
    ))}
  </View>
);
