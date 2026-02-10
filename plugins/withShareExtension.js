/**
 * Expo Config Plugin: iOS Share Extension for SousChef
 * 
 * Adds a native iOS Share Extension target so SousChef appears in the
 * iOS share sheet when users share URLs, videos, or images from any app.
 *
 * Supported content: web URLs, video files, image files, and plain text.
 * The extension passes URLs directly and copies media files to the App Group
 * shared container so the main app can access them.
 */

const {
    withXcodeProject,
    withEntitlementsPlist,
    withInfoPlist,
    IOSConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_EXT_NAME = 'ShareExtension';
const APP_GROUP = 'group.com.lyon98.souschef';
const TEAM_ID = 'KJWN27VC5D'; // Apple Developer Team ID for code signing

// ─── Swift source for the Share Extension ────────────────────────
const SHARE_EXTENSION_SWIFT = `
import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        handleSharedItems()
    }

    private func handleSharedItems() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            close()
            return
        }

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                // Handle URLs (web links from Safari/apps, OR file:// URLs from Photos)
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            if url.isFileURL {
                                // File shared from Photos/Files — copy to shared container
                                self?.copyAndShareFile(sourceURL: url)
                            } else {
                                self?.saveAndOpenApp(urlString: url.absoluteString)
                            }
                        } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                            self?.saveAndOpenApp(urlString: url.absoluteString)
                        }
                    }
                    return
                }

                // Handle video files (from Photos, Camera Roll, Files, etc.)
                if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.movie.identifier, options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            self?.copyAndShareFile(sourceURL: url)
                        }
                    }
                    return
                }

                // Handle image files (recipe screenshots, cookbook photos, etc.)
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            self?.copyAndShareFile(sourceURL: url)
                        } else if let image = item as? UIImage {
                            // Some apps provide UIImage directly instead of a file URL
                            self?.saveImageAndShare(image: image)
                        }
                    }
                    return
                }

                // Handle plain text (which may contain a URL)
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                        if let text = item as? String {
                            // Try to extract URL from text
                            if let url = self?.extractURL(from: text) {
                                self?.saveAndOpenApp(urlString: url)
                            } else {
                                self?.saveAndOpenApp(urlString: text)
                            }
                        }
                    }
                    return
                }
            }
        }

        close()
    }

    /// Copy a shared file to the App Group container so the main app can access it
    private func copyAndShareFile(sourceURL: URL) {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "${APP_GROUP}") else {
            close()
            return
        }

        // Clean up any previous shared files
        cleanUpOldSharedFiles(in: containerURL)

        let ext = sourceURL.pathExtension.isEmpty ? "mp4" : sourceURL.pathExtension
        let destFileName = "shared_media_\\(Int(Date().timeIntervalSince1970)).\\(ext)"
        let destURL = containerURL.appendingPathComponent(destFileName)

        do {
            // Ensure we have access to the source file (security-scoped for Photos)
            let accessing = sourceURL.startAccessingSecurityScopedResource()
            defer { if accessing { sourceURL.stopAccessingSecurityScopedResource() } }

            try FileManager.default.copyItem(at: sourceURL, to: destURL)
            saveAndOpenApp(urlString: destURL.path)
        } catch {
            print("[ShareExtension] Failed to copy file: \\(error)")
            close()
        }
    }

    /// Save a UIImage to the App Group container (for apps that provide UIImage directly)
    private func saveImageAndShare(image: UIImage) {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "${APP_GROUP}") else {
            close()
            return
        }

        cleanUpOldSharedFiles(in: containerURL)

        let destFileName = "shared_media_\\(Int(Date().timeIntervalSince1970)).jpg"
        let destURL = containerURL.appendingPathComponent(destFileName)

        guard let data = image.jpegData(compressionQuality: 0.85) else {
            close()
            return
        }

        do {
            try data.write(to: destURL)
            saveAndOpenApp(urlString: destURL.path)
        } catch {
            print("[ShareExtension] Failed to save image: \\(error)")
            close()
        }
    }

    /// Remove old shared media files to free space (only keep one at a time)
    private func cleanUpOldSharedFiles(in containerURL: URL) {
        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(at: containerURL, includingPropertiesForKeys: nil) else { return }
        for file in contents where file.lastPathComponent.hasPrefix("shared_media_") {
            try? fileManager.removeItem(at: file)
        }
    }

    private func extractURL(from text: String) -> String? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let matches = detector?.matches(in: text, options: [], range: NSRange(text.startIndex..., in: text))
        if let match = matches?.first, let range = Range(match.range, in: text) {
            return String(text[range])
        }
        return nil
    }

    private func saveAndOpenApp(urlString: String) {
        // Save URL to App Group shared UserDefaults
        let userDefaults = UserDefaults(suiteName: "${APP_GROUP}")
        userDefaults?.set(urlString, forKey: "SharedURL")
        userDefaults?.set(Date().timeIntervalSince1970, forKey: "SharedURLTimestamp")
        userDefaults?.synchronize()

        // Open the main app via custom URL scheme
        // Use .alphanumerics to fully encode the URL value (urlQueryAllowed leaves ? and & unencoded)
        let appURL = URL(string: "souschef://share?url=\\(urlString.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? urlString)")!

        // Use openURL to launch the main app
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(appURL, options: [:], completionHandler: nil)
                break
            }
            responder = responder?.next
        }

        // Also try the newer approach
        openURL(appURL)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.close()
        }
    }

    private func openURL(_ url: URL) {
        let selector = sel_registerName("openURL:")
        var responder: UIResponder? = self
        while let r = responder {
            if r.responds(to: selector) {
                r.perform(selector, with: url)
                return
            }
            responder = r.next
        }
    }

    private func close() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
`;

// ─── Info.plist for the Share Extension ──────────────────────────
const SHARE_EXT_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>Import to SousChef</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key>
    <string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.share-services</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
        <key>NSExtensionAttributes</key>
        <dict>
            <key>NSExtensionActivationRule</key>
            <dict>
                <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
                <integer>1</integer>
                <key>NSExtensionActivationSupportsText</key>
                <true/>
                <key>NSExtensionActivationSupportsMovieWithMaxCount</key>
                <integer>1</integer>
                <key>NSExtensionActivationSupportsImageWithMaxCount</key>
                <integer>1</integer>
            </dict>
        </dict>
    </dict>
</dict>
</plist>
`;

// ─── Entitlements for the Share Extension ────────────────────────
const SHARE_EXT_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP}</string>
    </array>
</dict>
</plist>
`;

// ─── Plugin: Add App Group to main app entitlements ──────────────
const withAppGroupEntitlements = (config) => {
    return withEntitlementsPlist(config, (mod) => {
        mod.modResults['com.apple.security.application-groups'] =
            mod.modResults['com.apple.security.application-groups'] || [];
        if (!mod.modResults['com.apple.security.application-groups'].includes(APP_GROUP)) {
            mod.modResults['com.apple.security.application-groups'].push(APP_GROUP);
        }
        return mod;
    });
};

// ─── Plugin: Write Share Extension files + add Xcode target ──────
const withShareExtensionTarget = (config) => {
    return withXcodeProject(config, async (mod) => {
        const xcodeProject = mod.modRequest.projectRoot;
        const extDir = path.join(xcodeProject, 'ios', SHARE_EXT_NAME);

        // Create ShareExtension directory
        if (!fs.existsSync(extDir)) {
            fs.mkdirSync(extDir, { recursive: true });
        }

        // Write Swift source
        fs.writeFileSync(
            path.join(extDir, 'ShareViewController.swift'),
            SHARE_EXTENSION_SWIFT.trim()
        );

        // Write Info.plist
        fs.writeFileSync(
            path.join(extDir, 'Info.plist'),
            SHARE_EXT_PLIST.trim()
        );

        // Write entitlements
        fs.writeFileSync(
            path.join(extDir, `${SHARE_EXT_NAME}.entitlements`),
            SHARE_EXT_ENTITLEMENTS.trim()
        );

        // Add target to Xcode project
        const proj = mod.modResults;
        const targetUuid = proj.generateUuid();
        const bundleId = `com.lyon98.souschef.${SHARE_EXT_NAME}`;

        // Check if target already exists
        const existingTarget = proj.pbxTargetByName(SHARE_EXT_NAME);
        if (existingTarget) {
            return mod;
        }

        // Add Share Extension target
        const target = proj.addTarget(
            SHARE_EXT_NAME,
            'app_extension',
            SHARE_EXT_NAME,
            bundleId
        );

        // Add files to the target's group
        const groupKey = proj.pbxCreateGroup(SHARE_EXT_NAME, SHARE_EXT_NAME);

        // Add the group under the main group
        const mainGroupKey = proj.getFirstProject().firstProject.mainGroup;
        proj.addToPbxGroup(groupKey, mainGroupKey);

        // Add build phase for sources with correct relative path
        proj.addBuildPhase(
            [`${SHARE_EXT_NAME}/ShareViewController.swift`],
            'PBXSourcesBuildPhase',
            'Sources',
            target.uuid
        );

        // Add Info.plist to group (not compiled, so no target needed)
        proj.addFile(
            `${SHARE_EXT_NAME}/Info.plist`,
            groupKey,
            { lastKnownFileType: 'text.plist.xml' }
        );

        // Set build settings
        const configurations = proj.pbxXCBuildConfigurationSection();


        // Now set the ShareExtension build settings
        for (const key in configurations) {
            const config = configurations[key];
            if (
                typeof config === 'object' &&
                config.buildSettings &&
                config.name
            ) {
                // Match build configs by target
                if (config.buildSettings.PRODUCT_NAME === `"${SHARE_EXT_NAME}"` ||
                    config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER === bundleId) {
                    config.buildSettings.INFOPLIST_FILE = `${SHARE_EXT_NAME}/Info.plist`;
                    config.buildSettings.CODE_SIGN_ENTITLEMENTS = `${SHARE_EXT_NAME}/${SHARE_EXT_NAME}.entitlements`;
                    config.buildSettings.SWIFT_VERSION = '5.0';
                    config.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
                    config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.0';
                    config.buildSettings.MARKETING_VERSION = '1.0.0';
                    config.buildSettings.CURRENT_PROJECT_VERSION = '1';
                    config.buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
                    // Code signing - use hardcoded team ID
                    config.buildSettings.CODE_SIGN_STYLE = 'Automatic';
                    if (TEAM_ID) {
                        config.buildSettings.DEVELOPMENT_TEAM = TEAM_ID;
                    }
                }
            }
        }

        return mod;
    });
};

// ─── Main plugin export ──────────────────────────────────────────
const withShareExtension = (config) => {
    config = withAppGroupEntitlements(config);
    config = withShareExtensionTarget(config);
    return config;
};

module.exports = withShareExtension;
