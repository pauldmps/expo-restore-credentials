package expo.modules.restorecredentials

import android.content.Context
import java.io.File
import java.lang.ref.WeakReference

/**
 * Per-device markers kept in `noBackupFilesDir`, so they are never copied to a new device by
 * cloud backup or device-to-device transfer. Their absence after a restore is what tells us
 * the app is running on a new device even though its regular data came along.
 */
object RestoreCredentialsState {
  private const val DIR_NAME = "expo-restore-credentials"
  private const val RESTORE_HANDLED = "restore_handled"
  private const val RESTORED_FROM_BACKUP = "restored_from_backup"
  private const val CREDENTIAL_CREATED = "credential_created"

  private var restoreListener: WeakReference<() -> Unit>? = null

  fun isRestoreHandled(context: Context) = marker(context, RESTORE_HANDLED).exists()

  fun wasRestoredFromBackup(context: Context) = marker(context, RESTORED_FROM_BACKUP).exists()

  fun hasCreatedCredential(context: Context) = marker(context, CREDENTIAL_CREATED).exists()

  fun markRestoreHandled(context: Context) {
    setMarker(context, RESTORE_HANDLED, true)
    setMarker(context, RESTORED_FROM_BACKUP, false)
  }

  fun setCredentialCreated(context: Context, created: Boolean) =
    setMarker(context, CREDENTIAL_CREATED, created)

  /**
   * Call from `BackupAgent.onRestoreFinished`. Use this directly if your app ships its own
   * backup agent instead of [RestoreCredentialsBackupAgent].
   */
  @JvmStatic
  fun markRestoredFromBackup(context: Context) {
    setMarker(context, RESTORED_FROM_BACKUP, true)
    setMarker(context, RESTORE_HANDLED, false)
    restoreListener?.get()?.invoke()
  }

  internal fun setRestoreListener(listener: (() -> Unit)?) {
    restoreListener = listener?.let { WeakReference(it) }
  }

  private fun marker(context: Context, name: String) =
    File(File(context.noBackupFilesDir, DIR_NAME), name)

  private fun setMarker(context: Context, name: String, value: Boolean) {
    val file = marker(context, name)
    if (value) {
      file.parentFile?.mkdirs()
      file.createNewFile()
    } else {
      file.delete()
    }
  }
}
