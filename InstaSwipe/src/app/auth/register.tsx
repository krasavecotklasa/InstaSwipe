import { Redirect } from 'expo-router';

// Registration is handled by AuthGate in the root layout.
export default function RegisterScreen() {
  return <Redirect href="/" />;
}
