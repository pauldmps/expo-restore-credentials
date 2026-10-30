/**
 * A WebAuthn options object, either as a JSON string or an object that will be serialized
 * with `JSON.stringify`. This is what your relying party server returns for passkeys.
 */
export type WebAuthnRequestJson = string | Record<string, unknown>;

export type CreateRestoreCredentialOptions = {
  /**
   * Back the restore key up to the cloud when Google Backup and end-to-end encryption are
   * available. Without it, only device-to-device transfers can restore the key.
   * @default true
   */
  isCloudBackupEnabled?: boolean;
  /**
   * When the device can't back up with end-to-end encryption (for example, it has no screen
   * lock), retry with cloud backup disabled instead of throwing `ERR_E2EE_UNAVAILABLE`.
   * @default true
   */
  fallbackToLocalBackup?: boolean;
};

export type CreateRestoreCredentialResult = {
  /** WebAuthn registration response JSON. Send it to your server to register the restore key. */
  responseJson: string;
  /** Whether the key was created with cloud backup. `false` after a local-only fallback. */
  isCloudBackupEnabled: boolean;
};

export type RestoreCredentialResult = {
  /** WebAuthn authentication response JSON. Send it to your server to sign the user in. */
  authenticationResponseJson: string;
};

export type RestoreState = {
  /** `markRestoreHandled()` has been called on this device since the last restore. */
  isRestoreHandled: boolean;
  /**
   * App data was restored from a backup or device transfer. Only reported when the
   * `backupAgent` plugin option is enabled (or your own agent calls
   * `RestoreCredentialsState.markRestoredFromBackup`).
   */
  wasRestoredFromBackup: boolean;
  /** A restore key was created on this device and hasn't been cleared since. */
  hasCreatedCredential: boolean;
};

export type RestoreCredentialsErrorCode =
  | 'ERR_INVALID_REQUEST'
  | 'ERR_E2EE_UNAVAILABLE'
  | 'ERR_CANCELED'
  | 'ERR_CREATE_CREDENTIAL'
  | 'ERR_GET_CREDENTIAL'
  | 'ERR_CLEAR_CREDENTIAL';

export type ExpoRestoreCredentialsModuleEvents = {
  /** App data finished restoring while the app was running. Try a restore sign-in now. */
  onRestoreFinished: () => void;
};
