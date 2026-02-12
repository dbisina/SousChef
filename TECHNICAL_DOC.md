  # Technical Documentation: SousChef

**Project Name:** SousChef
**Devpost Submission:** RevenueCat Shipyard (Creator Contest)
**Repository:** [https://github.com/dbisina/SousChef](https://github.com/dbisina/SousChef)

---

## 🏗️ Architecture Overview

SousChef is designed as a modern, AI-first culinary assistant. The architecture prioritizes offline-first capabilities where possible, real-time synchronization, and low-latency interaction for voice commands.

### High-Level Components

1.  **Client (Mobile App):** A React Native application built with Expo, serving as the primary interface for recipe management, cooking, and shopping.
2.  **AI Layer (Processing):** Direct integration with Google Gemini 3.0 Flash Preview & Vision API for multimodal analysis of video, images, and text.
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
| **AI / ML** | **Google Gemini 3.0 Flash Preview** | Next-generation multimodal processing with improved latency and accuracy. |
| **Backend** | **Firebase** | Real-time database (Firestore) and authentication out-of-the-box. |
| **Monetization** | **RevenueCat** | Simplifies In-App Purchase logic and entitlement handling. |
| **Voice** | **react-native-voice** | Real-time speech recognition for hands-free cooking commands. |

---

## 💰 Implementation: RevenueCat

The core monetization strategy relies on the **SousChef Pro** subscription, which unlocks unlimited AI imports and advanced cloud features. RevenueCat is the backbone of this system, abstracting the complexities of StoreKit and Google Play Billing.

### Integration Details

1.  **SDK Setup**:
    We utilize the `react-native-purchases` SDK. Initialization happens at the app root level, configuring the API key based on the platform (iOS/Android) and identifying the user via their Firebase UID to ensure cross-platform entitlement parity.

2.  **Entitlements & Offerings**:
    - **Entitlement**: `pro_access`
    - **Offerings**: `souschef_monthly` ($4.99) and `souschef_annual` ($39.99).
    - **Logic**: We use the `Purchases.getCustomerInfo()` method to check for active entitlements before allowing restricted actions.

---

## 🤖 AI Workflow: Multimodal Recipe Extraction

Our extraction engine leverages **Gemini 3.0 Flash Preview** for its superior speed and multimodal context window. 

1.  **Media Processing**:
    - For video links (TikTok/Instagram), we download the low-res media and extract audio.
    - We pass the video file + audio transcript + page metadata to Gemini.
2.  **Prompt Engineering**:
    We use a strictly typed system prompt that forces Gemini to output a JSON schema matching our internal `Recipe` interface.
3.  **Visual Perception**:
    The AI is instructed to look for visual cues (text overlays, measuring spoon sizes) that might not be mentioned in the audio, ensuring high accuracy even for "no-narration" cooking videos.

---

## 🎤 Hands-Free Interface

To ensure safety and cleanliness in the kitchen, SousChef implements a dual-layer voice recognition system:
- **Layer 1 (Local)**: High-confidence pattern matching for simple commands (Next, Back, Stop).
- **Layer 2 (AI Fallback)**: For complex queries ("What can I use instead of eggs?"), we use Gemini to parse the user's intent.

## 🔒 Security & Privacy

*   **Authentication:** All user data is secured via Firebase Authentication rules. Users can only access their own pantry and cookbook data.
*   **Data Minimization:** AI processing is stateless; we do not store the raw video files on our servers, only the extracted text metadata.
