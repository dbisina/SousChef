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

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-100 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#404040" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-neutral-900 ml-2">
          Terms of Service
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <Text className="text-sm text-neutral-500 mb-4">
          Last updated: February 2025
        </Text>

        <Section title="1. Acceptance of Terms">
          By accessing or using SousChef, you agree to be bound by these Terms of Service.
          If you do not agree to these terms, please do not use our application.
        </Section>

        <Section title="2. Description of Service">
          SousChef is a mobile application that provides recipe management, meal planning,
          AI-powered cooking assistance, and related features. We reserve the right to modify,
          suspend, or discontinue any aspect of the service at any time.
        </Section>

        <Section title="3. User Accounts">
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activities that occur under your account. You must provide accurate
          information when creating an account and keep it updated.
        </Section>

        <Section title="4. User Content">
          You retain ownership of content you create, including recipes and photos. By posting
          content, you grant SousChef a non-exclusive, worldwide, royalty-free license to use,
          display, and distribute your content within the application.
        </Section>

        <Section title="5. Subscription and Payments">
          Premium features require a paid subscription. Subscriptions automatically renew unless
          cancelled. Refunds are subject to the policies of Apple App Store or Google Play Store.
          Prices may change with notice.
        </Section>

        <Section title="6. Prohibited Conduct">
          You agree not to:{'\n'}
          • Use the service for unlawful purposes{'\n'}
          • Upload harmful, offensive, or infringing content{'\n'}
          • Attempt to access other users' accounts{'\n'}
          • Interfere with the service's operation{'\n'}
          • Scrape or collect user data without permission
        </Section>

        <Section title="7. AI Features Disclaimer">
          AI-powered features (portion analysis, substitutions, voice commands) are provided
          for informational purposes only. Nutritional estimates may not be accurate. Always
          verify information, especially for dietary restrictions or allergies.
        </Section>

        <Section title="8. Intellectual Property">
          SousChef and its original content, features, and functionality are owned by SousChef
          and are protected by international copyright, trademark, and other intellectual
          property laws.
        </Section>

        <Section title="9. Limitation of Liability">
          SousChef shall not be liable for any indirect, incidental, special, consequential,
          or punitive damages arising from your use of the service. Our liability is limited
          to the amount you paid for the service in the past 12 months.
        </Section>

        <Section title="10. Indemnification">
          You agree to indemnify and hold SousChef harmless from any claims, damages, or
          expenses arising from your use of the service or violation of these terms.
        </Section>

        <Section title="11. Termination">
          We may terminate or suspend your account at any time for violations of these terms.
          Upon termination, your right to use the service will immediately cease.
        </Section>

        <Section title="12. Changes to Terms">
          We may modify these terms at any time. Continued use of the service after changes
          constitutes acceptance of the modified terms. We will notify users of significant changes.
        </Section>

        <Section title="13. Governing Law">
          These terms shall be governed by the laws of the State of California, USA, without
          regard to conflict of law provisions.
        </Section>

        <Section title="14. Contact Us">
          For questions about these Terms of Service, please contact us at:{'\n'}
          Email: legal@souschef.app
        </Section>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="mb-6">
    <Text className="text-lg font-bold text-neutral-900 mb-2">{title}</Text>
    <Text className="text-neutral-600 leading-relaxed">{children}</Text>
  </View>
);
