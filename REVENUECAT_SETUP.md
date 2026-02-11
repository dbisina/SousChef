# RevenueCat Setup Guide for App Store Submission

This guide explains how to configure RevenueCat API keys for your production app build to fix the "Subscriptions are not available" error during App Store review.

## Problem

Your app is showing "Subscriptions are not available at this time" because:
1. The `.env` file contains test API keys (`test_SkTIgkrzBDMIeEiFFJJHkfyTtHs`)
2. Production builds don't have access to the `.env` file
3. Environment variables are not configured in EAS Secrets

## Solution: Configure Production API Keys

### Step 1: Get Your Production RevenueCat API Keys

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project: **SousChef**
3. Navigate to **Settings** → **API Keys**
4. Copy your production API keys:
   - **iOS API Key** (for Apple App Store)
   - **Android API Key** (if you plan to release on Google Play)

> **Important**: Make sure you're using the **production** API keys, NOT the test/sandbox keys.

### Step 2: Configure EAS Secrets

EAS Secrets allow you to securely store environment variables for your production builds:

```bash
# Navigate to your project directory
cd c:\Users\USER\Documents\GitHub\SousChef

# Set iOS RevenueCat API Key
eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "your_ios_api_key_here" --type string

# Set Android RevenueCat API Key (optional, for future Android release)
eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value "your_android_api_key_here" --type string
```

Replace `"your_ios_api_key_here"` with your actual production API key from RevenueCat.

### Step 3: Verify EAS Secrets

List all configured secrets to verify they were added correctly:

```bash
eas secret:list
```

You should see:
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

### Step 4: Rebuild and Resubmit

```bash
# Build a new production version for iOS
eas build --platform ios --profile production

# After build completes, submit to App Store
eas submit --platform ios
```

## How It Works

1. **Local Development**: Uses `.env` file with test keys
2. **Production Builds**: Uses EAS Secrets for secure API key storage
3. **RevenueCat SDK**: Automatically picks up `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` at runtime

## Verify Configuration

After setting up EAS Secrets and rebuilding, verify the configuration:

1. Install the new build on a test device via TestFlight
2. Open the app and navigate to the subscription screen
3. You should see the subscription offerings load without errors
4. Test purchasing a subscription in the sandbox environment

## Troubleshooting

### "Subscriptions still not available" after rebuild

1. **Check EAS Secrets**: Run `eas secret:list` to verify they're configured
2. **Verify API Key**: Ensure you're using the production key, not test key
3. **Check RevenueCat Dashboard**: Verify your offerings are configured:
   - Go to **Products** → **Offerings**
   - Ensure you have offerings named `premium` and `pro` (or `default`)
   - Each offering should have monthly and annual packages

### "Invalid API Key" error

- Double-check you copied the entire API key without spaces
- Ensure you're using the iOS key for iOS builds
- Verify the key is active in RevenueCat Dashboard

### "No packages found" error

- In RevenueCat Dashboard, go to **Products** → **Offerings**
- Create offerings if they don't exist:
  - **premium** offering with monthly and annual packages
  - **pro** offering with monthly and annual packages
- Link your App Store subscription products to these offerings

## Additional Resources

- [RevenueCat Quickstart](https://www.revenuecat.com/docs/getting-started)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [RevenueCat Offerings Guide](https://www.revenuecat.com/docs/entitlements)

## Contact

If you continue to experience issues, contact RevenueCat support or check the [RevenueCat Community](https://community.revenuecat.com/).
