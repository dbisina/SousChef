# App Store Rejection Fixes - Complete Summary

This document summarizes all fixes made to address the App Store rejection for SousChef v1.0.0.

## Rejection Issues Summary

Apple rejected your app for 4 reasons:
1. **Guideline 2.1** - IAP showing "Subscriptions are not available at this time"
2. **Guideline 5.1.1** - Camera permission flow issues (button text and cancel option)
3. **Guideline 3.1.2** - Missing Terms of Use link in App Store metadata
4. **Guideline 2.3.2** - App description doesn't clarify which features require subscription

---

## ✅ Fixes Completed

### 1. Camera Permission Flow Fixed (Guideline 5.1.1)

**File Changed**: [components/camera/CameraCapture.tsx](components/camera/CameraCapture.tsx)

**Changes Made**:
- ✅ Removed "Not Now" cancel button that allowed users to delay permission request
- ✅ Close button (X) now always visible in header, even before permission granted
- ✅ Users now proceed directly to iOS permission dialog when tapping "Continue"
- ✅ Button text already said "Continue" (Apple-compliant)

**Apple's Requirement**: Users should always proceed to the permission request after the message, with no option to delay/cancel via custom UI.

---

### 2. IAP Subscription Loading Improved (Guideline 2.1)

**Files Changed**:
- [components/subscription/Paywall.tsx](components/subscription/Paywall.tsx) - Added retry button
- Created [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) - Configuration guide

**Changes Made**:
- ✅ Added **Retry button** when subscriptions fail to load
- ✅ Improved error message with user-friendly instructions
- ✅ Created comprehensive guide for configuring production RevenueCat API keys

**Root Cause**:
- Your `.env` file uses test API keys: `test_SkTIgkrzBDMIeEiFFJJHkfyTtHs`
- Production builds don't have access to `.env` file
- EAS Secrets not configured for production builds

**Action Required**:
1. Get your **production RevenueCat API keys** from [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Configure EAS Secrets:
   ```bash
   eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "your_production_key_here"
   ```
3. Rebuild: `eas build --platform ios --profile production`

**See**: [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) for detailed instructions.

---

### 3. Terms of Use Documentation Created (Guideline 3.1.2)

**Files Created**:
- [terms-of-service.html](terms-of-service.html) - Terms of Service HTML for web hosting
- [privacy-policy.html](privacy-policy.html) - Privacy Policy HTML for web hosting
- [APP_STORE_METADATA_GUIDE.md](APP_STORE_METADATA_GUIDE.md) - Complete setup guide

**What Apple Requires**:
- Functional web link to Terms of Use in App Store metadata
- Must be in App Description or EULA field in App Store Connect

**Action Required**:
1. **Host the legal documents online**:
   - Upload `terms-of-service.html` and `privacy-policy.html` to your website, OR
   - Use GitHub Pages (free): [Instructions in guide](APP_STORE_METADATA_GUIDE.md#quick-setup-with-github-pages-free-hosting)

2. **Add link to App Store Connect**:
   - Go to App Store Connect → SousChef → 1.0.0 → App Description
   - Add at bottom: `Terms of Use: https://yourdomain.com/terms-of-service.html`

**Alternative**: Use Apple's Standard EULA:
```
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
```

---

### 4. App Description Template Created (Guideline 2.3.2)

**File Created**: [APP_DESCRIPTION_TEMPLATE.txt](APP_DESCRIPTION_TEMPLATE.txt)

**What Apple Requires**:
- Paid features (like "scanner") must be clearly labeled as requiring subscription purchase
- Users must know what's free vs. what requires payment

**Action Required**:
1. Open [APP_DESCRIPTION_TEMPLATE.txt](APP_DESCRIPTION_TEMPLATE.txt)
2. Replace `[YOUR_TERMS_OF_SERVICE_URL]` and `[YOUR_PRIVACY_POLICY_URL]` with actual URLs
3. Update pricing if different from template
4. Copy entire description
5. Paste into App Store Connect → SousChef → 1.0.0 → App Description
6. Save

**Key Feature**: Template clearly marks premium features with:
- "Subscription Required" header
- `*Requires Premium or Pro subscription` annotations
- Separate FREE vs PREMIUM sections

---

## 📋 Next Steps Checklist

Follow these steps in order:

### Step 1: Configure RevenueCat (Critical)
- [ ] Log in to [RevenueCat Dashboard](https://app.revenuecat.com/)
- [ ] Copy your **production iOS API key**
- [ ] Run: `eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "your_key"`
- [ ] Verify: `eas secret:list`

### Step 2: Host Legal Documents (Critical)
- [ ] Choose hosting option:
  - **Option A**: Upload `terms-of-service.html` and `privacy-policy.html` to your website
  - **Option B**: Use GitHub Pages (see [guide](APP_STORE_METADATA_GUIDE.md#quick-setup-with-github-pages-free-hosting))
  - **Option C**: Use Apple's Standard EULA for Terms (still need to host Privacy Policy)
- [ ] Note both URLs (you'll need them for the app description)

### Step 3: Update App Store Metadata (Critical)
- [ ] Open [APP_DESCRIPTION_TEMPLATE.txt](APP_DESCRIPTION_TEMPLATE.txt)
- [ ] Replace `[YOUR_TERMS_OF_SERVICE_URL]` with your Terms URL from Step 2
- [ ] Replace `[YOUR_PRIVACY_POLICY_URL]` with your privacy policy URL (or host privacy-policy.html)
- [ ] Copy the entire updated description
- [ ] Go to [App Store Connect](https://appstoreconnect.apple.com/)
- [ ] Navigate to: **My Apps** → **SousChef** → **1.0.0** → **App Store** tab
- [ ] Paste into **Description** field
- [ ] Click **Save**

### Step 4: Rebuild and Test
- [ ] Build new production version: `eas build --platform ios --profile production`
- [ ] Wait for build to complete (check status: `eas build:list`)
- [ ] Install via TestFlight
- [ ] Test subscriptions load correctly (not showing "not available" error)
- [ ] Test camera permission flow (X button visible, no "Not Now" button)
- [ ] Verify app description looks good in App Store Connect preview

### Step 5: Resubmit to App Store
- [ ] In App Store Connect, click **Submit for Review**
- [ ] Reply to App Review message with explanation of fixes (see template below)
- [ ] Submit

---

## 📧 Reply Template for App Review

When resubmitting, reply to the rejection message in App Store Connect with:

```
Hello App Review Team,

Thank you for the detailed feedback. We have addressed all the issues identified in the rejection:

1. **In-App Purchase Bug (Guideline 2.1)**: We have configured production RevenueCat API keys using EAS Secrets and added a retry mechanism. Subscriptions now load correctly in the sandbox environment.

2. **Camera Permission Flow (Guideline 5.1.1)**: We removed the "Not Now" button and now always show a close button (X) in the header. Users proceed directly to the iOS permission dialog when tapping "Continue."

3. **Terms of Use Link (Guideline 3.1.2)**: We have added a functional link to our Terms of Use in the App Description: [YOUR_TERMS_URL_HERE]

4. **Paid Features Clarity (Guideline 2.3.2)**: We have updated the App Description to clearly label all features that require a subscription with "Subscription Required" and "*Requires Premium" markers.

We have tested all changes thoroughly and believe the app now meets all App Store guidelines. The new build version has been submitted.

Thank you for your time and consideration.

Best regards,
SousChef Team
```

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| [components/camera/CameraCapture.tsx](components/camera/CameraCapture.tsx) | Fixed camera permission flow |
| [components/subscription/Paywall.tsx](components/subscription/Paywall.tsx) | Added retry button for IAP |
| [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) | Guide for configuring RevenueCat production keys |
| [terms-of-service.html](terms-of-service.html) | Terms of Service webpage (host this online) |
| [privacy-policy.html](privacy-policy.html) | Privacy Policy webpage (host this online) |
| [APP_STORE_METADATA_GUIDE.md](APP_STORE_METADATA_GUIDE.md) | Complete guide for updating App Store metadata |
| [APP_DESCRIPTION_TEMPLATE.txt](APP_DESCRIPTION_TEMPLATE.txt) | Ready-to-use app description with paid feature labels |
| [APP_STORE_REJECTION_FIXES.md](APP_STORE_REJECTION_FIXES.md) | This file - complete summary |

---

## 🔍 Testing Checklist (Before Resubmission)

Test these scenarios on the new TestFlight build:

### Subscriptions (Guideline 2.1)
- [ ] Open app while signed out
- [ ] Navigate to a premium feature (e.g., camera scanner)
- [ ] Paywall appears with subscription offerings visible
- [ ] No "Subscriptions are not available" error
- [ ] Can tap "Retry" if offerings fail to load
- [ ] Successfully purchase subscription in sandbox (use sandbox test account)

### Camera Permission (Guideline 5.1.1)
- [ ] First-time user: Open camera feature
- [ ] See "Camera Access Needed" screen with "Continue" button
- [ ] **No "Not Now" button visible**
- [ ] **X close button visible in header**
- [ ] Tap "Continue" → iOS permission dialog appears immediately
- [ ] Grant permission → camera works
- [ ] Deny permission → can close modal with X button

### App Store Metadata (Guidelines 3.1.2 & 2.3.2)
- [ ] View app in App Store Connect
- [ ] App Description clearly separates FREE vs PREMIUM features
- [ ] Premium features marked with "Subscription Required" or "*Requires Premium"
- [ ] Terms of Use link present at bottom of description
- [ ] Privacy Policy link present at bottom of description
- [ ] Both links functional (open in browser)

---

## ⚠️ Common Pitfalls to Avoid

1. **Don't use test RevenueCat keys in production** - Use your production keys only
2. **Don't skip EAS Secrets** - Environment variables in `.env` don't work in production builds
3. **Don't forget to host Terms of Use** - App Store Connect needs a working web URL, not an in-app screen
4. **Don't submit without testing** - Install the new build via TestFlight and verify all fixes work
5. **Don't leave placeholder URLs** - Replace `[YOUR_TERMS_OF_SERVICE_URL]` with your actual URL

---

## 📚 Additional Resources

- [Apple Auto-Renewable Subscription Guidelines](https://developer.apple.com/app-store/subscriptions/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Secrets Guide](https://docs.expo.dev/build-reference/variables/)

---

## 🆘 Need Help?

If you encounter issues:
1. **RevenueCat Issues**: Check [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) troubleshooting section
2. **EAS Build Issues**: Run `eas build:list` to check build status and logs
3. **App Store Questions**: Reply to App Review in App Store Connect
4. **Technical Support**: Visit [Apple Developer Forums](https://developer.apple.com/forums/)

---

## Summary

All code fixes are complete. The remaining work is configuration and metadata updates:

1. ✅ **Code Fixed**: Camera permission flow and IAP retry button
2. ⏳ **Configuration Needed**: RevenueCat production API keys via EAS Secrets
3. ⏳ **Hosting Needed**: Terms of Service HTML file on web
4. ⏳ **Metadata Needed**: Update App Description in App Store Connect

Follow the checklist above, and you'll be ready to resubmit! 🚀
