import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, type Post } from '@/components/post-card';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthContext } from '@/hooks/auth-context';
import { API, type OwnProfileResponse } from '@/hooks/auth';
import {
  DISCOVERY_GENDER_LABELS,
  DISCOVERY_GENDERS,
  type DiscoveryPreferences,
  type Gender,
  getDiscoveryPreferences,
  setDiscoveryPreferences,
} from '@/hooks/matches';
import { normalizeMediaUrl } from '@/hooks/media';
import { sendTestNotificationAsync } from '@/hooks/notifications';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import { fetchUserPosts } from '@/hooks/posts';
import DiscoveryProfileModal from '@/components/discovery-profile-modal';

const DEFAULT_PREFS: DiscoveryPreferences = {
  minAge: '',
  maxAge: '',
  gender: '',
  country: '',
  interests: [],
};

// Includes an "Any" option ('') so a user can search all genders; '' means no
// gender filter, which is what the backend expects when the param is omitted.
const GENDER_OPTIONS: (Gender | '')[] = ['', ...DISCOVERY_GENDERS];
const genderOptionLabel = (option: Gender | '') => (option === '' ? 'Any' : DISCOVERY_GENDER_LABELS[option]);

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
  const insets = useSafeAreaInsets();
  const { onEditProfile, onLogout } = useAuthContext();
  const [profile, setProfile] = useState<OwnProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sendingTestNotification, setSendingTestNotification] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const [profileResponse, savedPreferences] = await Promise.all([
          API.getOwnProfile(),
          getDiscoveryPreferences(),
        ]);

        if (!isActive) {
          return;
        }

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Could not load your profile');
        }

        const profileData: OwnProfileResponse = await profileResponse.json();
        setProfile({
          ...profileData,
          profilePictureUrl: normalizeMediaUrl(profileData.profilePictureUrl),
        });

        const mergedPreferences = {
          ...DEFAULT_PREFS,
          gender: savedPreferences.gender,
          country: savedPreferences.country || '',
          interests: savedPreferences.interests || [],
          minAge: savedPreferences.minAge || '',
          maxAge: savedPreferences.maxAge || '',
        } satisfies DiscoveryPreferences;

        setMinAge(toInputValue(mergedPreferences.minAge));
        setMaxAge(toInputValue(mergedPreferences.maxAge));
        setGender(mergedPreferences.gender);
        setCountry(mergedPreferences.country);
        setInterests(toInputValue(mergedPreferences.interests));
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load profile');
        }
      } finally {
        if (isActive) {
          setLoadingProfile(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const userId = profile?.id;
    if (!userId) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    let isActive = true;

    (async () => {
      setLoadingPosts(true);
      setPostsError(null);

      try {
        const nextPosts = await fetchUserPosts(userId);
        console.log("fetching...");
        if (isActive) {
          setPosts(nextPosts);
        }
      } catch (err) {
        if (isActive) {
          setPostsError(err instanceof Error ? err.message : 'Unable to load posts');
          setPosts([]);
        }
      } finally {
        if (isActive) {
          setLoadingPosts(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [profile?.id]);

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

  const sendSampleNotification = async () => {
    setSendingTestNotification(true);
    setNotificationStatus(null);

    try {
      await sendTestNotificationAsync();
      setNotificationStatus('Test notification sent successfully.');
    } catch (notificationError) {
      setNotificationStatus(
        notificationError instanceof Error ? notificationError.message : 'Could not send test notification'
      );
    } finally {
      setSendingTestNotification(false);
    }
  };

  const profilePicture = profile?.profilePictureUrl;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + insets.bottom + Spacing.five },
          ]}
          showsVerticalScrollIndicator
        >
          {error && (
            <View style={[styles.notice, { borderColor: '#ef4444' }]}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          {loadingProfile ? (
            <View style={[styles.panel, { borderColor: theme.tabActiveBorder }]}>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.text} />
                <ThemedText type="small" themeColor="textSecondary">
                  Loading profile...
                </ThemedText>
              </View>
            </View>
          ) : profile ? (
            <>
              <View style={[styles.panel, { borderColor: theme.tabActiveBorder }]}>
                <View style={styles.panelHeader}>
                  <ThemedText style={styles.panelHeaderText} type="smallBold">
                    Your profile
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setShowSettings((current) => !current)}
                    style={[styles.iconButton, { borderColor: theme.tabActiveBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel={showSettings ? 'Show posts' : 'Open settings'}
                  >
                    <SymbolView
                      name={
                        (showSettings
                          ? { ios: 'xmark', android: 'close', web: 'close' }
                          : { ios: 'gearshape', android: 'settings', web: 'settings' }) as any
                      }
                      tintColor='#8769ffbe'
                      size={20}
                    />
                  </TouchableOpacity>
                </View>

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
                        Birthday: <ThemedText type="small" themeColor="textSecondary" style={styles.profileMetaDetail}>{profile.birthDate}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Country: <ThemedText type="small" themeColor="textSecondary" style={styles.profileMetaDetail}>{profile.country}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Gender: <ThemedText type="small" themeColor="textSecondary" style={styles.profileMetaDetail}>{profile.gender}</ThemedText>
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.bioInterestsRow}>
                    <View style={[styles.bioColumn, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="smallBold">Bio:</ThemedText>
                      {!!profile.bio && (
                        <ThemedText type="small" style={styles.bio}>
                          {profile.bio}
                        </ThemedText>
                      )}
                    </View>

                    <View style={[styles.interestsColumn, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="smallBold">My interests:</ThemedText>
                      <View style={styles.chips}>
                        {(profile.interests ?? []).map((interest) => (
                          <View key={interest} style={[styles.chip, { borderColor: theme.tabActiveBorder }]}>
                            <ThemedText type="small" style={styles.chipText}>
                              {interest}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {showSettings ? (
                <>
                  <View style={[styles.filters, { borderColor: theme.tabActiveBorder }]}>
                    <View style={styles.panelHeader}>
                      <ThemedText style={styles.panelHeaderText} type="smallBold">
                        Profile settings
                      </ThemedText>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        onPress={openEditor}
                        disabled={openingEditor}
                        style={[styles.buttonStyle, { borderColor: '#6249cabe' }]}
                      >
                        <SymbolView
                          name={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' } as any}
                          tintColor='#8769ffbe'
                          size={20}
                        />
                        <ThemedText type="smallBold">
                          Update profile
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={sendSampleNotification}
                        disabled={sendingTestNotification}
                        style={[styles.buttonStyle, { borderColor: '#6249cabe' }]}
                      >
                        <SymbolView
                          name={{ ios: 'bell.badge', android: 'notifications', web: 'notifications' } as any}
                          tintColor='#8769ffbe'
                          size={20}
                        />
                        <ThemedText type="smallBold">
                          {sendingTestNotification ? 'Sending...' : 'Send test notification'}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                    {notificationStatus && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.notificationStatus}>
                        {notificationStatus}
                      </ThemedText>
                    )}
                  </View>

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
                        <ThemedText type="smallBold">Minimum age</ThemedText>
                        <TextInput
                          value={minAge}
                          onChangeText={setMinAge}
                          keyboardType="number-pad"
                          style={[styles.input, { borderColor: theme.tabActiveBorder, color: theme.text }]}
                        />
                      </View>
                      <View style={styles.field}>
                        <ThemedText type="smallBold">Maximum age</ThemedText>
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
                        {GENDER_OPTIONS.map((option) => {
                          const selected = option === gender;

                          return (
                            <TouchableOpacity
                              key={option || 'any'}
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
                                {genderOptionLabel(option)}
                              </ThemedText>
                            </TouchableOpacity>
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
                      <TouchableOpacity
                        onPress={savePreferences}
                        disabled={savingPrefs}
                        style={[styles.buttonStyle]}
                      >
                        <SymbolView
                          name={{ ios: 'save', android: 'save', web: 'save' } as any}
                          tintColor='#8769ffbe'
                          size={20}
                        />
                        <ThemedText type="smallBold">
                          Save changes
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      onPress={onLogout}
                      style={[styles.buttonStyle, { borderColor: '#ef4444' }]}
                    >
                      <SymbolView
                        name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' } as any}
                        tintColor="#ef4444"
                        size={20}
                      />
                      <ThemedText type="smallBold">
                        Logout
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.postsSection}>
                  <View style={styles.postsHeader}>
                    <ThemedText type="smallBold" style={styles.postsTitle}>
                      Posts
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                    </ThemedText>
                  </View>

                  {loadingPosts ? (
                    <View style={styles.emptyState}>
                      <ActivityIndicator size="large" color={theme.text} />
                    </View>
                  ) : postsError ? (
                    <View style={[styles.notice, { borderColor: '#ef4444' }]}>
                      <ThemedText type="small" style={styles.errorText}>
                        {postsError}
                      </ThemedText>
                    </View>
                  ) : posts.length > 0 ? (
                    <View style={styles.postsList}>
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <ThemedText type="small" themeColor="textSecondary">
                        No posts yet.
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
            </>
          ) : null}
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
    gap: Spacing.three,
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
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  filters: {
    borderWidth: 1,
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
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
  segmentText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
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
  notificationStatus: {
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  profileBlock: {
    gap: Spacing.three,
  },
  bioInterestsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  bioColumn: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  interestsColumn: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  profileTopRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#6249cabe',
    backgroundColor: Colors.dark.backgroundSelected,
  },
  profileMeta: {
    flex: 1,
    gap: Spacing.one,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '800',
  },
  profileMetaDetail: {
    fontWeight: '800',
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
    backgroundColor: '#2f2338',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  panelHeaderText: {
    bottom: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  postsSection: {
    gap: Spacing.three,
  },
  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  postsTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  postsList: {
    width: '100%',
  },
  emptyState: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
