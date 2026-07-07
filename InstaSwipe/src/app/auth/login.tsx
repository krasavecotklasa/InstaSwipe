import { Redirect } from 'expo-router';

// Login is handled by AuthGate in the root layout.
export default function LoginScreen() {
  return <Redirect href="/" />;
}
