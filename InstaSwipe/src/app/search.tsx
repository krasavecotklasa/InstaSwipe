import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DISCOVERY_GENDER_LABELS,
  DISCOVERY_GENDERS,
  type DiscoveryFilters,
  DiscoveryProfile,
  Gender,
  getDiscovery,
  getDiscoveryPreferences,
} from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import DiscoveryProfileModal from '@/components/discovery-profile-modal';

const PAGE_SIZE = 100;

// Includes an "Any" option ('') so a user can browse all genders; '' means the
// gender filter is omitted from the discovery request.
const GENDER_OPTIONS: (Gender | '')[] = ['', ...DISCOVERY_GENDERS];
const genderOptionLabel = (option: Gender | '') => (option === '' ? 'Any' : DISCOVERY_GENDER_LABELS[option]);

const parseAge = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const age = Number(trimmed);
  return Number.isFinite(age) ? age : undefined;
};

const parseInterests = (value: string) => {
  return value
    .split(',')
    .map((interest) => interest.trim())
    .filter(Boolean);
};

const toInputValue = (value: string[] | string | number | undefined) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value == null ? '' : String(value);
};

export default function SearchScreen() {
  const theme = useTheme();
  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('67');
  const [gender, setGender] = useState<Gender | ''>('');
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState('');
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<DiscoveryProfile | null>(null);

  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  // Filters used by the current result set, snapshotted at search time so paging
  // stays consistent even if the user edits the inputs without pressing Search.
  const activeFiltersRef = useRef<DiscoveryFilters | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const savedPreferences = await getDiscoveryPreferences();
      if (!active) {
        return;
      }

      setMinAge(String(savedPreferences.minAge));
      setMaxAge(String(savedPreferences.maxAge));
      setGender(savedPreferences.gender);
      setCountry(savedPreferences.country);
      setInterests(toInputValue(savedPreferences.interests));
      setHydrating(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrating) {
      void loadDiscovery();
    }
    // The initial preferences hydrate should trigger one automatic search.
    // Subsequent edits stay user-driven via the Search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrating]);

  async function loadDiscovery() {
    const filters: DiscoveryFilters = {
      minAge: parseAge(minAge),
      maxAge: parseAge(maxAge),
      gender: gender || undefined,
      country,
      interests: parseInterests(interests),
      size: PAGE_SIZE,
    };
    activeFiltersRef.current = filters;
    pageRef.current = 0;
    hasMoreRef.current = false;

    setLoading(true);
    setError(null);

    try {
      const result = await getDiscovery({ ...filters, page: 0 });

      setProfiles(result.content);
      setTotalElements(result.totalElements);
      hasMoreRef.current = !result.last;
    } catch (loadError) {
      setProfiles([]);
      setTotalElements(0);
      setError(loadError instanceof Error ? loadError.message : 'Discovery request failed');
    } finally {
      setLoading(false);
    }
  }

  const loadMoreResults = useCallback(async () => {
    const filters = activeFiltersRef.current;
    if (!filters || loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = pageRef.current + 1;
      const result = await getDiscovery({ ...filters, page: nextPage });
      pageRef.current = nextPage;
      hasMoreRef.current = !result.last;
      setProfiles((current) => [...current, ...result.content]);
    } catch {
      // Keep the results already loaded; the next scroll will retry.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  const renderProfile = useCallback(({ item }: { item: DiscoveryProfile }) => (
    <Pressable
      onPress={() => setSelectedProfile(item)}
      style={({ pressed }) => [
        styles.profileCard,
        { borderColor: theme.tabActiveBorder },
        pressed && styles.profileCardPressed,
      ]}
    >
      <Image
        source={item.profilePictureUrl ? { uri: item.profilePictureUrl } : undefined}
        style={styles.profileImage}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.profileBody}>
        <View style={styles.profileHeader}>
          <ThemedText type="smallBold" style={styles.profileName}>
            {item.displayName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.age} · {item.gender}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {item.country}
        </ThemedText>
        {!!item.bio && (
          <ThemedText type="small" style={styles.bio}>
            {item.bio}
          </ThemedText>
        )}
        <View style={styles.chips}>
          {item.interests?.map((interest) => (
            <View key={`${item.id}-${interest}`} style={[styles.chip, { borderColor: theme.tabActiveBorder }]}>
              <ThemedText type="small" style={styles.chipText}>
                {interest}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  ), [theme]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header />
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={renderProfile}
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>
                Discover
              </ThemedText>

              <View style={[styles.filters, { borderColor: theme.tabActiveBorder }]}>
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

                <TouchableOpacity
                  onPress={loadDiscovery}
                  disabled={loading}
                  style={[styles.buttonStyle, { opacity: loading ? 0.65 : 1 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <SymbolView
                      name={{ ios: 'magnifyingglass', android: 'search', web: 'search' } as any}
                      tintColor="#8769ffbe"
                      size={18}
                    />
                  )}
                  <ThemedText type="smallBold">
                    Search
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {!!error && (
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}

              {!loading && !error && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.resultCount}>
                  {totalElements} results
                </ThemedText>
              )}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No profiles loaded yet.
              </ThemedText>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={theme.text} style={styles.footerLoader} />
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
        />
        <DiscoveryProfileModal
          visible={Boolean(selectedProfile)}
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
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
  listContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  filters: {
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
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
  resultCount: {
    paddingHorizontal: Spacing.one,
  },
  errorText: {
    color: '#ef4444',
    paddingHorizontal: Spacing.one,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  footerLoader: {
    paddingVertical: Spacing.four,
  },
  profileCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  profileCardPressed: {
    opacity: 0.82,
  },
  profileImage: {
    width: Platform.OS === 'web' ? 120 : 90,
    height: Platform.OS === 'web' ? 120 : 90,
    borderRadius: 64,
    backgroundColor: '#24172c',
  },
  profileBody: {
    flex: 1,
    gap: Spacing.one,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  profileName: {
    flex: 1,
  },
  bio: {
    marginTop: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
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
});
