  # Technical Documentation: SousChef

**Project Name:** SousChef
**Devpost Submission:** RevenueCat Shipyard (Creator Contest)
**Repository:** [https://github.com/dbisina/SousChef](https://github.com/dbisina/SousChef)

---

## 🏗️ Architecture Overview

SousChef is designed as a modern, AI-first culinary assistant. The architecture prioritizes offline-first capabilities where possible, real-time synchronization, and low-latency interaction for voice commands.

### High-Level Components

1.  **Client (Mobile App):** A React Native application built with Expo, serving as the primary interface for recipe management, cooking, and shopping.
2.  **AI Layer (Processing):** Direct integration with Google Gemini 1.5 Flash & Vision API for multimodal analysis of video, images, and text.
3.  **Backend (Data & Auth):** Firebase (Firestore, Auth) for user data persistence and identity management.
4.  **Monetization (Subscription):** RevenueCat for managing cross-platform entitlements and subscription logic.

---

## 🛠️ Technology Stack

| Category | Technology | Reasoning |
| :--- | :--- | :--- |
| **Framework** | **React Native (Expo SDK 50+)** | Cross-platform (iOS/Android) with rapid iteration via Expo Go. |
| **Language** | **TypeScript** | Type safety for complex data structures like recipe schemas. |
| **Styling** | **NativeWind (TailwindCSS)** | Utility-first styling for a consistent, responsive design system. |
| **State Management** | **Zustand** | Lightweight, predictable state management for shopping lists and timers. |
| **AI / ML** | **Google Gemini 1.5 Flash** | High-speed, low-cost multimodal processing for video/image extraction. |
| **Backend** | **Firebase** | Real-time database (Firestore) and authentication out-of-the-box. |
| **Monetization** | **RevenueCat** | Simplifies In-App Purchase logic and entitlement handling. |
| **Voice** | **react-native-voice** | Real-time speech recognition for hands-free cooking commands. |

---

## 💰 Implementation: RevenueCat

The core monetization strategy relies on the **SousChef Pro** subscription, which unlocks unlimited AI imports and advanced cloud features. RevenueCat is the backbone of this system.

### Integration Details

1.  **SDK Setup:**
    We utilize the `react-native-purchases` SDK. Initialization happens at the app root level in `packages/mobile/src/App.tsx`, configuring the API key based on the platform (iOS/Android).

2.  **Entitlements:**
    We defined a single entitlement identifier: `pro_access`. This entitlement is unlocked by purchasing either the `souschef_monthly` or `souschef_annual` offering.

3.  **Paywall Logic:**
    The paywall is triggered via the `URLImportModal` component. Before allowing a user to process a new URL, we check their subscription status:
    ```typescript
    // Check if user has active entitlement
    const { customerInfo } = await Purchases.getCustomerInfo();
    const isPro = customerInfo.entitlements.active['pro_access'] !== undefined;

    if (!isPro && importCount >= FREE_LIMIT) {
      setShowPaywall(true); // Trigger RevenueCat paywall flow
      return;
    }
    ```

4.  **Subscriber Attributes:**
    We set custom attributes for better segmentation, such as `total_recipes_imported`, allowing us to target power users with specific offers.

---

## 🤖 AI Workflow: Video-to-Recipe

One of the most technically challenging aspects was converting unstructured social media video content into structured JSON recipes.

1.  **Input:** User provides a URL (TikTok/Instagram).
2.  **Extraction:** The app downloads a temporary cached version of the video (if platform allows) or extracts frame snapshots.
3.  **Processing (Gemini 1.5):** We send a multimodal prompt containing the video frames + audio transcript to Gemini.
    *   *Prompt Engineering:* "Analyze the visual cues in this video to determine ingredient amounts that are not explicitly spoken."
4.  **Structuring:** The LLM returns a strictly formatted JSON object matching our `Recipe` TypeScript interface.
5.  **Validation:** The app validates the JSON against our schema (Zod) before saving it to the user's cookbook.

---

## 🔒 Security & Privacy

*   **Authentication:** All user data is secured via Firebase Authentication rules. Users can only access their own pantry and cookbook data.
*   **Data Minimization:** AI processing is stateless; we do not store the raw video files on our servers, only the extracted text metadata.
