import React, { useState } from 'react';
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
import { DateField } from '@/components/form/date-field';
import { SelectField } from '@/components/form/select-field';
import { InterestsSelect } from '@/components/form/interests-select';
import { API, OwnProfileResponse } from '@/hooks/auth';
import { Spacing } from '@/constants/theme';
import { COUNTRIES } from '@/constants/countries';
import { MIN_INTERESTS } from '@/constants/interests';
import { getImageValidationError } from '@/constants/media';
import { normalizeMediaUrl } from '@/hooks/media';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView } from 'expo-symbols';
import { DiscoveryPreferencesForm } from '@/components/discovery-preferences-form';

type OnboardingStep = 'profile' | 'discovery';

interface OnboardingGateProps {
  onOnboardSuccess: () => void;
  mode?: 'create' | 'update';
  initialStep?: OnboardingStep;
  embedded?: boolean;
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

const DISPLAY_NAME_MAX_LENGTH = 50;
const BIO_MAX_LENGTH = 150;
const MIN_AGE = 18;

// Whole years between an ISO date and today; NaN for an unparseable date.
const getAge = (isoDate: string) => {
  const birth = new Date(isoDate);
  if (Number.isNaN(birth.getTime())) {
    return NaN;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

export default function OnboardingGate({
  onOnboardSuccess,
  mode = 'create',
  initialStep = 'profile',
  embedded = false,
  initialProfile,
}: OnboardingGateProps) {
  const [step, setStep] = useState<OnboardingStep>(mode === 'update' ? 'profile' : initialStep);
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? '');
  const [bio, setBio] = useState(initialProfile?.bio ?? '');
  const [birthDate, setBirthDate] = useState(initialProfile?.birthDate ?? '');
  const [country, setCountry] = useState(initialProfile?.country ?? '');
  const [gender, setGender] = useState(initialProfile?.gender ?? GENDERS[0]);
  const [interests, setInterests] = useState<string[]>(initialProfile?.interests ?? []);
  // FIX: keep the full picker asset (uri + mimeType), not just the uri string.
  // We need the real mime type to build a correct native FormData part below.
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncedProfile, setSyncedProfile] = useState(initialProfile);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentProfilePictureUrl = normalizeMediaUrl(initialProfile?.profilePictureUrl);

  const handleProfileSaved = () => {
    if (mode === 'create') {
      setStep('discovery');
    } else {
      onOnboardSuccess();
    }
  };

  // Re-sync the form when the parent hands us a refreshed profile to edit (identity is
  // stable until the parent replaces the profile after a successful save, so reference
  // equality is safe here). Done during render rather than in an Effect, since
  // there's no external system involved, just local state (React's documented pattern:
  // https://react.dev/learn/you-might-not-need-an-effect).
  if (initialProfile !== syncedProfile) {
    setSyncedProfile(initialProfile);
    setDisplayName(initialProfile?.displayName ?? '');
    setBio(initialProfile?.bio ?? '');
    setBirthDate(initialProfile?.birthDate ?? '');
    setCountry(initialProfile?.country ?? '');
    setGender(initialProfile?.gender ?? GENDERS[0]);
    setInterests(initialProfile?.interests ?? []);
    setProfileImage(null);
  }

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
    if (!displayName || !birthDate || !country || !bio) {
      errorHandle('Please fill in your name, bio, birth date and country.');
      return;
    }
    if (interests.length < MIN_INTERESTS) {
      errorHandle(`Please pick at least ${MIN_INTERESTS} interests.`);
      return;
    }
    if (getAge(birthDate) < MIN_AGE) {
      errorHandle(`You must be at least ${MIN_AGE} years old.`);
      return;
    }

    // The backend binds interests (List<String>) from a single comma-delimited
    // multipart field, so send them joined without spaces.
    const interestsField = interests.join(',');

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
            interests: interestsField,
          },
        });

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          handleProfileSaved();
        } else {
          let errorMsg = 'Could not update profile';
          try {
            const data = JSON.parse(uploadResult.body);
            errorMsg = data.message || errorMsg;
          } catch { }
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
        formData.append('interests', interestsField);

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
          handleProfileSaved();
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

  if (mode === 'create' && step === 'discovery') {
    return (
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, embedded && styles.embeddedScrollContent]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.discoveryContent}>
                <ThemedText type="title" style={styles.title}>Set your discovery preferences</ThemedText>
                <ThemedText style={styles.discoverySubtitle}>
                  One last step. Tell us which profiles you would like to discover.
                </ThemedText>
                <DiscoveryPreferencesForm
                  onSaved={onOnboardSuccess}
                  submitLabel="Finish setup"
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, embedded && styles.embeddedScrollContent]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {!embedded ? (
              <ThemedText type="title" style={styles.title}>
                {mode === 'update' ? 'Update your profile' : "Let's finish setting up your profile"}
              </ThemedText>
            ) : null}

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

              <ThemedText style={styles.label}>Birth date</ThemedText>
              <DateField value={birthDate} onChange={setBirthDate} minAge={MIN_AGE} />

              <ThemedText style={styles.label}>Country</ThemedText>
              <SelectField
                value={country || null}
                options={COUNTRIES}
                onChange={setCountry}
                placeholder="Select your country"
                title="Country"
                searchable
                inlineOnWeb
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

              <ThemedText style={styles.label}>Interests</ThemedText>
              <InterestsSelect value={interests} onChange={setInterests} />

              <TouchableOpacity
                style={[styles.buttonStyle, styles.submitButton]}
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
  embeddedScrollContent: {
    justifyContent: 'flex-start',
    paddingVertical: Spacing.four,
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
  discoveryContent: {
    gap: Spacing.three,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  discoverySubtitle: {
    textAlign: 'center',
    marginTop: -Spacing.four,
    marginBottom: Spacing.two,
    opacity: 0.75,
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
  submitButton: {
    marginTop: Spacing.three,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
