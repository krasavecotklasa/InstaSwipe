import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API } from '@/hooks/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getImageValidationError } from '@/constants/media';

interface OnboardingGateProps {
  onOnboardSuccess: () => void;
}

function errorHandle(error: string) {
  if (Platform.OS === 'web') {
    alert('Error: ' + error);
  } else {
    Alert.alert('Error', error);
  }
}

const GENDERS = ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'];
const GendersDisplay = ['Male', 'Female', 'Non-Binary', 'Other'];

const DISPLAY_NAME_MAX_LENGTH = 50;
const BIO_MAX_LENGTH = 150;
const COUNTRY_MAX_LENGTH = 60;
const INTERESTS_MAX_LENGTH = 200;

export default function OnboardingGate({ onOnboardSuccess }: OnboardingGateProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('');
  const [gender, setGender] = useState('MALE');
  const [interests, setInterests] = useState('');
  // FIX: keep the full picker asset (uri + mimeType), not just the uri string.
  // We need the real mime type to build a correct native FormData part below.
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const validationError = getImageValidationError(asset);
      if (validationError) {
        errorHandle(validationError);
        return;
      }

      setProfileImage(asset);
    } catch (error) {
      errorHandle(error instanceof Error ? error.message : 'Could not open the image picker.');
    }
  };

  const handleSubmit = async () => {
    if (!displayName || !birthDate || !country || !bio || !interests) {
      errorHandle('Please fill in required fields (User name, bio, birth date, country, interests).');
      return;
    }

    setLoading(true);
    try {
      if (Platform.OS !== 'web' && profileImage) {
        // Use FileSystem.uploadAsync for native to avoid React Native fetch PUT FormData bug
        const { getAccessToken, getProfileUpdateUrl } = await import('@/hooks/auth');
        const FileSystem = await import('expo-file-system/legacy');
        const token = await getAccessToken();
        const url = getProfileUpdateUrl();
        const filename = profileImage.uri.split('/').pop() || 'profile.jpg';
        const inferredType =
          profileImage.mimeType ||
          (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

        const uploadResult = await FileSystem.uploadAsync(url, profileImage.uri, {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'profilePicture',
          mimeType: inferredType,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          parameters: {
            displayName,
            bio,
            birthDate,
            country,
            gender,
            interests,
          },
        });

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          onOnboardSuccess();
        } else {
          let errorMsg = 'Could not update profile';
          try {
            const data = JSON.parse(uploadResult.body);
            errorMsg = data.message || errorMsg;
          } catch (e) {}
          errorHandle(errorMsg);
        }
      } else {
        // Web fallback, or native without image
        const formData = new FormData();
        formData.append('displayName', displayName);
        formData.append('bio', bio);
        formData.append('birthDate', birthDate);
        formData.append('country', country);
        formData.append('gender', gender);
        formData.append('interests', interests);

        if (profileImage) {
          const filename = profileImage.uri.split('/').pop() || 'profile.jpg';
          const inferredType =
            profileImage.mimeType ||
            (filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

          if (Platform.OS === 'web') {
            const res = await fetch(profileImage.uri);
            const blob = await res.blob();
            formData.append('profilePicture', blob, filename);
          } else {
            // Should be unreachable due to branch above, but keeping for safety
            formData.append('profilePicture', {
              uri: profileImage.uri,
              name: filename,
              type: inferredType,
            } as any);
          }
        }

        const response = await API.updateProfile(formData);
        if (response.ok) {
          onOnboardSuccess();
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorHandle(errorData.message || 'Could not update profile');
        }
      }
    } catch (error) {
      console.error(error);
      errorHandle('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.title}>Let's finish setting up your profile</ThemedText>

          <View style={styles.form}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
              {profileImage ? (
                <Image source={{ uri: profileImage.uri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.avatarText}>Add Photo</ThemedText>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="User Name"
              placeholderTextColor={theme.iconMuted}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
            />

            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="Bio"
              placeholderTextColor={theme.iconMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              maxLength={BIO_MAX_LENGTH}
            />
            <ThemedText style={[styles.charCount, { color: theme.iconMuted }]}>
              {bio.length}/{BIO_MAX_LENGTH}
            </ThemedText>

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
              maxLength={COUNTRY_MAX_LENGTH}
            />

            <ThemedText style={styles.label}>Gender</ThemedText>
            <View style={styles.genderRow}>
              {GendersDisplay.map((g, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.genderButton,
                    { borderColor: theme.tabActiveBorder },
                    gender === GENDERS[i] && { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement },
                  ]}
                  onPress={() => setGender(GENDERS[i])}
                >
                  <ThemedText style={[styles.genderText, gender === GENDERS[i] && styles.genderTextSelected]}>
                    {g}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
              placeholder="3 interests (e.g. Reading, Exercising, Cooking)"
              placeholderTextColor={theme.iconMuted}
              value={interests}
              onChangeText={setInterests}
              maxLength={INTERESTS_MAX_LENGTH}
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Create profile</ThemedText>
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
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -Spacing.two,
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
    borderRadius: 8,
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