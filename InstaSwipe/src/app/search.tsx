import { useCallback, useRef, useState } from 'react';
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
  DiscoveryProfile,
} from '@/hooks/matches';
import { searchProfilesByName } from '@/hooks/search';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import DiscoveryProfileModal from '@/components/discovery-profile-modal';

const PAGE_SIZE = 100;

export default function SearchScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<DiscoveryProfile | null>(null);

  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const activeNameRef = useRef<string | null>(null);

  async function loadDiscovery() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      activeNameRef.current = null;
      setProfiles([]);
      setTotalElements(0);
      setHasSearched(false);
      setError(null);
      return;
    }

    activeNameRef.current = trimmedName;
    pageRef.current = 0;
    hasMoreRef.current = false;

    setHasSearched(true);
    setLoading(true);
    setError(null);

    try {
      const result = await searchProfilesByName({ q: trimmedName, page: 0, size: PAGE_SIZE });

      setProfiles(result.content);
      setTotalElements(result.totalElements);
      hasMoreRef.current = !result.last;
    } catch (loadError) {
      setProfiles([]);
      setTotalElements(0);
      setError(loadError instanceof Error ? loadError.message : 'Search request failed');
    } finally {
      setLoading(false);
    }
  }

  const loadMoreResults = useCallback(async () => {
    const activeName = activeNameRef.current;
    if (!activeName || loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = pageRef.current + 1;
      const result = await searchProfilesByName({ q: activeName, page: nextPage, size: PAGE_SIZE });
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
          
        </View>
        <ThemedText type="small" themeColor="textSecondary">
            Age: <ThemedText type='smallBold'>{item.age}</ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor='textSecondary'>
            Country: <ThemedText type='smallBold'>{item.country}</ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Gender: <ThemedText type='smallBold'>{item.gender}</ThemedText>
        </ThemedText>
      </View>
    </Pressable>
  ), [theme]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header title='Search'/>
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={renderProfile}
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={styles.header}>
              {Platform.OS === 'web' ? 
              <ThemedText type="subtitle" style={styles.title}>
                 Search
              </ThemedText> 
              : null}
              <View style={[styles.searchPanel, { borderColor: theme.tabActiveBorder }]}>
                <View style={styles.field}>
                  <ThemedText type="smallBold">Search by username</ThemedText>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    placeholder="Type a username…"
                    placeholderTextColor={theme.iconMuted}
                    returnKeyType="search"
                    onSubmitEditing={loadDiscovery}
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

              {hasSearched && !loading && !error && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.resultCount}>
                  {totalElements} results
                </ThemedText>
              )}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {hasSearched ? 'No matching profiles.' : 'Search for a username.'}
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
  searchPanel: {
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
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
    width: Platform.OS === 'web' ? 100 : 90,
    height: Platform.OS === 'web' ? 100 : 90,
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
    fontWeight: 800,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
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
});
