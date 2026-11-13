/**
 * Expo Config Plugin: raise the minimum iOS deployment target of every Pod.
 *
 * Recent Xcode versions (EAS `image: latest`) reject targets below 15.0, and
 * several pods still declare 9.0 to 13.4 (RevenueCat, SDWebImage, RNSVG,
 * AsyncStorage resource bundles). Bumping them in the Podfile post_install
 * keeps the build independent of the Xcode image.
 */

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'withPodsMinDeploymentTarget';

const withPodsMinDeploymentTarget = (config, props = {}) => {
    const minTarget = props.minTarget || '16.4';

    return withDangerousMod(config, [
        'ios',
        async (modConfig) => {
            const podfilePath = path.join(
                modConfig.modRequest.platformProjectRoot,
                'Podfile'
            );

            let podfile = fs.readFileSync(podfilePath, 'utf8');
            if (podfile.includes(MARKER)) {
                return modConfig;
            }

            const bump = `
    # ${MARKER}: raise pod deployment targets below ${minTarget} (new Xcode rejects them)
    min_pod_target = '${minTarget}'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current.to_s) < Gem::Version.new(min_pod_target)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_pod_target
        end
      end
    end
`;

            const postInstall = /(post_install\s+do\s+\|installer\|)/;
            if (postInstall.test(podfile)) {
                podfile = podfile.replace(postInstall, `$1${bump}`);
            } else {
                const lastEnd = podfile.lastIndexOf('end');
                podfile =
                    podfile.slice(0, lastEnd) +
                    `\n  post_install do |installer|${bump}  end\n` +
                    podfile.slice(lastEnd);
            }

            fs.writeFileSync(podfilePath, podfile);
            return modConfig;
        },
    ]);
};

module.exports = withPodsMinDeploymentTarget;
