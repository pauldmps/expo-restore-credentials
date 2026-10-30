import { NativeModule, requireOptionalNativeModule } from 'expo';

import {
  CreateRestoreCredentialResult,
  ExpoRestoreCredentialsModuleEvents,
  RestoreCredentialResult,
  RestoreState,
} from './ExpoRestoreCredentials.types';

declare class ExpoRestoreCredentialsModule extends NativeModule<ExpoRestoreCredentialsModuleEvents> {
  isSupported(): boolean;
  getRestoreState(): RestoreState;
  markRestoreHandled(): void;
  createRestoreCredentialAsync(
    requestJson: string,
    options: { isCloudBackupEnabled: boolean; fallbackToLocalBackup: boolean }
  ): Promise<CreateRestoreCredentialResult | null>;
  getRestoreCredentialAsync(requestJson: string): Promise<RestoreCredentialResult | null>;
  clearRestoreCredentialAsync(): Promise<void>;
}

// Only implemented on Android; `null` on iOS and web.
export default requireOptionalNativeModule<ExpoRestoreCredentialsModule>('ExpoRestoreCredentials');
