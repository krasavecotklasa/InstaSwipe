import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
  DiscoveryProfile,
  Gender,
  getDiscovery,
  getDiscoveryPreferences,
} from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';

const PAGE_SIZE = 100;

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
  const [gender, setGender] = useState<Gender>(DISCOVERY_GENDERS[0]);
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState('');
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      const savedPreferences = await getDiscoveryPreferences();
      if (!active) {
        return;
      }

      setMinAge(String(savedPreferences.minAge));
      setMaxAge(String(savedPreferences.maxAge));
      setGender((savedPreferences.gender as Gender) || DISCOVERY_GENDERS[0]);
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
    setLoading(true);
    setError(null);

    try {
      const result = await getDiscovery({
        minAge: parseAge(minAge),
        maxAge: parseAge(maxAge),
        gender,
        country,
        interests: parseInterests(interests),
        page: 0,
        size: PAGE_SIZE,
      });

      setProfiles(result.content);
      setTotalElements(result.totalElements);
    } catch (loadError) {
      setProfiles([]);
      setTotalElements(0);
      setError(loadError instanceof Error ? loadError.message : 'Discovery request failed');
    } finally {
      setLoading(false);
    }
  }

  const renderProfile = ({ item }: { item: DiscoveryProfile }) => (
    <View style={[styles.profileCard, { borderColor: theme.tabActiveBorder }]}>
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
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header />
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={renderProfile}
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
                    {DISCOVERY_GENDERS.map((option) => {
                      const selected = option === gender;

                      return (
                        <TouchableOpacity
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
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
  profileCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
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
