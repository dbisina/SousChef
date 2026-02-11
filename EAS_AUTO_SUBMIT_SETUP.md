# EAS Auto Submit Setup Guide

This guide explains how to use EAS Build with automatic submission to App Store and Google Play.

## What's Configured

Your `eas.json` is now configured to **automatically submit builds** to the App Store and Google Play after successful production builds.

### Configuration Details

```json
"production": {
  "ios": {
    "autoSubmit": true,
    "submitProfile": "production"
  },
  "android": {
    "autoSubmit": true,
    "submitProfile": "production"
  }
}
```

This means when you run:
```bash
eas build --platform ios --profile production
```

EAS will:
1. ✅ Build your app
2. ✅ Automatically submit to App Store Connect / TestFlight (no need to run `eas submit` separately)
3. ✅ The build goes directly to TestFlight for iOS

---

## iOS Setup (Required First Time)

### Step 1: Configure App Store Connect API Key

You need to authenticate EAS with App Store Connect. You have two options:

#### Option A: App Store Connect API Key (Recommended)

1. **Create an API Key in App Store Connect**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Navigate to: **Users and Access** → **Keys** tab (under Integrations)
   - Click **[+]** to create a new key
   - Name: `EAS Submit Key`
   - Access: **App Manager** (or higher)
   - Click **Generate**
   - Download the `.p8` file (you can only download it once!)
   - Note the **Issuer ID** and **Key ID**

2. **Configure EAS with the API Key**:
```bash
# Method 1: Interactive (easiest)
eas submit --platform ios --profile production

# When prompted, choose "Authenticate with App Store Connect API Key"
# Follow the prompts to enter Issuer ID, Key ID, and upload the .p8 file

# Method 2: Set as environment variables
export EXPO_APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
```

3. **Store API Key Securely** (optional but recommended):
```bash
# Add to EAS Secrets for CI/CD
eas secret:create --name EXPO_APPLE_API_KEY --value "$(cat AuthKey_XXXXXXXXXX.p8)" --type string
eas secret:create --name EXPO_APPLE_API_KEY_ID --value "XXXXXXXXXX" --type string
eas secret:create --name EXPO_APPLE_API_ISSUER_ID --value "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --type string
```

#### Option B: Apple ID with App-Specific Password (Alternative)

1. **Generate App-Specific Password**:
   - Go to [appleid.apple.com](https://appleid.apple.com/)
   - Sign in with your Apple ID: `danielbisina@gmail.com`
   - Navigate to **Security** → **App-Specific Passwords**
   - Click **[+]** to generate a password
   - Label it: `EAS Submit`
   - Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

2. **Store the Password**:
```bash
eas secret:create --name EXPO_APPLE_APP_SPECIFIC_PASSWORD --value "xxxx-xxxx-xxxx-xxxx" --type string
```

---

## Android Setup (For Future Google Play Release)

### Step 1: Create Service Account in Google Play Console

1. **Go to Google Play Console**:
   - Navigate to: **Setup** → **API access**
   - Click **Create new service account**

2. **Create Service Account in Google Cloud**:
   - Click the link to Google Cloud Console
   - Click **Create Service Account**
   - Name: `EAS Submit Service Account`
   - Click **Create and Continue**
   - Grant role: **Service Account User**
   - Click **Done**

3. **Create and Download Key**:
   - Find your service account in the list
   - Click **Actions** (⋮) → **Manage keys**
   - Click **Add Key** → **Create new key**
   - Choose **JSON**
   - Click **Create** (downloads `google-play-service-account.json`)

4. **Grant Access in Play Console**:
   - Go back to Google Play Console → **API access**
   - Find your service account and click **Grant access**
   - Under **Account permissions**, enable:
     - View app information
     - Manage production releases
     - Manage testing track releases
   - Click **Save**

5. **Store the JSON Key**:
```bash
# Place the downloaded file in your project root
mv ~/Downloads/google-play-service-account-*.json ./google-play-service-account.json

# Add to .gitignore
echo "google-play-service-account.json" >> .gitignore
```

---

## How to Use Auto Submit

### Build and Auto-Submit to TestFlight (iOS)

```bash
# Build for production iOS (automatically submits to TestFlight)
eas build --platform ios --profile production

# EAS will:
# 1. Build the app
# 2. Upload to App Store Connect
# 3. Submit to TestFlight automatically
# 4. You'll receive an email when TestFlight processing completes
```

### Build and Auto-Submit to Google Play Internal Track (Android)

```bash
# Build for production Android (automatically submits to Internal track)
eas build --platform android --profile production

# EAS will:
# 1. Build the AAB
# 2. Upload to Google Play Console
# 3. Submit to Internal testing track automatically
```

### Build Both Platforms

```bash
# Build and submit both iOS and Android
eas build --platform all --profile production
```

---

## Manual Submit (If Needed)

If you want to manually submit a build instead of using auto-submit:

```bash
# Submit a specific build to App Store
eas submit --platform ios --profile production

# Submit a specific build to Google Play
eas submit --platform android --profile production
```

---

## Troubleshooting

### iOS: "Authentication Required" Error

**Problem**: EAS can't authenticate with App Store Connect.

**Solution**:
1. Run `eas submit --platform ios` once to set up authentication interactively
2. Or configure App Store Connect API Key (see Step 1 above)

### iOS: "Invalid App Store Connect API Key"

**Problem**: The API key doesn't have the right permissions.

**Solution**:
1. Go to App Store Connect → Users and Access → Keys
2. Delete the old key
3. Create a new key with **App Manager** role or higher
4. Reconfigure EAS with the new key

### Android: "Service account authentication failed"

**Problem**: The service account JSON key is missing or invalid.

**Solution**:
1. Ensure `google-play-service-account.json` exists in your project root
2. Verify the service account has the right permissions in Google Play Console
3. Make sure the path in `eas.json` is correct: `"./google-play-service-account.json"`

### Build Succeeds but Auto-Submit Fails

**Problem**: Build completes but submission fails.

**Solution**:
1. Check the EAS build logs for submission errors
2. Manually submit the build: `eas submit --platform ios --id <build-id>`
3. Fix the authentication issue and rebuild

---

## Your App Configuration

Based on your `eas.json`, here's your configuration:

**iOS**:
- Apple ID: `danielbisina@gmail.com`
- ASC App ID: `6738848055`
- Team ID: `D76PR74GWY`
- Auto-submit: ✅ Enabled (submits to TestFlight)

**Android**:
- Service Account: `./google-play-service-account.json`
- Track: `internal` (internal testing)
- Auto-submit: ✅ Enabled

---

## Complete Workflow for App Store Resubmission

Here's the complete workflow to fix the rejection and resubmit:

### 1. Configure RevenueCat API Keys
```bash
eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "your_production_key"
```

### 2. Setup Auto-Submit Authentication (First Time Only)
```bash
# Option A: Use App Store Connect API Key (recommended)
eas submit --platform ios --profile production
# Follow prompts to configure API key

# Option B: Use App-Specific Password
eas secret:create --name EXPO_APPLE_APP_SPECIFIC_PASSWORD --value "xxxx-xxxx-xxxx-xxxx"
```

### 3. Build and Auto-Submit to TestFlight
```bash
# This will build AND automatically submit to TestFlight
eas build --platform ios --profile production
```

### 4. Monitor the Build
```bash
# Check build status
eas build:list

# View specific build logs
eas build:view <build-id>
```

### 5. Test on TestFlight
- Install the build via TestFlight
- Verify subscriptions load correctly
- Test camera permission flow
- Confirm all fixes work

### 6. Submit to App Review
Once TestFlight testing passes:
1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to: **My Apps** → **SousChef** → **1.0.0**
3. Click **Submit for Review**
4. Reply to the rejection message explaining your fixes

---

## Benefits of Auto Submit

✅ **Faster workflow**: No need to run `eas submit` separately
✅ **Less manual work**: One command builds and submits
✅ **Immediate TestFlight**: Build goes to TestFlight as soon as it's ready
✅ **CI/CD ready**: Perfect for automated pipelines

---

## Tips

1. **Use API Key over App-Specific Password**: API Keys are more secure and don't expire
2. **Keep credentials in EAS Secrets**: Never commit `.p8` files or passwords to git
3. **Monitor email**: You'll get notifications when builds finish and TestFlight processes
4. **First build takes longer**: Apple needs to process your app for TestFlight (usually 5-15 min)

---

## Next Steps

1. ✅ RevenueCat API keys configured (see [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md))
2. ✅ Auto-submit configured in `eas.json`
3. ⏳ Set up App Store Connect authentication (first-time only)
4. ⏳ Run `eas build --platform ios --profile production`
5. ⏳ Test on TestFlight
6. ⏳ Submit to App Review

---

## Additional Resources

- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect API Keys](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)
- [Google Play Service Accounts](https://developers.google.com/android-publisher/getting_started)
