# expo-restore-credentials

Android [Restore Credentials](https://developer.android.com/identity/sign-in/restore-credentials-implementation) for Expo apps. It signs users back in automatically when they move to a new Android device, which is what Google Play's [zero-tap sign-in restoration](https://support.google.com/googleplay/android-developer/answer/17492799#zero-tap_sign-in_restoration) requirement asks for (enforced from April 2027 for apps with sign-in).

- Expo Modules API (Kotlin), so it works with the New Architecture and needs no extra setup
- Config plugin for Continuous Native Generation (CNG): `npx expo prebuild` / EAS Build
- Safe to call on every platform. On iOS, web, Android 8 and below, or devices with outdated Google Play services, every call resolves without doing anything.

## How it works

A *restore key* is a WebAuthn (passkey-style) credential that Credential Manager stores per app and backs up with the device. Your server registers its public key. On a new device, the app reads the key silently, with no UI, and your server verifies the signed assertion just like a passkey sign-in.

```
Old device                         Your server                  New device
──────────                         ───────────                  ──────────
signed in → createRestoreCredentialAsync(creationOptions)
          → responseJson ────────► register restore key
                                                   (backup / device transfer)
                                   verify assertion ◄────────── getRestoreCredentialAsync(requestOptions)
                                   → session ─────────────────► signed in, zero taps
signs out → clearRestoreCredentialAsync()
```

## Requirements

- Android 9 (API 28)+ with Google Play services 24.22+ at runtime (check with `isSupported()`)
- `androidx.credentials` 1.5.0+ (the module uses 1.6.0 by default)
- A relying party server that can create and verify WebAuthn credentials. If you support passkeys, reuse that code. Store restore keys separately from user-created passkeys, because they shouldn't appear in a passkey management screen.
- The `rp.id` must be a domain linked to your app with [Digital Asset Links](https://developer.android.com/identity/sign-in/credential-manager#add-support-dal), as for passkeys.

## Installation

```sh
npx expo install expo-restore-credentials
```

Add the plugin to `app.json` / `app.config.ts`:

```json
{
  "expo": {
    "plugins": [["expo-restore-credentials", { "backupAgent": true }]]
  }
}
```

Then rebuild the native app (`npx expo prebuild` or an EAS build). The module doesn't work in Expo Go.

### Plugin options

| Option               | Default   | Description                                                                                                                                                                                                                                                                                         |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backupAgent`        | `false`   | Registers `RestoreCredentialsBackupAgent` and sets `android:fullBackupOnly="true"`, so Auto Backup works as before. The agent records when app data is restored, so `shouldAttemptRestore()` returns `true` and `onRestoreFinished` fires. If your app already declares a backup agent, the plugin skips this step and warns you (see [Existing backup agent](#existing-backup-agent)). |
| `credentialsVersion` | `"1.6.0"` | The `androidx.credentials` version to compile against. Use 1.5.0 or newer.                                                                                                                                                                                                                            |

`backupAgent` is recommended when `android:allowBackup` is `true` (the Expo default). Restored app data often includes a stored session or a "has launched" flag. Without the agent, the app can't tell that it's running on a new device.

## Usage

### 1. Create the restore key while signed in

Create the key right after sign-in or registration, and on app start for users who are already signed in.

```ts
import * as RestoreCredentials from 'expo-restore-credentials';

async function syncRestoreKey() {
  if (!RestoreCredentials.isSupported()) return;

  // PublicKeyCredentialCreationOptionsJSON for the signed-in user
  const options = await api.get('/restore-key/registration-options');
  const result = await RestoreCredentials.createRestoreCredentialAsync(options);
  if (result) {
    await api.post('/restore-key/register', JSON.parse(result.responseJson));
  }
}

// On app start, only create the key if this device doesn't have one yet:
if (session && !RestoreCredentials.getRestoreState().hasCreatedCredential) {
  syncRestoreKey();
}
```

Cloud backup is enabled by default. If the device can't back up with end-to-end encryption (for example, it has no screen lock), the module retries with a local-only key automatically, and `result.isCloudBackupEnabled` is `false`. A local-only key still works for device-to-device transfers. To get `ERR_E2EE_UNAVAILABLE` instead, pass `{ fallbackToLocalBackup: false }`.

With multiple accounts, create the key for the currently active account. Creating a new key replaces the previous one.

### 2. Sign in silently on a new device

```ts
async function tryRestoreSignIn() {
  if (session || !RestoreCredentials.shouldAttemptRestore()) return;
  try {
    // PublicKeyCredentialRequestOptionsJSON, as for a passkey sign-in
    const options = await api.get('/restore-key/authentication-options');
    const result = await RestoreCredentials.getRestoreCredentialAsync(options);
    if (result) {
      const session = await api.post(
        '/restore-key/authenticate',
        JSON.parse(result.authenticationResponseJson)
      );
      await saveSession(session);
      await syncRestoreKey(); // register a fresh key on this device as well
      // Notifications aren't restored automatically. Re-register for push here.
    }
    RestoreCredentials.markRestoreHandled();
  } catch (e) {
    // Network failure etc. Leave it unhandled so the next launch retries.
  }
}

// On launch:
tryRestoreSignIn();

// If data is restored while the app is running (requires `backupAgent: true`):
RestoreCredentials.addRestoreFinishedListener(tryRestoreSignIn);
```

`getRestoreCredentialAsync` resolves to `null` when the device has no restore key, for example after the user signed out on the old device. In that case, show your normal signed-out or guest experience.

The restore re-establishes identity only. Ask for authorization scopes in context later. Don't add an MFA step, because a device transfer is already strong proof of possession.

### 3. Delete the key on sign-out

```ts
async function signOut() {
  await RestoreCredentials.clearRestoreCredentialAsync();
  await api.post('/logout');
  clearSession();
}
```

Also clear the key on account deletion and whenever your server invalidates the session (for example, an HTTP 401 or a password change). Otherwise a new device would try to restore a dead session.

## API

| Function                                                     | Returns                                          |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `isSupported()`                                              | `boolean`                                        |
| `createRestoreCredentialAsync(creationOptions, options?)`    | `Promise<{ responseJson, isCloudBackupEnabled } \| null>` |
| `getRestoreCredentialAsync(requestOptions)`                  | `Promise<{ authenticationResponseJson } \| null>` |
| `clearRestoreCredentialAsync()`                              | `Promise<void>`                                  |
| `shouldAttemptRestore()`                                     | `boolean`. `true` on the first launch on this device, or after a data restore. |
| `markRestoreHandled()`                                       | `void`                                           |
| `getRestoreState()`                                          | `{ isRestoreHandled, wasRestoredFromBackup, hasCreatedCredential }` |
| `addRestoreFinishedListener(listener)`                       | `EventSubscription \| null`                      |

You can pass WebAuthn options as a JSON string or as an object. Responses are JSON strings in the standard WebAuthn `RegistrationResponseJSON` / `AuthenticationResponseJSON` format, so server libraries such as SimpleWebAuthn or webauthn4j can verify them directly.

The restore-state markers are kept in Android's `noBackupFilesDir`. Backups never copy them to a new device, so `shouldAttemptRestore()` is `true` on a new device even when the rest of the app's data is restored. Apps that are already installed also report `true` once, on the first launch after this library is added. Gate the attempt on "not signed in", as shown above.

### Errors

Rejections carry a `code`:

| Code                    | Meaning                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `ERR_INVALID_REQUEST`   | The WebAuthn JSON is malformed, or `user.id` doesn't meet the WebAuthn spec.       |
| `ERR_E2EE_UNAVAILABLE`  | Cloud backup was requested but isn't available, and the fallback is disabled.      |
| `ERR_CANCELED`          | The request was canceled.                                                          |
| `ERR_CREATE_CREDENTIAL` | Any other Credential Manager create error.                                         |
| `ERR_GET_CREDENTIAL`    | Any other Credential Manager get error.                                            |
| `ERR_CLEAR_CREDENTIAL`  | Clearing the credential state failed.                                              |

## Existing backup agent

If your app ships its own `android:backupAgent`, leave `backupAgent` off. Instead, notify the module from your agent:

```kotlin
override fun onRestoreFinished() {
  super.onRestoreFinished()
  expo.modules.restorecredentials.RestoreCredentialsState.markRestoredFromBackup(this)
}
```

Use `onRestoreFinished`, not `onRestore`. `onRestore` is only called for key-value backups.

## Testing

- Create a key, then call `getRestoreCredentialAsync` on the same device. It returns the key.
- Use a second device and restore from cloud backup, or do a device-to-device transfer during setup. See Google's [testing guide](https://developer.android.com/identity/sign-in/restore-credentials-implementation).
- Simulate a data restore to exercise the backup agent:
  ```sh
  adb shell bmgr enable true
  adb shell bmgr transport com.android.localtransport/.LocalTransport
  adb shell bmgr backupnow <package>
  adb shell bmgr restore 1 <package>
  ```

The `example/` app has buttons for each call. It uses demo WebAuthn options generated on the device, so it can create and read keys, but nothing is verified by a server.

```sh
cd example && npm install && npx expo run:android
```

## License

MIT
