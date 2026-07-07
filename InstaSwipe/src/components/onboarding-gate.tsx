import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API, OwnProfileResponse } from '@/hooks/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView } from 'expo-symbols';

interface OnboardingGateProps {
  onOnboardSuccess: () => void;
  mode?: 'create' | 'update';
  initialProfile?: Pick<OwnProfileResponse, 'displayName' | 'bio' | 'birthDate' | 'country' | 'gender' | 'interests' | 'profilePictureUrl'>;
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

export default function OnboardingGate({ onOnboardSuccess, mode = 'create', initialProfile }: OnboardingGateProps) {
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? '');
  const [bio, setBio] = useState(initialProfile?.bio ?? '');
  const [birthDate, setBirthDate] = useState(initialProfile?.birthDate ?? '');
  const [country, setCountry] = useState(initialProfile?.country ?? '');
  const [gender, setGender] = useState(initialProfile?.gender ?? GENDERS[0]);
  const [interests, setInterests] = useState((initialProfile?.interests ?? []).join(', '));
  // FIX: keep the full picker asset (uri + mimeType), not just the uri string.
  // We need the real mime type to build a correct native FormData part below.
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentProfilePictureUrl = initialProfile?.profilePictureUrl;

  useEffect(() => {
    setDisplayName(initialProfile?.displayName ?? '');
    setBio(initialProfile?.bio ?? '');
    setBirthDate(initialProfile?.birthDate ?? '');
    setCountry(initialProfile?.country ?? '');
    setGender(initialProfile?.gender ?? GENDERS[0]);
    setInterests((initialProfile?.interests ?? []).join(', '));
    setProfileImage(null);
  }, [initialProfile]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0]);
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
          } catch (e) { }
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
            <ThemedText type="title" style={styles.title}>
              {mode === 'update' ? 'Update your profile' : "Let's finish setting up your profile"}
            </ThemedText>

            <View style={styles.form}>
              <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
                {profileImage ? (
                  <Image source={{ uri: profileImage.uri }} style={styles.avatarImage} />
                ) : currentProfilePictureUrl ? (
                  <Image source={{ uri: currentProfilePictureUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.avatarText}>
                      {mode === 'update' ? 'Keep Photo' : 'Add Photo'}
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
                placeholder="User Name"
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
              />

              <TouchableOpacity
                style={[styles.buttonStyle]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <SymbolView
                  name={{ ios: 'save', android: 'save', web: 'save' } as any}
                  tintColor='#8769ffbe'
                  size={20}
                />
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>
                    {mode === 'update' ? 'Update profile' : 'Create profile'}
                  </ThemedText>
                )}
              </TouchableOpacity>
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.six,
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
  buttonStyle: {
    borderColor: '#6249cabe',
    minHeight: 44,
    maxHeight: 50,
    minWidth: 200,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
