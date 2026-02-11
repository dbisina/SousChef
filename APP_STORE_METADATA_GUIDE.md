# App Store Metadata Fix Guide

This guide explains how to fix the missing Terms of Use (EULA) link and update your app description to comply with Apple's guidelines.

## Issue 1: Missing Terms of Use Link (Guideline 3.1.2)

Apple requires apps with auto-renewable subscriptions to include a **functional link to the Terms of Use** in the App Store metadata.

### Solution: Add Terms of Use Link

#### Option A: Host Terms of Use on Your Website (Recommended)

1. **Upload the HTML files** `terms-of-service.html` and `privacy-policy.html` to your website:
   - Upload to: `https://yourdomain.com/terms-of-service.html` and `https://yourdomain.com/privacy-policy.html`
   - Or use a GitHub Pages site: `https://yourusername.github.io/souschef/terms-of-service.html` and `https://yourusername.github.io/souschef/privacy-policy.html`

2. **Add the link to App Store Connect**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Navigate to: **My Apps** → **SousChef** → **1.0.0** → **App Information**
   - Scroll to **App Store Information** section
   - In the **App Description**, add the following text:

```
Terms of Use: https://yourdomain.com/terms-of-service.html
```

   Add this line at the **bottom of your app description** (see Issue 2 below for the full updated description).

3. **Save and resubmit** your app for review.

#### Option B: Use Apple's Standard EULA (Simpler)

If you prefer to use Apple's standard EULA instead of a custom one:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to: **My Apps** → **SousChef** → **1.0.0** → **App Information**
3. Scroll to **License Agreement** section
4. Select **Use Standard EULA**
5. In your **App Description**, add:

```
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

### Quick Setup with GitHub Pages (Free Hosting)

If you don't have a website, you can use GitHub Pages for free:

```bash
# 1. Create a new repository on GitHub named "souschef-legal" or similar

# 2. Clone it locally
git clone https://github.com/yourusername/souschef-legal.git

# 3. Copy the legal HTML files
cp terms-of-service.html souschef-legal/
cp privacy-policy.html souschef-legal/

# 4. Commit and push
cd souschef-legal
git add terms-of-service.html privacy-policy.html
git commit -m "Add Terms of Service and Privacy Policy"
git push

# 5. Enable GitHub Pages in repository settings
# Go to: Settings → Pages → Source: main branch → Save

# 6. Your legal documents will be available at:
# https://yourusername.github.io/souschef-legal/terms-of-service.html
# https://yourusername.github.io/souschef-legal/privacy-policy.html
```

---

## Issue 2: Paid Features Not Clear (Guideline 2.3.2)

Apple requires that paid features mentioned in the app description must be clearly labeled as requiring a purchase.

### Problem

Your current app description mentions features like "scanner" but doesn't inform users that a subscription is required to access this content.

### Solution: Update App Description

Update your App Description in App Store Connect to clearly indicate which features require a subscription. Here's a template:

```
SousChef - Your AI-Powered Kitchen Assistant

WHAT'S INCLUDED (FREE):
• Create and organize unlimited recipes
• Browse your personal recipe collection
• Manage your pantry inventory
• Basic meal planning tools

PREMIUM FEATURES (Subscription Required):
• AI-Powered Food Scanner - Analyze ingredients and portions with your camera*
• Smart Substitutions - Get AI-generated ingredient alternatives*
• Voice Commands - Control the app hands-free while cooking*
• Advanced Meal Planning - Weekly meal plans with automated grocery lists*
• Unlimited Recipe Generation - Create new recipes with AI assistance*
• Nutritional Analysis - Track calories, macros, and nutritional information*

*Requires Premium or Pro subscription

Transform your cooking experience with SousChef! Our intelligent kitchen companion helps you discover new recipes, manage your pantry, plan meals, and cook with confidence.

KEY FEATURES:

📸 Food Scanner (Premium)*
Point your camera at ingredients to get instant nutritional info and portion sizes. Perfect for meal prep and tracking your diet.

🥗 Recipe Management
Save and organize all your favorite recipes in one place. Import from websites, create your own, or let AI generate personalized recipes.

🛒 Smart Pantry
Keep track of what you have, get expiration alerts, and reduce food waste. SousChef suggests recipes based on available ingredients.

📅 Meal Planning (Premium)*
Plan your weekly meals with intelligent suggestions. Generate automated shopping lists organized by store section.

🗣️ Voice Control (Premium)*
Cook hands-free with voice commands. Set timers, read recipes aloud, and navigate while your hands are busy.

🔄 AI Substitutions (Premium)*
Out of an ingredient? Get smart alternatives that work with your recipe. Perfect for dietary restrictions and allergies.

Choose Your Plan:
• Free - Basic recipe management and pantry tracking
• Premium - $4.99/month - All AI features included
• Pro - $7.99/month - Premium features plus priority support

Subscriptions auto-renew unless cancelled. Manage or cancel anytime in your App Store account settings.

Privacy Policy: https://yourdomain.com/privacy-policy.html
Terms of Use: https://yourdomain.com/terms-of-service.html

Contact: support@souschef.app
```

### How to Update

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to: **My Apps** → **SousChef** → **1.0.0**
3. Click **App Store** tab
4. Scroll to **Description** field
5. Replace with the updated description above (customize the URLs and pricing as needed)
6. Click **Save**
7. **Resubmit** your app for review

---

## Issue 3: Camera Permission Flow (Fixed in Code)

✅ **Already fixed** in [CameraCapture.tsx](components/camera/CameraCapture.tsx)

The "Not Now" button has been removed, and the close button is now always visible in the header, complying with Apple's Guideline 5.1.1.

---

## Issue 4: IAP "Subscriptions Not Available" (Fixed)

✅ **Already fixed** with:
- Retry button added to [Paywall.tsx](components/subscription/Paywall.tsx)
- RevenueCat configuration guide created in [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md)

Follow the RevenueCat setup guide to configure your production API keys before resubmitting.

---

## Submission Checklist

Before resubmitting to App Store:

- [ ] Host Terms of Service HTML file on your website or GitHub Pages
- [ ] Update App Description with clear paid feature labels (use "*Requires Premium" or similar)
- [ ] Add Terms of Use link to App Description
- [ ] Configure RevenueCat production API keys (see REVENUECAT_SETUP.md)
- [ ] Build new version: `eas build --platform ios --profile production`
- [ ] Test the new build via TestFlight:
  - [ ] Verify subscriptions load correctly
  - [ ] Test camera permission flow (should show X button, no "Not Now")
  - [ ] Verify Terms of Use link works in app description
- [ ] Submit to App Store: `eas submit --platform ios`
- [ ] Reply to App Review message explaining the fixes made

---

## Response Template for App Review

When resubmitting, reply to the App Review message with:

```
Hello App Review Team,

Thank you for the detailed feedback. We have addressed all the issues identified in the rejection:

1. **In-App Purchase Bug (Guideline 2.1)**: We have configured production RevenueCat API keys and added a retry mechanism. Subscriptions now load correctly in the sandbox environment.

2. **Camera Permission Flow (Guideline 5.1.1)**: We removed the "Not Now" button and now always show a close button (X) in the header. Users proceed directly to the iOS permission dialog when tapping "Continue."

3. **Terms of Use Link (Guideline 3.1.2)**: We have added a functional link to our Terms of Use in the App Description: https://yourdomain.com/terms-of-service.html

4. **Paid Features Clarity (Guideline 2.3.2)**: We have updated the App Description to clearly label all features that require a subscription (marked with "Requires Premium" or "Subscription Required").

We have tested all changes thoroughly and believe the app now meets all App Store guidelines. Please let us know if you need any additional information.

Thank you for your time and consideration.

Best regards,
SousChef Team
```

---

## Additional Resources

- [Apple's Auto-Renewable Subscription Requirements](https://developer.apple.com/app-store/subscriptions/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

---

## Need Help?

If you have questions or need assistance:
- Reply to App Review in App Store Connect
- Visit [Apple Developer Forums](https://developer.apple.com/forums/)
- Contact App Store Review: Use the "Contact Us" module in App Store Connect
