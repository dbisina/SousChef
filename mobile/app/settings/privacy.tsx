import React from 'react';
import { Muted } from '@/components/ui';
import { LegalBullets, LegalLayout, LegalSection } from '@/components/subscription/LegalLayout';

export default function PrivacyPolicyScreen() {
  return (
    <LegalLayout active="privacy" updated="February 2026">
      <Muted>
        At SousChef, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use,
        and safeguard your information when you use our mobile application.
      </Muted>

      <LegalSection title="1. Information We Collect">
        <LegalBullets
          items={[
            'Account Information: Email address, name, profile photo when you create an account',
            'Recipe Data: Recipes you create, save, or interact with',
            'Pantry Information: Items you add to your pantry',
            'Usage Data: How you interact with the app, features used, time spent',
            'Device Information: Device type, operating system, app version',
            'Photos: Images you capture for portion analysis (processed but not stored)',
            'Voice Data: Voice commands (processed in real-time, not stored)',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. How We Use Your Information">
        <LegalBullets
          items={[
            'Provide and improve our services',
            'Personalize your experience and recipe recommendations',
            'Process your subscription and payments',
            'Send important updates and notifications',
            'Analyze usage patterns to improve the app',
            'Provide customer support',
            'Ensure security and prevent fraud',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. AI Processing">
        When you use AI-powered features (portion analysis, voice commands, substitutions), your data is processed by
        our AI partners (Google Gemini). This processing happens in real-time and images/voice data are not
        permanently stored. Results may be cached temporarily to improve performance.
      </LegalSection>

      <LegalSection title="4. Data Sharing">
        <Muted>We do not sell your personal information. We may share data with:</Muted>
        <LegalBullets
          items={[
            'Service Providers: Cloud hosting (Firebase), payment processing (RevenueCat), AI services (Google)',
            'Legal Requirements: When required by law or to protect our rights',
            'Business Transfers: In the event of a merger or acquisition',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Data Storage and Security">
        <Muted>
          Your data is stored securely using Firebase services with encryption at rest and in transit. We implement
          industry-standard security measures including:
        </Muted>
        <LegalBullets
          items={[
            'SSL/TLS encryption',
            'Secure authentication',
            'Regular security audits',
            'Access controls and monitoring',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Your Rights">
        <Muted>You have the right to:</Muted>
        <LegalBullets
          items={[
            'Access your personal data',
            'Correct inaccurate data',
            'Delete your account and data',
            'Export your data',
            'Opt out of marketing communications',
            'Withdraw consent for optional processing',
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Data Retention">
        We retain your data for as long as your account is active. After account deletion, we may retain some data for
        up to 30 days for backup purposes, and certain data may be retained longer for legal compliance.
      </LegalSection>

      <LegalSection title="8. Children's Privacy">
        SousChef is not intended for children under 13. We do not knowingly collect information from children under
        13. If you believe we have collected such information, please contact us immediately.
      </LegalSection>

      <LegalSection title="9. Third-Party Services">
        <Muted>Our app integrates with third-party services that have their own privacy policies:</Muted>
        <LegalBullets
          items={[
            'Firebase (Google) - Authentication and database',
            'RevenueCat - Subscription management',
            'Google Gemini - AI processing',
            'Cloudinary - Image hosting',
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Cookies and Tracking">
        We use local storage and analytics to improve your experience. You can disable analytics in the app settings.
        We do not use third-party advertising cookies.
      </LegalSection>

      <LegalSection title="11. International Transfers">
        Your data may be transferred to and processed in countries other than your own. We ensure appropriate
        safeguards are in place for such transfers.
      </LegalSection>

      <LegalSection title="12. Changes to This Policy">
        We may update this Privacy Policy periodically. We will notify you of significant changes through the app or
        via email. Continued use after changes constitutes acceptance.
      </LegalSection>

      <LegalSection title="13. Contact Us">
        For privacy-related questions or to exercise your rights:{'\n'}Email: danbis664@gmail.com
      </LegalSection>
    </LegalLayout>
  );
}
