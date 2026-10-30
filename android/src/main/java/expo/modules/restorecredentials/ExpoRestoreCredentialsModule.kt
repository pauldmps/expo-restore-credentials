package expo.modules.restorecredentials

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.pm.PackageInfoCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CreateRestoreCredentialRequest
import androidx.credentials.CreateRestoreCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetRestoreCredentialOption
import androidx.credentials.RestoreCredential
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.restorecredential.CreateRestoreCredentialDomException
import androidx.credentials.exceptions.restorecredential.E2eeUnavailableException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// Restore Credentials needs Android 9 and Google Play services 24.22 or newer.
private const val MIN_SDK_INT = Build.VERSION_CODES.P
private const val MIN_GMS_VERSION_CODE = 242200000L
private const val GMS_PACKAGE = "com.google.android.gms"

private const val ON_RESTORE_FINISHED = "onRestoreFinished"

class CreateOptions : Record {
  @Field
  val isCloudBackupEnabled: Boolean = true

  @Field
  val fallbackToLocalBackup: Boolean = true
}

class ExpoRestoreCredentialsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  // Credential Manager prefers an Activity context, but restore keys never show UI, so the
  // application context is an acceptable fallback (e.g. when called from a headless task).
  private val credentialContext: Context
    get() = appContext.currentActivity ?: context

  private val credentialManager by lazy { CredentialManager.create(context) }

  // Held strongly here; RestoreCredentialsState only keeps a weak reference.
  private val restoreListener: () -> Unit = { sendEvent(ON_RESTORE_FINISHED, emptyMap<String, Any>()) }

  override fun definition() = ModuleDefinition {
    Name("ExpoRestoreCredentials")

    Events(ON_RESTORE_FINISHED)

    OnStartObserving(ON_RESTORE_FINISHED) {
      RestoreCredentialsState.setRestoreListener(restoreListener)
    }

    OnStopObserving(ON_RESTORE_FINISHED) {
      RestoreCredentialsState.setRestoreListener(null)
    }

    Function("isSupported") {
      isSupported()
    }

    Function("getRestoreState") {
      mapOf(
        "isRestoreHandled" to RestoreCredentialsState.isRestoreHandled(context),
        "wasRestoredFromBackup" to RestoreCredentialsState.wasRestoredFromBackup(context),
        "hasCreatedCredential" to RestoreCredentialsState.hasCreatedCredential(context)
      )
    }

    Function("markRestoreHandled") {
      RestoreCredentialsState.markRestoreHandled(context)
    }

    AsyncFunction("createRestoreCredentialAsync") Coroutine { requestJson: String, options: CreateOptions ->
      if (!isSupported()) {
        return@Coroutine null
      }
      val (response, cloudBackupEnabled) = try {
        createRestoreCredential(requestJson, options.isCloudBackupEnabled) to options.isCloudBackupEnabled
      } catch (e: E2eeUnavailableException) {
        // The device has no Google Backup or end-to-end encryption (e.g. no screen lock).
        // Keep the key on-device so device-to-device transfers still work.
        if (!options.isCloudBackupEnabled || !options.fallbackToLocalBackup) {
          throw RestoreCredentialException("ERR_E2EE_UNAVAILABLE", e)
        }
        createRestoreCredential(requestJson, false) to false
      }
      RestoreCredentialsState.setCredentialCreated(context, true)
      mapOf(
        "responseJson" to response.responseJson,
        "isCloudBackupEnabled" to cloudBackupEnabled
      )
    }

    AsyncFunction("getRestoreCredentialAsync") Coroutine { requestJson: String ->
      if (!isSupported()) {
        return@Coroutine null
      }
      val request = GetCredentialRequest(listOf(GetRestoreCredentialOption(requestJson)))
      val credential = try {
        credentialManager.getCredential(credentialContext, request).credential
      } catch (e: NoCredentialException) {
        return@Coroutine null
      } catch (e: GetCredentialCancellationException) {
        throw RestoreCredentialException("ERR_CANCELED", e)
      } catch (e: GetCredentialException) {
        throw RestoreCredentialException("ERR_GET_CREDENTIAL", e)
      } catch (e: IllegalArgumentException) {
        throw RestoreCredentialException("ERR_INVALID_REQUEST", e)
      }
      val restoreCredential = credential as? RestoreCredential
        ?: throw RestoreCredentialException(
          "ERR_GET_CREDENTIAL",
          "Unexpected credential type: ${credential.type}",
          null
        )
      mapOf("authenticationResponseJson" to restoreCredential.authenticationResponseJson)
    }

    AsyncFunction("clearRestoreCredentialAsync") Coroutine { ->
      if (Build.VERSION.SDK_INT >= MIN_SDK_INT) {
        try {
          credentialManager.clearCredentialState(
            ClearCredentialStateRequest(ClearCredentialStateRequest.TYPE_CLEAR_RESTORE_CREDENTIAL)
          )
        } catch (e: ClearCredentialException) {
          throw RestoreCredentialException("ERR_CLEAR_CREDENTIAL", e)
        }
      }
      RestoreCredentialsState.setCredentialCreated(context, false)
    }

    OnDestroy {
      RestoreCredentialsState.setRestoreListener(null)
    }
  }

  private suspend fun createRestoreCredential(
    requestJson: String,
    isCloudBackupEnabled: Boolean
  ): CreateRestoreCredentialResponse {
    try {
      val request = CreateRestoreCredentialRequest(requestJson, isCloudBackupEnabled)
      return credentialManager.createCredential(credentialContext, request) as CreateRestoreCredentialResponse
    } catch (e: E2eeUnavailableException) {
      throw e
    } catch (e: CreateRestoreCredentialDomException) {
      throw RestoreCredentialException("ERR_INVALID_REQUEST", e)
    } catch (e: IllegalArgumentException) {
      throw RestoreCredentialException("ERR_INVALID_REQUEST", e)
    } catch (e: CreateCredentialCancellationException) {
      throw RestoreCredentialException("ERR_CANCELED", e)
    } catch (e: CreateCredentialException) {
      throw RestoreCredentialException("ERR_CREATE_CREDENTIAL", e)
    }
  }

  private fun isSupported(): Boolean {
    if (Build.VERSION.SDK_INT < MIN_SDK_INT) {
      return false
    }
    return try {
      val info = context.packageManager.getPackageInfo(GMS_PACKAGE, 0)
      PackageInfoCompat.getLongVersionCode(info) >= MIN_GMS_VERSION_CODE
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }
}

class RestoreCredentialException(code: String, message: String?, cause: Throwable?) :
  CodedException(code, message, cause) {
  constructor(code: String, cause: Throwable) :
    this(code, "${cause.javaClass.simpleName}: ${cause.message}", cause)
}
