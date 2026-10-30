import type { EventSubscription } from 'expo';

import {
  CreateRestoreCredentialOptions,
  CreateRestoreCredentialResult,
  RestoreCredentialResult,
  RestoreState,
  WebAuthnRequestJson,
} from './ExpoRestoreCredentials.types';
import ExpoRestoreCredentials from './ExpoRestoreCredentialsModule';

export * from './ExpoRestoreCredentials.types';

/*
 * Every function is safe to call on any platform. Where Restore Credentials isn't available
 * (iOS, web, Android below 9, or outdated Google Play services) they resolve without doing
 * anything, so app code doesn't need platform checks.
 */

function toJson(request: WebAuthnRequestJson): string {
  return typeof request === 'string' ? request : JSON.stringify(request);
}

/**
 * Whether this device supports Restore Credentials: Android 9+ with Google Play services
 * 24.22 or newer.
 */
export function isSupported(): boolean {
  return ExpoRestoreCredentials?.isSupported() ?? false;
}

/**
 * Creates (or replaces) the restore key for the signed-in user. Call it after sign-in or
 * registration, and on app start for users who are already signed in.
 *
 * @param requestJson `PublicKeyCredentialCreationOptionsJSON` from your server.
 * @returns The registration response to send to your server, or `null` when unsupported.
 */
export async function createRestoreCredentialAsync(
  requestJson: WebAuthnRequestJson,
  options: CreateRestoreCredentialOptions = {}
): Promise<CreateRestoreCredentialResult | null> {
  if (!ExpoRestoreCredentials) {
    return null;
  }
  return ExpoRestoreCredentials.createRestoreCredentialAsync(toJson(requestJson), {
    isCloudBackupEnabled: options.isCloudBackupEnabled ?? true,
    fallbackToLocalBackup: options.fallbackToLocalBackup ?? true,
  });
}

/**
 * Silently retrieves the restore key on a new device. Never shows UI.
 *
 * @param requestJson `PublicKeyCredentialRequestOptionsJSON` from your server.
 * @returns The authentication response to send to your server, or `null` when there is no
 * restore key (or the feature is unsupported).
 */
export async function getRestoreCredentialAsync(
  requestJson: WebAuthnRequestJson
): Promise<RestoreCredentialResult | null> {
  if (!ExpoRestoreCredentials) {
    return null;
  }
  return ExpoRestoreCredentials.getRestoreCredentialAsync(toJson(requestJson));
}

/**
 * Deletes the restore key. Call it when the user signs out or deletes their account, and when
 * the server invalidates the session, so a future device starts signed out.
 */
export async function clearRestoreCredentialAsync(): Promise<void> {
  await ExpoRestoreCredentials?.clearRestoreCredentialAsync();
}

/**
 * Per-device restore bookkeeping. These markers are excluded from backups, so they reset on a
 * new device even when the rest of the app's data is restored.
 */
export function getRestoreState(): RestoreState {
  return (
    ExpoRestoreCredentials?.getRestoreState() ?? {
      isRestoreHandled: true,
      wasRestoredFromBackup: false,
      hasCreatedCredential: false,
    }
  );
}

/**
 * Whether the app should try `getRestoreCredentialAsync` now: the first launch on this device,
 * or app data was restored since the last attempt. Only check it when nobody is signed in.
 */
export function shouldAttemptRestore(): boolean {
  if (!isSupported()) {
    return false;
  }
  const state = getRestoreState();
  return !state.isRestoreHandled || state.wasRestoredFromBackup;
}

/** Records that a restore attempt finished (signed in or not), until the next data restore. */
export function markRestoreHandled(): void {
  ExpoRestoreCredentials?.markRestoreHandled();
}

/**
 * Called when app data finishes restoring while the app is running. Requires the `backupAgent`
 * plugin option.
 */
export function addRestoreFinishedListener(listener: () => void): EventSubscription | null {
  return ExpoRestoreCredentials?.addListener('onRestoreFinished', listener) ?? null;
}
