import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API, setTokens } from '@/hooks/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Screen = 'login' | 'register';

interface AuthGateProps {
  onAuthSuccess: () => void;
}

export default function AuthGate({ onAuthSuccess }: AuthGateProps) {
  const [screen, setScreen] = useState<Screen>('login');

  if (screen === 'login') {
    return (
      <LoginView
        onAuthSuccess={onAuthSuccess}
        onGoToRegister={() => setScreen('register')}
      />
    );
  }

  return (
    <RegisterView
      onAuthSuccess={onAuthSuccess}
      onGoToLogin={() => setScreen('login')}
    />
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

interface LoginViewProps {
  onAuthSuccess: () => void;
  onGoToRegister: () => void;
}

function LoginView({ onAuthSuccess, onGoToRegister }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await API.login({ email, password });
      if (response.ok) {
        const data = await response.json();
        const accessToken = data.accessToken ?? data.access_token;
        const refreshToken = data.refreshToken ?? data.refresh_token;

        if (!accessToken || !refreshToken) {
          Alert.alert('Login Failed', 'Missing authentication tokens in response');
          return;
        }

        await setTokens(accessToken, refreshToken);
        onAuthSuccess();
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Login Failed', errorData.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>InstaSwipe</ThemedText>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Email"
              placeholderTextColor={theme.iconMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Password"
              placeholderTextColor={theme.iconMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Login</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <ThemedText>Don't have an account? </ThemedText>
            <TouchableOpacity onPress={onGoToRegister}>
              <ThemedText style={{ color: theme.backgroundElement, fontWeight: 'bold' }}>
                Register
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

interface RegisterViewProps {
  onAuthSuccess: () => void;
  onGoToLogin: () => void;
}

function RegisterView({ onAuthSuccess, onGoToLogin }: RegisterViewProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleRegister = async () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isAgeConfirmed) {
      Alert.alert('Age Requirement', 'You must be at least 18 years old to register.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await API.register({ email, name: username, password });
      if (response.ok) {
        const data = await response.json();
        const accessToken = data.accessToken ?? data.access_token;
        const refreshToken = data.refreshToken ?? data.refresh_token;

        if (accessToken && refreshToken) {
          await setTokens(accessToken, refreshToken);
          onAuthSuccess();
        } else {
          Alert.alert('Success', 'Account created! Please log in.', [
            { text: 'OK', onPress: onGoToLogin },
          ]);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Registration Failed', errorData.message || 'Could not create account');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>Register</ThemedText>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Email"
              placeholderTextColor={theme.iconMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Username"
              placeholderTextColor={theme.iconMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Password"
              placeholderTextColor={theme.iconMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Confirm Password"
              placeholderTextColor={theme.iconMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <View style={styles.ageRow}>
              <Switch
                value={isAgeConfirmed}
                onValueChange={setIsAgeConfirmed}
                trackColor={{ false: '#555', true: '#6c63ff' }}
                thumbColor={isAgeConfirmed ? '#fff' : '#ccc'}
              />
              <ThemedText style={styles.ageLabel}>
                I confirm I am at least 18 years old
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Register</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <ThemedText>Already have an account? </ThemedText>
            <TouchableOpacity onPress={onGoToLogin}>
              <ThemedText style={{ color: theme.backgroundElement, fontWeight: 'bold' }}>
                Login
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.six,
    opacity: 0.7,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ageLabel: {
    flex: 1,
    fontSize: 14,
    opacity: 0.85,
  },
});
