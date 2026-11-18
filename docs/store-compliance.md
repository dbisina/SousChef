# Store compliance: permissions, disclosures, review notes

Last checked 2026-11-18 against Apple App Review Guidelines, Google Play policy, and the dates below. Re-check before each submission.

## Dates that apply now

| Rule | Date | Status |
|---|---|---|
| Apple: build with Xcode 26 / iOS 26 SDK | since 2026-04-28 | EAS image `sdk-54` (Expo SDK 54) builds with Xcode 26. Confirm in the build log. |
| Apple: updated age-rating questions | answered by 2026-01-31 | Owner: answer in App Store Connect. |
| Apple: new age-rating descriptors (incl. shares real-world location) | from 2026-11-16, all apps by 2027-01-12 | Owner: complete in App Store Connect. enplace does not share location. |
| Google Play: target Android 16 (API 36) for new apps and updates | 2026-08-31 | Expo SDK 54 targets API 36. Confirm in the built manifest. |
| Google Play: disclose user data sent to third-party AI | July 2026 policy update | Done below (Data safety). Confirm wording on Google's policy page before submitting. |

## Permissions the app asks for, and why

| Permission | Platform | Used for | Text shown |
|---|---|---|---|
| Camera | iOS, Android | Portion and ingredient scan, photos for posts | iOS purpose strings in `app.json` |
| Photo library | iOS | Choose recipe, post and profile photos | `NSPhotoLibraryUsageDescription` |
| Microphone | iOS, Android | Voice commands while cooking, voice notes in chat | `NSMicrophoneUsageDescription` |
| Speech recognition | iOS | Hands-free cooking commands | `NSSpeechRecognitionUsageDescription` |
| Notifications | both | Messages, likes, reminders the person turns on | asked at the point of use |

Not requested: location, contacts, tracking (no ATT prompt needed), advertising ID, broad storage. `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO` are explicitly blocked in `app.json` because the system photo picker is used.

## Apple App Privacy ("nutrition label")

No tracking (no data linked across other companies' apps or sites, no ATT). Data linked to the person:

- Contact info: email, name
- User content: photos, audio/voice notes, posts, comments, messages, recipes
- Health and fitness: dietary needs, weight goals and health logs the person enters (used for app functionality only)
- Identifiers: user ID, push token
- Purchases: subscription status
- Usage data: feed interactions for personalisation (30 days raw, then deleted; switch in Settings)
- Diagnostics: crash and performance data if enabled

Purposes: App functionality, personalisation. Not used for third-party advertising or data brokers.

## Google Play Data safety

- Collected: personal info (name, email, user IDs), photos and videos, audio files, health info (user-entered), messages, app activity, purchase history, device ID (push token).
- Shared with third parties: yes. Service providers act on enplace's behalf: Google Gemini (AI features), Cloudflare and Cloudinary (storage), RevenueCat (subscriptions), Expo (push), Firebase (sign-in). Mark "processed on behalf of the developer" where the form offers it, and list AI processing as shared user data.
- Encrypted in transit: yes. Deletion: yes, in app (More > Delete account) and by email request.
- No data sold. No ads SDK. Account deletion URL: use the privacy page contact until a web page exists. Owner: add a public web URL for account deletion in Play Console.

## User-generated content (Apple 1.2, Google UGC policy)

Present in the app:
1. Terms with no tolerance for objectionable content (Terms, sections 6 and 6a).
2. Report on posts, comments, Spools, profiles and chats (more button), sent to `/v1/reports`; repeated reports hide content automatically.
3. Block person from the same menu, from profiles and chats; hides their posts, comments, stories and messages both ways. Unblock in the blocked list.
4. Staff review in the admin app; the stated target is 24 hours. Owner must actually watch the queue.
5. Contact: danielbisina.t@gmail.com.

## AI features

Portion scan, substitutions, voice help and meal ideas send the person's input to Google Gemini through the enplace server. Disclosed in the privacy screen (section 3) and Terms (section 7). Results are marked as estimates, not medical advice. No AI keys on the phone.

## Subscriptions (Apple 3.1.2, Play billing)

Purchases go through RevenueCat with the store billing system. Paywall shows price, period, automatic renewal, how to cancel, Restore, Terms and Privacy links. The "Advertise on enplace" form only collects a business enquiry; no payment is taken in the app.

## Review notes (paste into App Store Connect and Play Console)

> enplace is a cooking app: recipes, a social feed, meal planning, and AI helpers.
> Demo sign-in: [owner: add a demo email and password here. Account has a few recipes and posts and no verification step.]
> Guests can browse without an account; likes, saves, comments, follows and messages need an account.
> User content: every post, comment, Spool and profile has Report and Block (the ··· button). Reports are reviewed within 24 hours.
> Subscriptions use in-app purchase through RevenueCat; Restore is on the paywall.
> AI features send input to Google Gemini via our server and are labelled as estimates.
> Camera, microphone and speech permissions are used only for scanning food and hands-free cooking.
> Account deletion: More > Delete account.

## Owner checklist (cannot be done from code)

- [ ] Put RevenueCat production API keys in EAS secrets (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`) and create products in both stores.
- [ ] Create the demo account and fill in the review notes.
- [ ] Fill in App Privacy and Data safety exactly as above; answer the age-rating questions (both the Jan 2026 set and the Nov 2026 descriptors).
- [ ] Public privacy policy and account-deletion web URLs.
- [ ] Decide the bundle ID before first publish: it is `com.lyon98.souschef` and cannot change later.
- [ ] Confirm which store builds use the Firebase config files (`GoogleService-Info.plist`, `google-services.json`) and that they belong to the production project.
- [ ] Play: a new personal developer account needs a 12-tester, 14-day closed test.
- [ ] Watch the report queue daily.
