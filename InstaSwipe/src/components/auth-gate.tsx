import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API, setTokens } from '@/hooks/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Screen = 'login' | 'register' | 'forgotPassword' | 'verifyEmail';

interface AuthGateProps {
  onAuthSuccess: () => void;
}

function errorHandle(error: string) {
  if (Platform.OS === 'web') {
    alert('Error: ' + error);
  } else {
    Alert.alert('Error', error);
  }
}

export default function AuthGate({ onAuthSuccess }: AuthGateProps) {
  const [screen, setScreen] = useState<Screen>('login');
  // Carried in memory only (never persisted) so VerifyEmailView can silently
  // retry login once the code is accepted, instead of making the user type
  // their password again right after they just typed it on register/login.
  const [pendingAuth, setPendingAuth] = useState<{ email: string; password: string } | null>(null);

  const onNeedsVerification = (email: string, password: string) => {
    setPendingAuth({ email, password });
    setScreen('verifyEmail');
  };

  if (screen === 'login') {
    return (
      <LoginView
        onAuthSuccess={onAuthSuccess}
        onGoToRegister={() => setScreen('register')}
        onGoToForgotPassword={() => setScreen('forgotPassword')}
        onNeedsVerification={onNeedsVerification}
      />
    );
  }

  if (screen === 'forgotPassword') {
    return <ForgotPasswordView onBackToLogin={() => setScreen('login')} />;
  }

  if (screen === 'verifyEmail' && pendingAuth) {
    return (
      <VerifyEmailView
        email={pendingAuth.email}
        password={pendingAuth.password}
        onAuthSuccess={onAuthSuccess}
        onBackToLogin={() => {
          setPendingAuth(null);
          setScreen('login');
        }}
      />
    );
  }

  return (
    <RegisterView
      onAuthSuccess={onAuthSuccess}
      onGoToLogin={() => setScreen('login')}
      onNeedsVerification={onNeedsVerification}
    />
  );
}

interface LoginViewProps {
  onAuthSuccess: () => void;
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
  onNeedsVerification: (email: string, password: string) => void;
}

function LoginView({ onAuthSuccess, onGoToRegister, onGoToForgotPassword, onNeedsVerification }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) {
      errorHandle('Please fill in all fields');
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
          errorHandle('Login Failed: Missing authentication tokens in response');
          return;
        }

        await setTokens(accessToken, refreshToken);
        onAuthSuccess();
      } else if (response.status === 403) {
        // EmailNotVerifiedException: the only thing /api/auth/login returns 403 for.
        onNeedsVerification(email, password);
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'Invalid credentials');
      }
    } catch {
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
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

                <TouchableOpacity onPress={onGoToForgotPassword} style={styles.linkButton}>
                  <ThemedText style={[styles.linkText, { color: theme.backgroundElement }]}>Forgot Password?</ThemedText>
                </TouchableOpacity>

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
                <ThemedText>Don&apos;t have an account? </ThemedText>
                <TouchableOpacity onPress={onGoToRegister}>
                  <ThemedText style={{ color: theme.backgroundElement, fontWeight: 'bold' }}>
                    Register
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
}

type ForgotPasswordStep = 'email' | 'otp' | 'reset';

function ForgotPasswordView({ onBackToLogin }: ForgotPasswordViewProps) {
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleSendCode = async () => {
    if (!email) {
      errorHandle('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const response = await API.forgotPassword({ email });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.message || 'If an account exists for that email, a reset code has been sent.');
        setStep('otp');
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'Could not send a reset code');
      }
    } catch {
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpToken) {
      errorHandle('Please enter the reset code');
      return;
    }

    setLoading(true);
    try {
      const response = await API.verifyPasswordReset({ email, otpToken });
      if (response.ok) {
        setMessage('Code verified. Please choose a new password.');
        setStep('reset');
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'The reset code is invalid or has expired');
      }
    } catch {
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      errorHandle('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      errorHandle('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await API.resetPassword({ email, otpToken, newPassword });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.message || 'Password updated successfully.');
        const redirectToLogin = () => {
          onBackToLogin();
          router.replace('/auth/login');
        };

        if (Platform.OS === 'web') {
          alert('Password updated successfully. Please sign in with your new password.');
          redirectToLogin();
        } else {
          Alert.alert('Success', 'Password updated successfully. Please sign in with your new password.', [
            { text: 'OK', onPress: redirectToLogin },
          ]);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'Could not reset password');
      }
    } catch {
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.content}>
              <ThemedText type="title" style={styles.title}>Reset Password</ThemedText>
              <ThemedText style={styles.subtitle}>
                {step === 'email'
                  ? 'Enter your email address and we will send you a one-time reset code.'
                  : step === 'otp'
                    ? 'Enter the code sent to your email to continue.'
                    : 'Choose a new password for your account.'}
              </ThemedText>

              {message ? <ThemedText style={styles.helperText}>{message}</ThemedText> : null}

              {step === 'email' ? (
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
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                    onPress={handleSendCode}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Send Reset Code</ThemedText>}
                  </TouchableOpacity>
                </View>
              ) : null}

              {step === 'otp' ? (
                <View style={styles.form}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                    placeholder="Reset code"
                    placeholderTextColor={theme.iconMuted}
                    value={otpToken}
                    onChangeText={setOtpToken}
                    autoCapitalize="none"
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Verify Code</ThemedText>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStep('email')} style={styles.linkButton}>
                    <ThemedText style={[styles.linkText, { color: theme.backgroundElement }]}>Use a different email</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              {step === 'reset' ? (
                <View style={styles.form}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                    placeholder="New Password"
                    placeholderTextColor={theme.iconMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                    placeholder="Confirm New Password"
                    placeholderTextColor={theme.iconMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                    onPress={handleResetPassword}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Reset Password</ThemedText>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStep('otp')} style={styles.linkButton}>
                    <ThemedText style={[styles.linkText, { color: theme.backgroundElement }]}>Back</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.footer}>
                <ThemedText>Remembered your password? </ThemedText>
                <TouchableOpacity onPress={onBackToLogin}>
                  <ThemedText style={{ color: theme.backgroundElement, fontWeight: 'bold' }}>Login</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

interface VerifyEmailViewProps {
  email: string;
  password: string;
  onAuthSuccess: () => void;
  onBackToLogin: () => void;
}

function VerifyEmailView({ email, password, onAuthSuccess, onBackToLogin }: VerifyEmailViewProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleVerify = async () => {
    if (!code) {
      errorHandle('Please enter the code we emailed you');
      return;
    }

    setLoading(true);
    try {
      const response = await API.verifyEmail({ email, code });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'The code is invalid or has expired');
        return;
      }

      // verify-email doesn't issue tokens, so log in with the credentials the
      // user already typed on register/login instead of asking for them again.
      const loginResponse = await API.login({ email, password });
      if (loginResponse.ok) {
        const data = await loginResponse.json();
        const accessToken = data.accessToken ?? data.access_token;
        const refreshToken = data.refreshToken ?? data.refresh_token;
        if (accessToken && refreshToken) {
          await setTokens(accessToken, refreshToken);
          onAuthSuccess();
          return;
        }
      }

      // Fallback: verification succeeded but the auto-login retry didn't -
      // don't strand them, send them to sign in manually.
      const goToLogin = () => onBackToLogin();
      if (Platform.OS === 'web') {
        alert('Email verified. Please sign in.');
        goToLogin();
      } else {
        Alert.alert('Success', 'Email verified. Please sign in.', [{ text: 'OK', onPress: goToLogin }]);
      }
    } catch {
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const response = await API.resendVerification({ email });
      if (response.ok) {
        setMessage('A new code has been sent.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'Could not resend the code');
      }
    } catch {
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.content}>
              <ThemedText type="title" style={styles.title}>Verify your email</ThemedText>
              <ThemedText style={styles.subtitle}>
                We sent a code to {email}. Enter it below to continue.
              </ThemedText>

              {message ? <ThemedText style={styles.helperText}>{message}</ThemedText> : null}

              <View style={styles.form}>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                  placeholder="Verification code"
                  placeholderTextColor={theme.iconMuted}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.backgroundElement }]}
                  onPress={handleVerify}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Verify</ThemedText>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResend} style={styles.linkButton} disabled={loading}>
                  <ThemedText style={[styles.linkText, { color: theme.backgroundElement }]}>Resend code</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity onPress={onBackToLogin}>
                  <ThemedText style={{ color: theme.backgroundElement, fontWeight: 'bold' }}>Back to login</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

interface RegisterViewProps {
  onAuthSuccess: () => void;
  onGoToLogin: () => void;
  onNeedsVerification: (email: string, password: string) => void;
}

function RegisterView({ onAuthSuccess, onGoToLogin, onNeedsVerification }: RegisterViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const passwordRequirements = [
    { label: 'Between 8 and 100 characters', met: password.length >= 8 && password.length <= 100 },
    { label: 'An uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'A lowercase letter', met: /[a-z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'A special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const isPasswordValid = passwordRequirements.every((requirement) => requirement.met);
  const doPasswordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      errorHandle('Please fill in all fields');
      return;
    }

    if (!isAgeConfirmed) {
      errorHandle('You must be at least 18 years old to register.');
      return;
    }

    if (!isPasswordValid) {
      errorHandle('Please make sure your password meets all of the requirements.');
      return;
    }

    if (password !== confirmPassword) {
      errorHandle('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await API.register({ email, name: email, password });
      if (response.ok) {
        const data = await response.json();
        const accessToken = data.accessToken ?? data.access_token;
        const refreshToken = data.refreshToken ?? data.refresh_token;

        if (accessToken && refreshToken) {
          await setTokens(accessToken, refreshToken);
          onAuthSuccess();
        } else {
          // Registration never issues tokens; a verification email was just sent
          // (AuthService.register), so take them straight to entering the code.
          onNeedsVerification(email, password);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        errorHandle(errorData.message || 'Could not create account');
      }
    } catch (error) {
      console.error(error);
      errorHandle('Registration Failed: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
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
                  placeholder="Password"
                  placeholderTextColor={theme.iconMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <View style={styles.passwordRequirements} accessibilityLiveRegion="polite">
                  {passwordRequirements.map((requirement) => (
                    <ThemedText
                      key={requirement.label}
                      style={[
                        { fontSize: 13 },
                        requirement.met ? { color: '#16a34a' } : { opacity: 0.65 },
                      ]}
                    >
                      {requirement.met ? '\u2713' : '\u2022'} {requirement.label}
                    </ThemedText>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={theme.iconMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
                {confirmPassword.length > 0 ? (
                  <ThemedText
                    style={[
                      styles.passwordMatchText,
                      doPasswordsMatch ? {color: '#16a34a'} : { color: '#dc2626' },
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    {doPasswordsMatch ? '\u2713 Passwords match' : 'Passwords do not match'}
                  </ThemedText>
                ) : null}

                <View style={styles.ageRow}>
                  <Switch
                    value={isAgeConfirmed}
                    onValueChange={setIsAgeConfirmed}
                    trackColor={{ false: '#555', true: '#6c63ff' }}
                    thumbColor={isAgeConfirmed ? '#fff' : '#ccc'}
                  />
                  <ThemedText style={styles.ageLabel}>
                    By registering, I confirm I am at least 18 years old.
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
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.four,
    color: '#7157db',
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
  linkButton: {
    alignSelf: 'flex-end',
  },
  linkText: {
    fontWeight: '600',
  },
  helperText: {
    marginBottom: Spacing.two,
    opacity: 0.8,
    textAlign: 'center',
  },
  passwordRequirements: {
    gap: Spacing.one,
  },
  passwordRequirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordMatchText: {
    fontSize: 13,
    marginTop: -Spacing.two,
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
