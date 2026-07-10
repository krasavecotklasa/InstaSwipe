import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

type TabButtonProps = TabTriggerSlotProps & {
  iconName: { ios: string; web: string };
};

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton iconName={{ ios: 'house.fill', web: 'home' }} />
          </TabTrigger>
          <TabTrigger name="match" href="/match" asChild>
            <TabButton iconName={{ ios: 'heart.fill', web: 'favorite' }} />
          </TabTrigger>
          <TabTrigger name="messages" href="/messages" asChild>
            <TabButton iconName={{ ios: 'paperplane', web: 'send' }} />
          </TabTrigger>
          <TabTrigger name="search" href="/search" asChild>
            <TabButton iconName={{ ios: 'magnifyingglass', web: 'search' }} />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton iconName={{ ios: 'person.fill', web: 'person' }} />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ isFocused, iconName, ...props }: TabButtonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View
        style={[
          styles.tabButtonView,
          {
            borderColor: isFocused ? colors.tabActiveBorder : 'transparent',
          },
        ]}>
        <SymbolView
          tintColor={isFocused ? colors.text : colors.iconMuted}
          name={iconName as any}
          size={24}
        />
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View {...props} style={[styles.tabListContainer, { backgroundColor: colors.background, borderRightColor: colors.tabActiveBorder }]}>
      <ThemedText style={styles.brandText}>
        InstaSwipe
      </ThemedText>

      <View style={styles.tabButtonGroup}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100%',
    width: 100,
    padding: Spacing.two,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column',
    borderRightWidth: 0.5,
    zIndex: 100,
  },
  tabButtonGroup: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.two,
    color: '#7157db',
  },
  pressed: {
    opacity: 0.75,
  },
  tabButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
