import React from 'react';
import { LegalLayout, LegalSection } from '@/components/subscription/LegalLayout';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using SousChef, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our application.',
  },
  {
    title: '2. Description of Service',
    body: 'SousChef is a mobile application that provides recipe management, meal planning, AI-powered cooking assistance, and related features. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate information when creating an account and keep it updated.',
  },
  {
    title: '4. User Content',
    body: 'You retain ownership of content you create, including recipes and photos. By posting content, you grant SousChef a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the application.',
  },
  {
    title: '5. Subscription and Payments',
    body: 'Premium features require a paid subscription. Subscriptions automatically renew unless cancelled. Refunds are subject to the policies of Apple App Store or Google Play Store. Prices may change with notice.',
  },
  {
    title: '6. Prohibited Conduct',
    body: "You agree not to:\n• Use the service for unlawful purposes\n• Upload harmful, offensive, or infringing content\n• Attempt to access other users' accounts\n• Interfere with the service's operation\n• Scrape or collect user data without permission",
  },
  {
    title: '7. AI Features Disclaimer',
    body: 'AI-powered features (portion analysis, substitutions, voice commands) are provided for informational purposes only. Nutritional estimates may not be accurate. Always verify information, especially for dietary restrictions or allergies.',
  },
  {
    title: '8. Intellectual Property',
    body: 'SousChef and its original content, features, and functionality are owned by SousChef and are protected by international copyright, trademark, and other intellectual property laws.',
  },
  {
    title: '9. Limitation of Liability',
    body: 'SousChef shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Our liability is limited to the amount you paid for the service in the past 12 months.',
  },
  {
    title: '10. Indemnification',
    body: 'You agree to indemnify and hold SousChef harmless from any claims, damages, or expenses arising from your use of the service or violation of these terms.',
  },
  {
    title: '11. Termination',
    body: 'We may terminate or suspend your account at any time for violations of these terms. Upon termination, your right to use the service will immediately cease.',
  },
  {
    title: '12. Changes to Terms',
    body: 'We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of the modified terms. We will notify users of significant changes.',
  },
  {
    title: '13. Governing Law',
    body: 'These terms shall be governed by the laws of the State of California, USA, without regard to conflict of law provisions.',
  },
  {
    title: '14. Contact Us',
    body: 'For questions about these Terms of Service, please contact us at:\nEmail: danbis664@gmail.com',
  },
];

export default function TermsOfServiceScreen() {
  return (
    <LegalLayout active="terms" updated="February 2026">
      {SECTIONS.map((s) => (
        <LegalSection key={s.title} title={s.title}>
          {s.body}
        </LegalSection>
      ))}
    </LegalLayout>
  );
}
