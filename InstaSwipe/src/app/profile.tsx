import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, type Post } from '@/components/post-card';
import ResponsiveModalSheet, { ModalSheetPanel } from '@/components/responsive-modal-sheet';
import { DiscoveryPreferencesForm } from '@/components/discovery-preferences-form';
import OnboardingGate from '@/components/onboarding-gate';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { getImageValidationError } from '@/constants/media';
import { useAuthContext } from '@/context/auth-context';
import { API, type OwnProfileResponse, uploadProfilePicture } from '@/hooks/auth';
import { useMediaStatusPolling } from '@/hooks/use-media-status-polling';
import { normalizeMediaUrl } from '@/hooks/media';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import { fetchUserPosts } from '@/hooks/posts';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

type SettingsView = 'closed' | 'hub' | 'profile' | 'discovery';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobileWeb, isDesktopWeb } = useResponsiveLayout();
  const { onLogout } = useAuthContext();
  const [profile, setProfile] = useState<OwnProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const hasLoadedPosts = useRef(false);

  const [prefsSaved, setPrefsSaved] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('closed');

  const loadProfile = useCallback(async () => {
    const profileResponse = await API.getOwnProfile();
    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      throw new Error(errorData.message || 'Could not load your profile');
    }
    const profileData: OwnProfileResponse = await profileResponse.json();
    const profileId = profileData.id ?? profileData.userId;
    setProfile({
      ...profileData,
      id: profileId,
      profilePictureUrl: normalizeMediaUrl(profileData.profilePictureUrl),
    });
  }, []);

  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        await loadProfile();

        if (!isActive) {
          return;
        }
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
  }, [loadProfile]);

  const { timedOut: avatarTimedOut } = useMediaStatusPolling(
    profile?.profilePictureStatus,
    () => { loadProfile().catch(() => {}); },
  );

  const handlePickAvatar = async () => {
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
        setError(validationError);
        return;
      }

      setAvatarUploading(true);
      setError(null);
      const uploadResult = await uploadProfilePicture(asset);
      setProfile((current) => current && ({
        ...current,
        profilePictureUrl: normalizeMediaUrl(uploadResult.url),
        profilePictureStatus: uploadResult.status,
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload your picture');
    } finally {
      setAvatarUploading(false);
    }
  };

  const loadPosts = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    if (!hasLoadedPosts.current) {
      setLoadingPosts(true);
    }
    setPostsError(null);

    try {
      setPosts(await fetchUserPosts(userId));
    } catch (err) {
      setPostsError(err instanceof Error ? err.message : 'Unable to load posts');
      if (!hasLoadedPosts.current) {
        setPosts([]);
      }
    } finally {
      hasLoadedPosts.current = true;
      setLoadingPosts(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts]),
  );

  const handleProfileUpdated = async () => {
    if (!profile) {
      return;
    }

    try {
      const response = await API.getOwnProfile();
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        setError(errorData.message || 'Profile updated, but it could not be refreshed.');
        setSettingsView('hub');
        return;
      }

      const profileData: OwnProfileResponse = await response.json();
      setProfile({
        ...profileData,
        id: profileData.id ?? profileData.userId,
        profilePictureUrl: normalizeMediaUrl(profileData.profilePictureUrl),
      });
      setSettingsView('hub');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh your profile.');
      setSettingsView('hub');
    }
  };

  const profilePicture = profile?.profilePictureUrl;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { marginLeft: isDesktopWeb ? 100 : 0 }]} edges={['top', 'left', 'right']}>
        <Header title='Profile' />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: (isMobileWeb ? 64 : BottomTabInset) + insets.bottom + Spacing.five },
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
              <View style={[styles.panel, isMobileWeb && styles.mobilePanel, { borderColor: theme.tabActiveBorder }]}>
                <View style={styles.panelHeader}>
                  <ThemedText style={styles.panelHeaderText} type="smallBold">
                    Your profile
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setSettingsView('hub')}
                    style={[styles.iconButton, { borderColor: theme.tabActiveBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                  >
                    <SymbolView
                      name={{ ios: 'gearshape', android: 'settings', web: 'settings' } as any}
                      tintColor='#8769ffbe'
                      size={20}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.profileBlock}>
                  <View style={[styles.profileTopRow, isMobileWeb && styles.mobileProfileTopRow]}>
                    <TouchableOpacity
                      onPress={handlePickAvatar}
                      disabled={avatarUploading}
                      accessibilityRole="button"
                      accessibilityLabel="Change profile picture"
                    >
                      <Image
                        source={profilePicture ? { uri: profilePicture } : undefined}
                        style={[styles.avatar, isMobileWeb && styles.mobileAvatar]}
                        contentFit="cover"
                      />
                      {(avatarUploading || profile.profilePictureStatus === 'PROCESSING') && (
                        <View style={styles.avatarOverlay}>
                          <ActivityIndicator color="#ffffff" />
                          <ThemedText type="small" style={styles.avatarOverlayText}>
                            {avatarTimedOut ? 'Still…' : 'Processing…'}
                          </ThemedText>
                        </View>
                      )}
                      {!avatarUploading && profile.profilePictureStatus === 'FAILED' && (
                        <View style={styles.avatarOverlay}>
                          <ThemedText type="small" style={styles.avatarOverlayText}>
                            Failed — tap to retry
                          </ThemedText>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.profileMeta}>
                      <ThemedText type="smallBold" style={styles.profileName}>
                        {profile.displayName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                        {profile.email}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Birthday: <ThemedText type="small" themeColor="textSecondary"
                          style={styles.profileMetaDetail}>{profile.birthDate}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Country: <ThemedText type="small" themeColor="textSecondary"
                          style={styles.profileMetaDetail}>{profile.country}</ThemedText>
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Gender: <ThemedText type="small" themeColor="textSecondary"
                          style={styles.profileMetaDetail}>{profile.gender}</ThemedText>
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.bioInterestsRow, isMobileWeb && styles.mobileBioInterestsRow]}>
                    <View
                      style={[styles.bioColumn, isMobileWeb && styles.mobileProfileColumn, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="smallBold">Bio:</ThemedText>
                      {!!profile.bio && (
                        <ThemedText type="small" style={styles.bio}>
                          {profile.bio}
                        </ThemedText>
                      )}
                    </View>

                    <View
                      style={[styles.interestsColumn, isMobileWeb && styles.mobileProfileColumn, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="smallBold">My interests:</ThemedText>
                      <View style={styles.chips}>
                        {(profile.interests ?? []).map((interest) => (
                          <View key={interest} style={[styles.chip, {
                            backgroundColor: theme.backgroundSelected,
                            borderColor: theme.tabActiveBorder
                          }]}>
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
                      <PostCard key={post.id} post={post} onMediaProcessing={loadPosts} />
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
            </>
          ) : null}
        </ScrollView>

        <ResponsiveModalSheet
          visible={settingsView !== 'closed'}
          onClose={() => setSettingsView('closed')}
          title={settingsView === 'profile'
            ? 'Profile settings'
            : settingsView === 'discovery'
              ? 'Discovery preferences'
              : 'Settings'}
          closeAccessibilityLabel="Close settings"
        >
          {settingsView === 'profile' && profile ? (
            <View style={styles.profileEditor}>
              <TouchableOpacity
                onPress={() => setSettingsView('hub')}
                style={[styles.backButton, styles.profileEditorBackButton]}
              >
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as any}
                  tintColor='#8769ffbe'
                  size={18}
                />
                <ThemedText type="smallBold">Back to settings</ThemedText>
              </TouchableOpacity>
              <OnboardingGate
                mode="update"
                embedded
                initialProfile={profile}
                onOnboardSuccess={() => void handleProfileUpdated()}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.settingsScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {settingsView === 'hub' ? (
                <>
                  <ModalSheetPanel title="Profile settings">
                    <ThemedText type="small" themeColor="textSecondary">
                      Update your public profile, photo, bio, and personal details.
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setSettingsView('profile')}
                      style={[styles.buttonStyle, { borderColor: '#6249cabe' }]}
                    >
                      <SymbolView
                        name={{ ios: 'square.and.pencil', android: 'edit', web: 'edit' } as any}
                        tintColor='#8769ffbe'
                        size={20}
                      />
                      <ThemedText type="smallBold">Edit profile</ThemedText>
                    </TouchableOpacity>
                  </ModalSheetPanel>

                  <ModalSheetPanel
                    title="Discovery preferences"
                    trailing={prefsSaved ? (
                      <ThemedText type="small" themeColor="textSecondary">Saved</ThemedText>
                    ) : undefined}
                  >
                    <ThemedText type="small" themeColor="textSecondary">
                      Control the age range, genders, countries, and interests you discover.
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => {
                        setPrefsSaved(false);
                        setSettingsView('discovery');
                      }}
                      style={[styles.buttonStyle, { borderColor: '#6249cabe' }]}
                    >
                      <SymbolView
                        name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' } as any}
                        tintColor='#8769ffbe'
                        size={20}
                      />
                      <ThemedText type="smallBold">Edit discovery preferences</ThemedText>
                    </TouchableOpacity>
                  </ModalSheetPanel>

                  <TouchableOpacity
                    onPress={onLogout}
                    style={[styles.buttonStyle, { borderColor: '#ef4444' }]}
                  >
                    <SymbolView
                      name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' } as any}
                      tintColor="#ef4444"
                      size={20}
                    />
                    <ThemedText type="smallBold">Logout</ThemedText>
                  </TouchableOpacity>
                </>
              ) : settingsView === 'discovery' ? (
                <>
                  <TouchableOpacity
                    onPress={() => setSettingsView('hub')}
                    style={styles.backButton}
                  >
                    <SymbolView
                      name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as any}
                      tintColor='#8769ffbe'
                      size={18}
                    />
                    <ThemedText type="smallBold">Back to settings</ThemedText>
                  </TouchableOpacity>
                  <ModalSheetPanel>
                    <DiscoveryPreferencesForm
                      onSaved={() => {
                        setPrefsSaved(true);
                        setSettingsView('hub');
                      }}
                    />
                  </ModalSheetPanel>
                </>
              ) : null}
            </ScrollView>
          )}
        </ResponsiveModalSheet>
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
  mobilePanel: {
    padding: Spacing.two,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  backButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  profileEditor: {
    flex: 1,
  },
  profileEditorBackButton: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
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
  settingsScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
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
  mobileBioInterestsRow: {
    flexDirection: 'column',
  },
  mobileProfileColumn: {
    width: '100%',
    minWidth: 0,
    padding: Spacing.two,
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
  mobileProfileTopRow: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#6249cabe',
    backgroundColor: Colors.dark.backgroundSelected,
  },
  mobileAvatar: {
    width: 88,
    height: 88,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  avatarOverlayText: {
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: Spacing.one,
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
    bottom: 10,
    lineHeight: 22,
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
