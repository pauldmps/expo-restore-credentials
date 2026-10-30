# Credential Manager loads the Play services provider reflectively.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}

-keep class expo.modules.restorecredentials.RestoreCredentialsBackupAgent { *; }
