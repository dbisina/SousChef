/**
 * Expo Config Plugin: Disable Resource Bundle Signing
 * 
 * Fixes Xcode 14+ issue where resource bundles are signed by default,
 * causing EAS builds to fail when the development team is not set for
 * CocoaPods resource bundle targets.
 * 
 * Reference: https://expo.fyi/r/disable-bundle-resource-signing
 */

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withDisableBundleSigning = (config) => {
    return withDangerousMod(config, [
        'ios',
        async (modConfig) => {
            const podfilePath = path.join(
                modConfig.modRequest.platformProjectRoot,
                'Podfile'
            );

            // Read existing Podfile
            let podfileContent = fs.readFileSync(podfilePath, 'utf8');

            // Code to disable code signing for resource bundles
            const disableSigningCode = `
    # Disable code signing for CocoaPods resource bundles (Xcode 14+ fix)
    installer.target_installation_results.pod_target_installation_results.each do |pod_name, target_installation_result|
      target_installation_result.resource_bundle_targets.each do |resource_bundle_target|
        resource_bundle_target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
    end

    # Set DEVELOPMENT_TEAM for all targets to enable automatic signing
    installer.generated_projects.each do |project|
      project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
        end
      end
    end
`;

            // Check if already added
            if (!podfileContent.includes('CODE_SIGNING_ALLOWED')) {
                // Find the post_install block and add our code inside it
                const postInstallRegex = /(post_install\s+do\s+\|installer\|)/;

                if (postInstallRegex.test(podfileContent)) {
                    // Add after the post_install opening
                    podfileContent = podfileContent.replace(
                        postInstallRegex,
                        `$1${disableSigningCode}`
                    );
                } else {
                    // If no post_install exists, add one at the end before final 'end'
                    const lastEndIndex = podfileContent.lastIndexOf('end');
                    if (lastEndIndex !== -1) {
                        podfileContent = podfileContent.slice(0, lastEndIndex) +
                            `\n  post_install do |installer|${disableSigningCode}  end\n` +
                            podfileContent.slice(lastEndIndex);
                    }
                }

                fs.writeFileSync(podfilePath, podfileContent);
            }

            return modConfig;
        },
    ]);
};

module.exports = withDisableBundleSigning;
