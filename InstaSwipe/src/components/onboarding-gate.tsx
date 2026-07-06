import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API } from '@/hooks/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface OnboardingGateProps {
  onOnboardSuccess: () => void;
}

const GENDERS = ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'];

export default function OnboardingGate({ onOnboardSuccess }: OnboardingGateProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('');
  const [gender, setGender] = useState('MALE');
  const [interests, setInterests] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!displayName || !birthDate || !country) {
      Alert.alert('Error', 'Please fill in required fields (Name, Birth Date, Country).');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('displayName', displayName);
      formData.append('bio', bio);
      formData.append('birthDate', birthDate);
      formData.append('country', country);
      formData.append('gender', gender);
      formData.append('interests', interests);

      if (profilePicture) {
        // Basic filename extraction
        const filename = profilePicture.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
          const res = await fetch(profilePicture);
          const blob = await res.blob();
          formData.append('profilePicture', blob, filename);
        } else {
          formData.append('profilePicture', {
            uri: profilePicture,
            name: filename,
            type,
          } as any);
        }
      }

      const response = await API.updateProfile(formData);
      if (response.ok) {
        onOnboardSuccess();
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Update Failed', errorData.message || 'Could not update profile');
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.title}>Complete Your Profile</ThemedText>

          <View style={styles.form}>
            {/* Avatar Picker */}
            <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.avatarText}>Add Photo</ThemedText>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Display Name"
              placeholderTextColor={theme.iconMuted}
              value={displayName}
              onChangeText={setDisplayName}
            />

            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Bio"
              placeholderTextColor={theme.iconMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
            />

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Birth Date (YYYY-MM-DD)"
              placeholderTextColor={theme.iconMuted}
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Country"
              placeholderTextColor={theme.iconMuted}
              value={country}
              onChangeText={setCountry}
            />

            <ThemedText style={styles.label}>Gender</ThemedText>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderButton,
                    { borderColor: theme.tabActiveBorder },
                    gender === g && { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement },
                  ]}
                  onPress={() => setGender(g)}
                >
                  <ThemedText style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                    {g.replace('_', ' ')}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Interests (e.g. Gaming, Gym)"
              placeholderTextColor={theme.iconMuted}
              value={interests}
              onChangeText={setInterests}
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Complete Onboarding</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.six,
  },
  form: {
    gap: Spacing.three,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: Spacing.four,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
  label: {
    fontWeight: '600',
    marginTop: Spacing.two,
    marginBottom: -Spacing.one,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  genderButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 20,
  },
  genderText: {
    fontSize: 14,
  },
  genderTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
