import {
  AndroidConfig,
  ConfigPlugin,
  WarningAggregator,
  createRunOncePlugin,
  withAndroidManifest,
  withGradleProperties,
} from 'expo/config-plugins';

const pkg = require('../../package.json');

const BACKUP_AGENT = 'expo.modules.restorecredentials.RestoreCredentialsBackupAgent';
const CREDENTIALS_VERSION_PROPERTY = 'expoRestoreCredentials.credentialsVersion';

export type RestoreCredentialsPluginProps = {
  /**
   * Register a backup agent that records when app data is restored, so
   * `shouldAttemptRestore()` returns `true` after a restore (and `onRestoreFinished` fires).
   * Also sets `android:fullBackupOnly="true"` to keep regular Auto Backup behavior.
   * Skipped with a warning if the app already declares its own `android:backupAgent`.
   * @default false
   */
  backupAgent?: boolean;
  /**
   * Version of `androidx.credentials` to compile against. Must be 1.5.0 or newer.
   * @default "1.6.0"
   */
  credentialsVersion?: string;
};

export const withRestoreCredentialsBackupAgent: ConfigPlugin<boolean> = (config, enabled) =>
  withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const attrs = application.$;
    const existingAgent = attrs['android:backupAgent'];

    if (!enabled) {
      // Undo a previous run when the option is turned off without a clean prebuild.
      if (existingAgent === BACKUP_AGENT) {
        delete attrs['android:backupAgent'];
        delete attrs['android:fullBackupOnly'];
      }
      return config;
    }

    if (existingAgent && existingAgent !== BACKUP_AGENT) {
      WarningAggregator.addWarningAndroid(
        'expo-restore-credentials',
        `The app already declares android:backupAgent="${existingAgent}". Call ` +
          `RestoreCredentialsState.markRestoredFromBackup(context) from its onRestoreFinished() instead.`
      );
      return config;
    }

    if (attrs['android:allowBackup'] === 'false') {
      WarningAggregator.addWarningAndroid(
        'expo-restore-credentials',
        'android:allowBackup is false, so the backup agent never runs. Restore keys still work ' +
          'without app data backup; set `backupAgent: false` to silence this warning.'
      );
    }

    attrs['android:backupAgent'] = BACKUP_AGENT;
    // A custom agent would otherwise switch the app to key-value backup.
    (attrs as Record<string, string>)['android:fullBackupOnly'] = 'true';
    return config;
  });

export const withRestoreCredentialsVersion: ConfigPlugin<string | undefined> = (config, version) =>
  withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === CREDENTIALS_VERSION_PROPERTY)
    );
    if (version) {
      config.modResults.push({ type: 'property', key: CREDENTIALS_VERSION_PROPERTY, value: version });
    }
    return config;
  });

const withRestoreCredentials: ConfigPlugin<RestoreCredentialsPluginProps | void> = (
  config,
  props
) => {
  config = withRestoreCredentialsBackupAgent(config, props?.backupAgent ?? false);
  config = withRestoreCredentialsVersion(config, props?.credentialsVersion);
  return config;
};

export default createRunOncePlugin(withRestoreCredentials, pkg.name, pkg.version);
