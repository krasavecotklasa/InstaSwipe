import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/auth-context';
import { API, type OwnProfileResponse } from '@/hooks/auth';
import {
  DISCOVERY_GENDER_LABELS,
  DISCOVERY_GENDERS,
  type DiscoveryPreferences,
  getDiscoveryPreferences,
  setDiscoveryPreferences,
} from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';

const DEFAULT_PREFS: DiscoveryPreferences = {
  minAge: '',
  maxAge: '',
  gender: DISCOVERY_GENDERS[0],
  country: '',
  interests: [],
};

const toInputValue = (value: string[] | string | number | undefined) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value == null ? '' : String(value);
};

const parseInterests = (value: string) => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { onEditProfile, onLogout } = useAuthContext();
  const [profile, setProfile] = useState<OwnProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [gender, setGender] = useState(DISCOVERY_GENDERS[0]);
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [profileResponse, savedPreferences] = await Promise.all([
          API.getOwnProfile(),
          getDiscoveryPreferences(),
        ]);

        if (!active) {
          return;
        }

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Could not load your profile');
        }

        const profileData: OwnProfileResponse = await profileResponse.json();
        setProfile(profileData);

        const mergedPreferences = {
          ...DEFAULT_PREFS,
          gender: savedPreferences.gender || DISCOVERY_GENDERS[0],
          country: savedPreferences.country || profileData.country || '',
          interests: savedPreferences.interests.length > 0 ? savedPreferences.interests : profileData.interests || [],
          minAge: savedPreferences.minAge || '',
          maxAge: savedPreferences.maxAge || '',
        } satisfies DiscoveryPreferences;

        setMinAge(toInputValue(mergedPreferences.minAge));
        setMaxAge(toInputValue(mergedPreferences.maxAge));
        setGender(mergedPreferences.gender);
        setCountry(mergedPreferences.country);
        setInterests(toInputValue(mergedPreferences.interests));
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load profile');
        }
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const savePreferences = async () => {
    setSavingPrefs(true);
    setPrefsSaved(false);
    setError(null);

    try {
      await setDiscoveryPreferences({
        minAge: minAge.trim() ? Number(minAge) : '',
        maxAge: maxAge.trim() ? Number(maxAge) : '',
        gender,
        country,
        interests: parseInterests(interests),
      });
      setPrefsSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const openEditor = async () => {
    if (!profile) {
      return;
    }

    setOpeningEditor(true);
    try {
      onEditProfile(profile);
    } finally {
      setOpeningEditor(false);
    }
  };

  const profilePicture = profile?.profilePictureUrl;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Profile
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              Keep your discovery settings and profile details in one place.
            </ThemedText>
          </View>

          {error && (
            <View style={[styles.notice, { borderColor: '#ef4444' }]}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          <View style={[styles.panel, { borderColor: theme.tabActiveBorder }]}>
            <View style={styles.panelHeader}>
              <ThemedText style={styles.panelHeaderText} type="smallBold">
                Discovery preferences
              </ThemedText>
              {prefsSaved && <ThemedText type="small" themeColor="textSecondary">
                Saved
              </ThemedText>}
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <ThemedText type="smallBold">Min age</ThemedText>
                <TextInput
                  value={minAge}
                  onChangeText={setMinAge}
                  keyboardType="number-pad"
                  style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
                />
              </View>
              <View style={styles.field}>
                <ThemedText type="smallBold">Max age</ThemedText>
                <TextInput
                  value={maxAge}
                  onChangeText={setMaxAge}
                  keyboardType="number-pad"
                  style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Gender</ThemedText>
              <View style={styles.segmented}>
                {DISCOVERY_GENDERS.map((option) => {
                  const selected = option === gender;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => setGender(option)}
                      style={[
                        styles.segment,
                        {
                          borderColor: theme.tabActiveBorder,
                          backgroundColor: selected ? theme.backgroundElement : 'transparent',
                        },
                      ]}
                    >
                      <ThemedText type="smallBold" style={selected && styles.segmentTextSelected}>
                        {DISCOVERY_GENDER_LABELS[option]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Country</ThemedText>
              <TextInput
                value={country}
                onChangeText={setCountry}
                autoCapitalize="words"
                style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Interests</ThemedText>
              <TextInput
                value={interests}
                onChangeText={setInterests}
                autoCapitalize="words"
                style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
              />
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={savePreferences}
                disabled={savingPrefs}
                style={[styles.primaryButton, { backgroundColor: theme.backgroundElement, opacity: savingPrefs ? 0.7 : 1 }]}
              >
                {savingPrefs ? <ActivityIndicator color="#ffffff" /> : (
                  <SymbolView
                    name={{ ios: 'checkmark.circle.fill', android: 'check', web: 'check' } as any}
                    tintColor="#ffffff"
                    size={18}
                  />
                )}
                <ThemedText type="smallBold" style={styles.primaryButtonText}>
                  Save preferences
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.panel, { borderColor: theme.tabActiveBorder }]}>
            <View style={styles.panelHeader}>
              <ThemedText style={styles.panelHeaderText} type="smallBold">
                Your profile
              </ThemedText>
            </View>

            {loadingProfile ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.text} />
                <ThemedText type="small" themeColor="textSecondary">
                  Loading profile...
                </ThemedText>
              </View>
            ) : profile ? (
              <View style={styles.profileBlock}>
                <View style={styles.profileTopRow}>
                  <Image
                    source={profilePicture ? { uri: profilePicture } : undefined}
                    style={styles.avatar}
                    contentFit="cover"
                  />

                  <View style={styles.profileMeta}>
                    <ThemedText type="smallBold" style={styles.profileName}>
                      {profile.displayName} <ThemedText type="small" themeColor="textSecondary">
                        ({profile.email})
                      </ThemedText>
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Birthday: <b>{profile.birthDate}</b>
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Country: <b>{profile.country}</b>
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Gender: <b>{profile.gender}</b>
                    </ThemedText>
                  </View>
                </View>

                {!!profile.bio && (
                  <ThemedText type="small" style={styles.bio}>
                    {profile.bio}
                  </ThemedText>
                )}

                <View style={styles.chips}>
                  {(profile.interests ?? []).map((interest) => (
                    <View key={interest} style={[styles.chip, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="small" style={styles.chipText}>
                        {interest}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={openEditor}
                    disabled={openingEditor}
                    style={[styles.secondaryButton, { borderColor: theme.tabActiveBorder, opacity: openingEditor ? 0.7 : 1 }]}
                  >
                    <SymbolView
                      name={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' } as any}
                      tintColor={theme.text}
                      size={18}
                    />
                    <ThemedText type="smallBold">
                      Update profile
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={[styles.panel, { borderColor: theme.tabActiveBorder }]}>
            <Pressable
              onPress={onLogout}
              style={[styles.logoutButton, { borderColor: '#ef4444' }]}
            >
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' } as any}
                tintColor="#ef4444"
                size={18}
              />
              <ThemedText type="smallBold" style={styles.logoutText}>
                Logout
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    marginLeft: Platform.OS === 'web' ? 100 : 0,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  errorText: {
    color: '#ef4444',
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  textArea: {
    minHeight: 56,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  segment: {
    flexGrow: 1,
    minWidth: '22%',
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  profileBlock: {
    gap: Spacing.three,
  },
  profileTopRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundSelected,
  },
  profileMeta: {
    flex: 1,
    gap: Spacing.one,
  },
  profileName: {
    fontSize: 18,
    lineHeight: 24,
  },
  bio: {
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  logoutButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  logoutText: {
    color: '#ef4444',
  },
  panelHeaderText: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});
