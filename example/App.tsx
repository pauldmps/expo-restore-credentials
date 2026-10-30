import * as RestoreCredentials from 'expo-restore-credentials';
import { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native';

// Demo-only WebAuthn options. In a real app these come from your relying party server, which
// also verifies the responses. The rp.id must be a domain linked to the app via Digital Asset Links.
const RP_ID = 'example.com';

function randomBase64Url(bytes: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from({ length: Math.ceil((bytes * 4) / 3) }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

function demoCreationOptions() {
  return {
    challenge: randomBase64Url(32),
    rp: { id: RP_ID, name: 'Example' },
    user: { id: randomBase64Url(16), name: 'demo@example.com', displayName: 'Demo User' },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60000,
    attestation: 'none',
    excludeCredentials: [],
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  };
}

function demoRequestOptions() {
  return {
    challenge: randomBase64Url(32),
    rpId: RP_ID,
    allowCredentials: [],
    timeout: 60000,
    userVerification: 'preferred',
  };
}

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const [state, setState] = useState(RestoreCredentials.getRestoreState());

  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 20));
  const refresh = () => setState(RestoreCredentials.getRestoreState());

  useEffect(() => {
    const subscription = RestoreCredentials.addRestoreFinishedListener(() => {
      append('onRestoreFinished');
      refresh();
    });
    return () => subscription?.remove();
  }, []);

  const run = (label: string, action: () => Promise<unknown>) => async () => {
    try {
      const result = await action();
      append(`${label}: ${JSON.stringify(result)}`);
    } catch (e: any) {
      append(`${label} failed: ${e.code ?? ''} ${e.message}`);
    }
    refresh();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Restore Credentials</Text>
        <Group name="Status">
          <Text>isSupported: {String(RestoreCredentials.isSupported())}</Text>
          <Text>shouldAttemptRestore: {String(RestoreCredentials.shouldAttemptRestore())}</Text>
          <Text>{JSON.stringify(state, null, 2)}</Text>
        </Group>
        <Group name="Actions">
          <Button
            title="Create restore key"
            onPress={run('create', () =>
              RestoreCredentials.createRestoreCredentialAsync(demoCreationOptions())
            )}
          />
          <Button
            title="Get restore key"
            onPress={run('get', () =>
              RestoreCredentials.getRestoreCredentialAsync(demoRequestOptions())
            )}
          />
          <Button
            title="Clear restore key"
            onPress={run('clear', () => RestoreCredentials.clearRestoreCredentialAsync())}
          />
          <Button
            title="Mark restore handled"
            onPress={run('markRestoreHandled', async () => RestoreCredentials.markRestoreHandled())}
          />
        </Group>
        <Group name="Log">
          {log.map((line, i) => (
            <Text key={i} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  header: { fontSize: 30, margin: 20 },
  groupHeader: { fontSize: 20, marginBottom: 20 },
  group: { margin: 20, backgroundColor: '#fff', borderRadius: 10, padding: 20, gap: 8 },
  container: { flex: 1, backgroundColor: '#eee' },
  logLine: { fontFamily: 'monospace', fontSize: 12 },
};
