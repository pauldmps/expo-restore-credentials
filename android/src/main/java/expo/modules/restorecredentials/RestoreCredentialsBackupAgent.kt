package expo.modules.restorecredentials

import android.app.backup.BackupAgent
import android.app.backup.BackupDataInput
import android.app.backup.BackupDataOutput
import android.os.ParcelFileDescriptor

/**
 * Registered by the config plugin together with `android:fullBackupOnly="true"`, so the system
 * keeps performing its regular Auto Backup and this agent only observes restores.
 *
 * `onRestoreFinished` is used rather than `onRestore`, which is only called for key-value backups.
 */
class RestoreCredentialsBackupAgent : BackupAgent() {
  override fun onBackup(
    oldState: ParcelFileDescriptor?,
    data: BackupDataOutput?,
    newState: ParcelFileDescriptor?
  ) = Unit

  override fun onRestore(
    data: BackupDataInput?,
    appVersionCode: Int,
    newState: ParcelFileDescriptor?
  ) = Unit

  override fun onRestoreFinished() {
    super.onRestoreFinished()
    RestoreCredentialsState.markRestoredFromBackup(applicationContext ?: this)
  }
}
